-- Ubicación GPS de cada cliente (pin guardado desde el celular)
-- Ejecutar una vez en Supabase: SQL Editor > New query > pegar y Run
alter table public.clientes
  add column if not exists latitud double precision,
  add column if not exists longitud double precision,
  add column if not exists ubicacion_actualizada timestamptz;
