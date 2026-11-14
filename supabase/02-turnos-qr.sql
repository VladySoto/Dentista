-- =====================================================================
--  Turnos por QR: el paciente toma turno desde su celular sin cuenta.
--  Pegar todo en Supabase → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez sin problemas.
--
--  Seguridad: el paciente (anónimo) NO puede leer ni escribir la tabla.
--  Solo puede llamar a estas tres funciones, que únicamente:
--    · muestran nombre y horario del consultorio,
--    · crean un turno nuevo,
--    · dicen el número y la posición de SU turno.
--  El consultorio se identifica con un código secreto del QR, que el
--  dentista puede cambiar en Ajustes si alguien abusa.
-- =====================================================================

-- Permite que las funciones del QR guarden el turno a nombre del dentista
create or replace function public.registros_tocar()
returns trigger language plpgsql as $$
begin
  new.actualizado := clock_timestamp();
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end $$;

create index if not exists registros_codigo_qr_idx
  on public.registros ((data->>'codigoQR')) where tabla = 'config';

-- Dueño del consultorio según el código del QR
create or replace function public._consultorio_por_codigo(p_codigo text)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from registros
  where tabla = 'config' and id = 'general' and not borrado
    and length(coalesce(p_codigo, '')) >= 12 and data->>'codigoQR' = p_codigo
  limit 1
$$;
revoke all on function public._consultorio_por_codigo(text) from public, anon, authenticated;

-- 1) Nombre y horario del consultorio (para el encabezado de la página)
create or replace function public.info_consultorio(p_codigo text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := _consultorio_por_codigo(p_codigo); v_data jsonb;
begin
  if v_uid is null then return null; end if;
  select data into v_data from registros where user_id = v_uid and tabla = 'config' and id = 'general';
  return json_build_object('consultorio', v_data->>'consultorio', 'horario', v_data->>'horario', 'direccion', v_data->>'direccion');
end $$;

-- 2) Tomar turno
create or replace function public.tomar_turno(
  p_codigo text, p_fecha date, p_nombre text, p_documento text, p_telefono text, p_motivo text
) returns json language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := _consultorio_por_codigo(p_codigo);
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
  v_doc text := nullif(left(regexp_replace(coalesce(p_documento, ''), '\s', '', 'g'), 20), '');
  v_tel text := nullif(left(regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g'), 20), '');
  v_nombre text := left(trim(coalesce(p_nombre, '')), 80);
  v_existente jsonb; v_pac text; v_num int; v_id bigint;
begin
  if v_uid is null then raise exception 'El código del consultorio no es válido. Escanee de nuevo el QR.'; end if;
  if p_fecha is null or abs(p_fecha - v_hoy) > 1 then p_fecha := v_hoy; end if;
  if length(v_nombre) < 2 then raise exception 'Escriba su nombre.'; end if;

  -- Bloqueo por consultorio: evita dos turnos con el mismo número
  perform pg_advisory_xact_lock(hashtext(v_uid::text || p_fecha::text));

  if (select count(*) from registros where user_id = v_uid and tabla = 'turnos' and not borrado
        and data->>'fecha' = p_fecha::text and data->>'origen' = 'qr') >= 150 then
    raise exception 'Se alcanzó el límite de turnos por QR de hoy. Tome una ficha en la puerta.';
  end if;

  if v_doc is not null then
    select id into v_pac from registros where user_id = v_uid and tabla = 'pacientes' and not borrado
      and regexp_replace(coalesce(data->>'documento', ''), '\s', '', 'g') = v_doc limit 1;
  end if;

  -- Si ya tiene un turno activo hoy (mismo carnet, paciente o teléfono), se devuelve ese
  select data into v_existente from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = p_fecha::text and data->>'estado' in ('espera', 'atencion')
    and ((v_pac is not null and data->>'pacienteId' = v_pac)
      or (v_doc is not null and data->>'documentoLlegada' = v_doc)
      or (v_tel is not null and data->>'telefonoLlegada' = v_tel))
    limit 1;
  if v_existente is not null then
    return json_build_object('turno', v_existente->>'id', 'numero', (v_existente->>'numero')::int, 'repetido', true);
  end if;

  select coalesce(max((data->>'numero')::int), 0) + 1 into v_num from registros
    where user_id = v_uid and tabla = 'turnos' and not borrado and data->>'fecha' = p_fecha::text;
  v_id := (extract(epoch from clock_timestamp()) * 1000)::bigint * 1000 + floor(random() * 1000)::int;

  insert into registros (user_id, tabla, id, data) values (v_uid, 'turnos', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'pacienteId', v_pac::bigint,
    'fecha', p_fecha::text,
    'numero', v_num,
    'motivo', nullif(left(trim(coalesce(p_motivo, '')), 60), ''),
    'estado', 'espera',
    'llegada', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'origen', 'qr',
    'nombreLlegada', v_nombre,
    'documentoLlegada', v_doc,
    'telefonoLlegada', v_tel
  )));
  return json_build_object('turno', v_id::text, 'numero', v_num, 'repetido', false);
end $$;

-- 3) Ver mi turno: número, estado y cuántos faltan (nada más)
create or replace function public.mi_turno(p_codigo text, p_turno text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := _consultorio_por_codigo(p_codigo); v_t jsonb; v_antes int; v_actual int;
begin
  if v_uid is null then return null; end if;
  select data into v_t from registros where user_id = v_uid and tabla = 'turnos' and id = p_turno and not borrado;
  if v_t is null then return json_build_object('estado', 'cancelado'); end if;
  select count(*) into v_antes from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'espera' and (data->>'numero')::int < (v_t->>'numero')::int;
  select max((data->>'numero')::int) into v_actual from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'atencion';
  return json_build_object('numero', (v_t->>'numero')::int, 'estado', v_t->>'estado', 'antes', v_antes, 'atendiendo', v_actual);
end $$;

grant execute on function public.info_consultorio(text) to anon, authenticated;
grant execute on function public.tomar_turno(text, date, text, text, text, text) to anon, authenticated;
grant execute on function public.mi_turno(text, text) to anon, authenticated;
