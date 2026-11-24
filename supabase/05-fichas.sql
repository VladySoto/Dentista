-- =====================================================================
--  Un solo número: el de la ficha de papel.
--  El paciente escribe el número de su ficha al escanear el QR.
--  Pegar todo en Supabase → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- La versión anterior (la app daba el número) ya no se usa
drop function if exists public.tomar_turno(text, date, text, text, text, text);

-- Último número de ficha llamado hoy (en atención, atendido o "no vino")
create or replace function public._ultimo_llamado(p_uid uuid, p_fecha text)
returns int language sql stable set search_path = public as $$
  select coalesce(max((data->>'numero')::int), 0) from registros
  where user_id = p_uid and tabla = 'turnos' and not borrado and data->>'fecha' = p_fecha
    and data->>'estado' in ('atencion', 'atendido', 'cancelado') and coalesce((data->>'numero')::int, 0) > 0
$$;
revoke all on function public._ultimo_llamado(uuid, text) from public, anon, authenticated;

-- 1) Registrarse con el número de ficha
create or replace function public.tomar_turno(
  p_codigo text, p_fecha date, p_ficha int, p_nombre text, p_documento text, p_telefono text, p_motivo text
) returns json language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := _consultorio_por_codigo(p_codigo);
  v_hoy date := (now() at time zone 'America/La_Paz')::date;
  v_doc text := nullif(left(regexp_replace(coalesce(p_documento, ''), '\s', '', 'g'), 20), '');
  v_tel text := nullif(left(regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g'), 20), '');
  v_nombre text := left(trim(coalesce(p_nombre, '')), 80);
  v_motivo text := nullif(left(trim(coalesce(p_motivo, '')), 60), '');
  v_existente record; v_pac text; v_id bigint;
begin
  if v_uid is null then raise exception 'El código del consultorio no es válido. Escanee de nuevo el QR.'; end if;
  if p_fecha is null or abs(p_fecha - v_hoy) > 1 then p_fecha := v_hoy; end if;
  if p_ficha is null or p_ficha < 1 or p_ficha > 999 then raise exception 'Escriba el número de su ficha.'; end if;
  if length(v_nombre) < 2 then raise exception 'Escriba su nombre.'; end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text || p_fecha::text));

  if v_doc is not null then
    select id into v_pac from registros where user_id = v_uid and tabla = 'pacientes' and not borrado
      and regexp_replace(coalesce(data->>'documento', ''), '\s', '', 'g') = v_doc limit 1;
  end if;

  select id, data into v_existente from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = p_fecha::text and (data->>'numero')::int = p_ficha limit 1;

  if v_existente.id is not null then
    -- La misma persona vuelve a registrarse: se devuelve su turno
    if lower(coalesce(v_existente.data->>'nombreLlegada', '')) = lower(v_nombre) then
      return json_build_object('turno', v_existente.id, 'numero', p_ficha, 'repetido', true);
    end if;
    if v_existente.data->>'estado' <> 'espera' then
      raise exception 'La ficha % ya fue llamada. Avise en el consultorio.', p_ficha;
    end if;
    if v_existente.data ? 'nombreLlegada' or v_existente.data ? 'pacienteId' then
      raise exception 'La ficha % ya está registrada a otro nombre. Revise el número de su ficha.', p_ficha;
    end if;
    -- El dentista ya la había anotado sin nombre: se le agregan los datos
    update registros set data = data || jsonb_strip_nulls(jsonb_build_object(
        'pacienteId', v_pac::bigint, 'motivo', v_motivo, 'origen', 'qr',
        'nombreLlegada', v_nombre, 'documentoLlegada', v_doc, 'telefonoLlegada', v_tel))
      where user_id = v_uid and tabla = 'turnos' and id = v_existente.id;
    return json_build_object('turno', v_existente.id, 'numero', p_ficha, 'repetido', false);
  end if;

  if p_ficha <= _ultimo_llamado(v_uid, p_fecha::text) then
    raise exception 'La ficha % ya fue llamada. Avise en el consultorio.', p_ficha;
  end if;
  if (select count(*) from registros where user_id = v_uid and tabla = 'turnos' and not borrado
        and data->>'fecha' = p_fecha::text and data->>'origen' = 'qr') >= 150 then
    raise exception 'Se alcanzó el límite de registros de hoy.';
  end if;

  v_id := (extract(epoch from clock_timestamp()) * 1000)::bigint * 1000 + floor(random() * 1000)::int;
  insert into registros (user_id, tabla, id, data) values (v_uid, 'turnos', v_id::text, jsonb_strip_nulls(jsonb_build_object(
    'id', v_id, 'pacienteId', v_pac::bigint, 'fecha', p_fecha::text, 'numero', p_ficha, 'motivo', v_motivo,
    'estado', 'espera', 'llegada', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'origen', 'qr',
    'nombreLlegada', v_nombre, 'documentoLlegada', v_doc, 'telefonoLlegada', v_tel)));
  return json_build_object('turno', v_id::text, 'numero', p_ficha, 'repetido', false);
end $$;

-- 2) Ver mi ficha: a quién se atiende, cuántas fichas faltan y hora aproximada
create or replace function public.mi_turno(p_codigo text, p_turno text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := _consultorio_por_codigo(p_codigo);
  v_t jsonb; v_cfg jsonb; v_n int; v_ultimo int; v_actual int; v_espera numeric := 0;
  v_antes int; v_def int; v_reg int; v_min_reg numeric; v_fuera int;
  v_ahora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  r record;
begin
  if v_uid is null then return null; end if;
  select data into v_t from registros where user_id = v_uid and tabla = 'turnos' and id = p_turno and not borrado;
  if v_t is null then return json_build_object('estado', 'cancelado'); end if;
  select data into v_cfg from registros where user_id = v_uid and tabla = 'config' and id = 'general';
  v_n := (v_t->>'numero')::int;
  v_ultimo := _ultimo_llamado(v_uid, v_t->>'fecha');
  v_def := coalesce((v_cfg->>'minutosPorDefecto')::int, 20);
  select max((data->>'numero')::int) into v_actual from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'atencion' and coalesce((data->>'numero')::int, 0) > 0;

  if v_t->>'estado' = 'espera' and v_n <= v_ultimo then
    return json_build_object('numero', v_n, 'estado', 'pasado', 'atendiendo', v_actual, 'ultimo', v_ultimo);
  end if;

  -- Lo que le falta al que está en atención (mínimo 3 minutos)
  for r in select data from registros where user_id = v_uid and tabla = 'turnos' and not borrado
      and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'atencion' loop
    v_espera := greatest(v_espera, greatest(3, _minutos_motivo(v_cfg, r.data->>'motivo')
      - (v_ahora - coalesce((r.data->>'inicio')::bigint, v_ahora)) / 60000.0));
  end loop;

  -- Fichas entre la última llamada y la suya: las registradas cuentan con su motivo,
  -- las que ya se llamaron o no vinieron no cuentan, y las demás con el tiempo por defecto
  select count(*) filter (where data->>'estado' = 'espera'),
         coalesce(sum(_minutos_motivo(v_cfg, data->>'motivo')) filter (where data->>'estado' = 'espera'), 0),
         count(*) filter (where data->>'estado' <> 'espera')
    into v_reg, v_min_reg, v_fuera
    from registros where user_id = v_uid and tabla = 'turnos' and not borrado and data->>'fecha' = v_t->>'fecha'
      and (data->>'numero')::int > v_ultimo and (data->>'numero')::int < v_n;
  v_antes := greatest(0, v_n - v_ultimo - 1 - v_fuera);
  v_espera := v_espera + v_min_reg + greatest(0, v_antes - v_reg) * v_def;

  return json_build_object(
    'numero', v_n, 'estado', v_t->>'estado', 'antes', v_antes, 'atendiendo', v_actual, 'ultimo', v_ultimo,
    'espera_min', greatest(0, round(v_espera))::int, 'duracion_min', _minutos_motivo(v_cfg, v_t->>'motivo'));
end $$;

grant execute on function public.tomar_turno(text, date, int, text, text, text, text) to anon, authenticated;
grant execute on function public.mi_turno(text, text) to anon, authenticated;
