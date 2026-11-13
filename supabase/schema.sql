-- =====================================================================
--  Consultorio Dental: base de datos en la nube
--  Pegar todo en Supabase → SQL Editor → New query → Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- Cada fila de la app (paciente, consulta, turno, cita, pago, etc.)
-- se guarda como un registro JSON, separado por usuario.
create table if not exists public.registros (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tabla       text        not null,
  id          text        not null,
  data        jsonb,
  borrado     boolean     not null default false,
  actualizado timestamptz not null default clock_timestamp(),
  primary key (user_id, tabla, id)
);

create index if not exists registros_sync_idx on public.registros (user_id, actualizado);

-- La hora de cada cambio la pone el servidor (no el celular), para que
-- todos los dispositivos se sincronicen en el orden correcto.
create or replace function public.registros_tocar()
returns trigger language plpgsql as $$
begin
  new.actualizado := clock_timestamp();
  new.user_id := auth.uid();
  return new;
end $$;

drop trigger if exists registros_tocar on public.registros;
create trigger registros_tocar
  before insert or update on public.registros
  for each row execute function public.registros_tocar();

-- Seguridad: cada usuario solo puede ver y modificar SUS registros.
alter table public.registros enable row level security;

drop policy if exists "solo mis registros" on public.registros;
create policy "solo mis registros" on public.registros
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.registros from anon;
grant select, insert, update, delete on public.registros to authenticated;

-- Avisos en tiempo real (para que la fila se actualice sola en todos los dispositivos)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros'
  ) then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;
