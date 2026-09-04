-- Gio Filio — Panel de asesores (carga manual de propiedades)
-- Correr una sola vez en Supabase: Dashboard → SQL Editor → New query → pegar todo → Run.

-- ------------------------------------------------------------------ perfiles
-- Un renglón por usuario de auth.users, con su rol. Se crea automáticamente
-- (trigger abajo) cuando alguien se registra o cuando Gio lo invita.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'asesor' check (rol in ('admin', 'asesor')),
  creado_en timestamptz not null default now()
);

alter table perfiles enable row level security;

-- Con "Automatically expose new tables" desmarcado al crear el proyecto
-- (la opción recomendada), una tabla nueva no queda visible para la API
-- aunque tenga RLS — hay que darle el permiso a nivel tabla explícitamente.
-- RLS sigue siendo quien decide qué renglones ve cada quien.
grant usage on schema public to anon, authenticated, service_role;
grant select, update on perfiles to authenticated;
grant select on perfiles to service_role;

-- Función auxiliar en vez de una subconsulta directa a `perfiles` dentro de
-- su propia política: una política que consulta su propia tabla dispara la
-- misma política otra vez sobre esa subconsulta → recursión infinita
-- (error de Postgres 42P17). security definer hace que esta función corra
-- sin aplicar RLS, rompiendo el ciclo.
create or replace function is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

grant execute on function is_admin() to authenticated;

create policy "cada quien lee su propio perfil, admin lee todos"
  on perfiles for select
  using (auth.uid() = id or is_admin());

create policy "cada quien edita su propio perfil"
  on perfiles for update
  using (auth.uid() = id);

-- Crea el perfil automáticamente al primer login (rol asesor por default;
-- Gio se sube a 'admin' a mano una sola vez, ver instrucciones al final).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------- propiedades
-- Mismo "shape" que necesita _generador/data_props_manual.py — ver
-- _generador/fetch_manual_props.py para el mapeo exacto columna → campo.
create table if not exists propiedades_manual (
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,                -- armado por el panel (tipo+operacion+colonia+detalle), no texto libre
  detalle text not null default '',    -- unico texto libre del titulo, para poder editarlo despues
  operacion text not null check (operacion in ('venta', 'renta')),
  tipo text not null,
  precio numeric not null default 0,
  colonia_slug text not null,          -- ver _generador/data_colonias_todas.py (catalogo completo de CDMX)
  rec int not null default 0,
  ban int not null default 0,
  medios int not null default 0,
  est int not null default 0,
  m2c int not null default 0,
  m2t int not null default 0,
  descripcion text not null default '',
  amenidades text[] not null default '{}',
  fotos text[] not null default '{}',  -- URLs públicas del bucket 'propiedades-manual'
  destacada boolean not null default false,
  estado text not null default 'borrador' check (estado in ('borrador', 'disponible', 'pausada')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table propiedades_manual enable row level security;

grant select, insert, update, delete on propiedades_manual to authenticated;
grant select on propiedades_manual to service_role;

create policy "todos ven las publicadas, cada quien ve tambien las suyas"
  on propiedades_manual for select
  using (estado = 'disponible' or asesor_id = auth.uid() or is_admin());

create policy "cada asesor crea sus propias fichas"
  on propiedades_manual for insert
  with check (asesor_id = auth.uid());

create policy "cada asesor edita las suyas, admin edita todas"
  on propiedades_manual for update
  using (asesor_id = auth.uid() or is_admin());

create policy "cada asesor borra las suyas, admin borra todas"
  on propiedades_manual for delete
  using (asesor_id = auth.uid() or is_admin());

create or replace function set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_propiedad_updated on propiedades_manual;
create trigger on_propiedad_updated
  before update on propiedades_manual
  for each row execute function set_actualizado_en();

-- ---------------------------------------------------------------- storage
-- Bucket público para fotos (las URLs quedan en propiedades_manual.fotos).
insert into storage.buckets (id, name, public)
values ('propiedades-manual', 'propiedades-manual', true)
on conflict (id) do nothing;

create policy "cualquiera puede ver las fotos (bucket publico)"
  on storage.objects for select
  using (bucket_id = 'propiedades-manual');

create policy "un asesor autenticado puede subir sus fotos"
  on storage.objects for insert
  with check (bucket_id = 'propiedades-manual' and auth.role() = 'authenticated');

create policy "un asesor autenticado puede borrar fotos que subio"
  on storage.objects for delete
  using (bucket_id = 'propiedades-manual' and auth.uid() = owner);

-- ------------------------------------------------------------------- leads
-- Cada envío de un formulario del sitio (api/leads.js) se guarda aquí ADEMÁS
-- de reenviarse a n8n (que sigue encargándose de la respuesta automática por
-- WhatsApp/email) — esta tabla es la que alimenta "Contactos" en el panel.
-- Solo la escribe api/leads.js con la service_role key; el panel (asesores,
-- con la anon key) únicamente lee y actualiza estado/notas/asesor_id.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  mensaje text,
  fuente text not null default 'sitio_web',      -- lead.fuente (gio.js captureLead)
  formulario text not null default 'contacto',   -- lead.formulario
  propiedad_id text,
  propiedad_titulo text,
  propiedad_precio text,
  operacion text,
  colonia text,
  pagina_url text,                               -- lead.url (donde se llenó el formulario)
  contexto jsonb not null default '{}'::jsonb,    -- resto de campos: utms, gclid/fbclid, referrer, m2, rec, ban...
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'activo', 'cerrado')),
  asesor_id uuid references auth.users(id) on delete set null,
  notas text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table leads enable row level security;

grant select, insert, update on leads to service_role;
grant select, update on leads to authenticated;

-- Bandeja compartida: cualquier asesor autenticado ve y puede tomar/mover
-- cualquier lead (equipo chico, sin territorios asignados por ahora).
create policy "todo asesor autenticado ve todos los leads"
  on leads for select
  to authenticated
  using (true);

create policy "todo asesor autenticado puede tomar/mover cualquier lead"
  on leads for update
  to authenticated
  using (true)
  with check (true);

-- El insert es exclusivo de api/leads.js (service_role, que ademas ignora
-- RLS) -- no se da policy de insert a "authenticated" a proposito.

drop trigger if exists on_lead_updated on leads;
create trigger on_lead_updated
  before update on leads
  for each row execute function set_actualizado_en();

-- ------------------------------------------------------------------ NOTAS
-- 1. Después de correr este script, crea el primer usuario (Gio) en
--    Authentication → Users → Add user (con su correo real).
-- 2. Súbelo a admin corriendo, en el SQL Editor:
--      update perfiles set rol = 'admin' where id =
--        (select id from auth.users where email = 'gio@giofilio.com');
-- 3. Para dar de alta a un nuevo asesor: Authentication → Users → Add user.
--    Entra como 'asesor' por default — solo ve y edita sus propias fichas.
-- 4. Para que "Contactos" reciba leads reales, agrega en Vercel (Project
--    Settings → Environment Variables) las mismas SUPABASE_URL y
--    SUPABASE_SERVICE_ROLE_KEY que ya usa el GitHub Action de sync-manual.
