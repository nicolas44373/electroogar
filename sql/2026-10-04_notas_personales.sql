-- Bloc de notas personal del Inicio (una sola nota que se guarda sola)
-- Ejecutar una vez en Supabase: SQL Editor > New query > pegar y Run
create table if not exists public.notas_personales (
  id integer primary key default 1,
  contenido text not null default '',
  actualizado timestamptz not null default now(),
  constraint notas_personales_una_sola check (id = 1)
);

insert into public.notas_personales (id) values (1) on conflict (id) do nothing;

-- Permisos para la app (mismo acceso que el resto de las tablas)
grant select, insert, update on public.notas_personales to anon, authenticated;
alter table public.notas_personales enable row level security;
drop policy if exists "notas personales desde la app" on public.notas_personales;
create policy "notas personales desde la app" on public.notas_personales
  for all to anon, authenticated using (true) with check (true);
