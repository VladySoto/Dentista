-- =====================================================================
--  Tiempo estimado de espera para quienes toman turno por QR
--  Pegar todo en Supabase → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- Minutos que suele tomar un motivo, según lo configurado en Ajustes
create or replace function public._minutos_motivo(p_config jsonb, p_motivo text)
returns int language sql immutable set search_path = public as $$
  select coalesce(
    (select (m->>'minutos')::int
       from jsonb_array_elements(coalesce(p_config->'motivos',
         '[{"nombre":"Dolor","minutos":30},{"nombre":"Control","minutos":15},{"nombre":"Limpieza","minutos":30},
           {"nombre":"Extracción","minutos":40},{"nombre":"Curación","minutos":30},{"nombre":"Ortodoncia","minutos":20},
           {"nombre":"Urgencia","minutos":30}]'::jsonb)) m
      where lower(m->>'nombre') = lower(trim(coalesce(p_motivo, '')))
      limit 1),
    (p_config->>'minutosPorDefecto')::int,
    20)
$$;
revoke all on function public._minutos_motivo(jsonb, text) from public, anon, authenticated;

-- 1) Datos del consultorio, ahora con los motivos de visita
create or replace function public.info_consultorio(p_codigo text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := _consultorio_por_codigo(p_codigo); v_data jsonb;
begin
  if v_uid is null then return null; end if;
  select data into v_data from registros where user_id = v_uid and tabla = 'config' and id = 'general';
  return json_build_object(
    'consultorio', v_data->>'consultorio', 'horario', v_data->>'horario', 'direccion', v_data->>'direccion',
    'motivos', coalesce((select json_agg(m->>'nombre') from jsonb_array_elements(v_data->'motivos') m), null));
end $$;

-- 2) Mi turno, ahora con los minutos estimados de espera y de atención
create or replace function public.mi_turno(p_codigo text, p_turno text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := _consultorio_por_codigo(p_codigo);
  v_t jsonb; v_cfg jsonb; v_antes int; v_actual text; v_espera numeric := 0;
  v_ahora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  r record;
begin
  if v_uid is null then return null; end if;
  select data into v_t from registros where user_id = v_uid and tabla = 'turnos' and id = p_turno and not borrado;
  if v_t is null then return json_build_object('estado', 'cancelado'); end if;
  select data into v_cfg from registros where user_id = v_uid and tabla = 'config' and id = 'general';

  select count(*) into v_antes from registros where user_id = v_uid and tabla = 'turnos' and not borrado
    and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'espera' and (data->>'numero')::int < (v_t->>'numero')::int;
  -- A quién se atiende ahora, como lo llama el dentista ("Ficha 3" o "Turno 12")
  select case when data ? 'ficha' then 'Ficha ' || (data->>'ficha') else 'Turno ' || (data->>'numero') end into v_actual
    from registros where user_id = v_uid and tabla = 'turnos' and not borrado
      and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'atencion'
    order by (data->>'numero')::int desc limit 1;

  -- Lo que le falta al que está en atención (mínimo 3 minutos)
  for r in select data from registros where user_id = v_uid and tabla = 'turnos' and not borrado
      and data->>'fecha' = v_t->>'fecha' and data->>'estado' = 'atencion' loop
    v_espera := greatest(v_espera, greatest(3, _minutos_motivo(v_cfg, r.data->>'motivo')
      - (v_ahora - coalesce((r.data->>'inicio')::bigint, v_ahora)) / 60000.0));
  end loop;
  -- Más lo que tardan los que están antes
  select v_espera + coalesce(sum(_minutos_motivo(v_cfg, data->>'motivo')), 0) into v_espera from registros
    where user_id = v_uid and tabla = 'turnos' and not borrado and data->>'fecha' = v_t->>'fecha'
      and data->>'estado' = 'espera' and (data->>'numero')::int < (v_t->>'numero')::int;

  return json_build_object(
    'numero', (v_t->>'numero')::int, 'estado', v_t->>'estado', 'antes', v_antes, 'atendiendo', v_actual,
    'espera_min', round(v_espera)::int, 'duracion_min', _minutos_motivo(v_cfg, v_t->>'motivo'));
end $$;

grant execute on function public.info_consultorio(text) to anon, authenticated;
grant execute on function public.mi_turno(text, text) to anon, authenticated;
