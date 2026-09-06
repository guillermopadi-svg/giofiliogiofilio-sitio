-- Gio Filio — Panel de asesores (carga manual de propiedades)
-- Supabase: Dashboard → SQL Editor → New query → pegar TODO el archivo → Run.
-- Es seguro volver a correrlo completo cada vez que este archivo cambie
-- (todo usa "if not exists"/"or replace"/"drop ... if exists" antes de crear).

-- ------------------------------------------------------------------ perfiles
-- Un renglón por usuario de auth.users, con su rol. Se crea automáticamente
-- (trigger abajo) cuando alguien se registra o cuando Gio lo invita.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text,                    -- copia de auth.users.email (no es consultable via REST) para mostrarlo en "Equipo"
  rol text not null default 'asesor' check (rol in ('admin', 'asesor', 'administrativo')),
  activo boolean not null default true,     -- false = Gio lo desactivo, ya no puede entrar al panel
  creado_en timestamptz not null default now()
);

-- Si la tabla ya existia de antes de este cambio (proyectos ya en produccion).
alter table perfiles add column if not exists email text;
alter table perfiles add column if not exists activo boolean not null default true;
alter table perfiles drop column if exists activado_en; -- ya no aplica: login es solo con Google, no hay "crear contraseña" que marcar
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check check (rol in ('admin', 'asesor', 'administrativo'));
update perfiles set email = (select u.email from auth.users u where u.id = perfiles.id) where email is null;

-- ------------------------------------------------------------- invitaciones
-- Lista de correos autorizados a entrar al panel -- login es solo con Google
-- (sin contraseñas que puedan ser hackeadas/phisheadas), pero no cualquiera
-- con cuenta de Google puede entrar: solo quien Gio ya puso aqui. Puede ser
-- su correo de Google Workspace o un Gmail personal (asesores externos).
-- El trigger handle_new_user() (abajo) consume el renglon la primera vez
-- que esa persona inicia sesion -- de ahi en adelante ya vive en `perfiles`.
create table if not exists invitaciones (
  email text primary key,
  nombre text not null default '',
  rol text not null default 'asesor' check (rol in ('admin', 'asesor', 'administrativo')),
  invitado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table invitaciones enable row level security;

grant select, insert, delete on invitaciones to authenticated;

drop policy if exists "solo un admin ve y gestiona invitaciones" on invitaciones;
create policy "solo un admin ve y gestiona invitaciones"
  on invitaciones for all
  to authenticated
  using (is_admin())
  with check (is_admin());

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

drop policy if exists "cada quien lee su propio perfil, admin lee todos" on perfiles;
create policy "cada quien lee su propio perfil, admin lee todos"
  on perfiles for select
  using (auth.uid() = id or is_admin());

drop policy if exists "cada quien edita su propio perfil" on perfiles;
drop policy if exists "cada quien edita su propio perfil, admin edita cualquiera" on perfiles;
create policy "cada quien edita su propio perfil, admin edita cualquiera"
  on perfiles for update
  using (auth.uid() = id or is_admin());

-- La policy de arriba deja que cada quien haga UPDATE de su propio renglon
-- (por ejemplo para su "nombre" o para poner activado_en al crear su
-- contraseña), pero rol/activo son sensibles -- sin este trigger, cualquier
-- asesor podria auto-ascenderse a admin llamando la REST API directo con su
-- propio id (pasaria la policy porque auth.uid() = id es cierto). El trigger
-- corre para TODOS los UPDATE sin importar la policy, y tira error si
-- alguien que no sea admin intenta tocar esas dos columnas.
create or replace function proteger_rol_perfil()
returns trigger as $$
begin
  if not is_admin() and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
    raise exception 'solo un admin puede cambiar el rol o el estado activo de un asesor';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_perfil_updated on perfiles;
create trigger on_perfil_updated
  before update on perfiles
  for each row execute function proteger_rol_perfil();

-- Crea el perfil automáticamente al primer login CON GOOGLE -- pero solo si
-- ese correo ya estaba en `invitaciones` (puesto ahi por un admin desde el
-- panel). Si no, se aborta la creacion del usuario por completo (la
-- excepcion revierte todo, incluyendo el insert en auth.users que dispara
-- este trigger) -- asi cualquiera con cuenta de Google que NO fue invitado
-- se queda afuera, sin importar que intente entrar directo a la API.
create or replace function handle_new_user()
returns trigger as $$
declare
  inv invitaciones%rowtype;
begin
  select * into inv from invitaciones where lower(email) = lower(new.email);
  if inv.email is null then
    raise exception 'correo_no_autorizado: % no esta en la lista de invitaciones', new.email;
  end if;

  insert into public.perfiles (id, nombre, rol, email)
  values (
    new.id,
    coalesce(nullif(inv.nombre, ''), new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    inv.rol,
    new.email
  );

  delete from invitaciones where email = inv.email;
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

drop policy if exists "todos ven las publicadas, cada quien ve tambien las suyas" on propiedades_manual;
create policy "todos ven las publicadas, cada quien ve tambien las suyas"
  on propiedades_manual for select
  using (estado = 'disponible' or asesor_id = auth.uid() or is_admin());

drop policy if exists "cada asesor crea sus propias fichas" on propiedades_manual;
create policy "cada asesor crea sus propias fichas"
  on propiedades_manual for insert
  with check (asesor_id = auth.uid());

drop policy if exists "cada asesor edita las suyas, admin edita todas" on propiedades_manual;
create policy "cada asesor edita las suyas, admin edita todas"
  on propiedades_manual for update
  using (asesor_id = auth.uid() or is_admin());

drop policy if exists "cada asesor borra las suyas, admin borra todas" on propiedades_manual;
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

drop policy if exists "cualquiera puede ver las fotos (bucket publico)" on storage.objects;
create policy "cualquiera puede ver las fotos (bucket publico)"
  on storage.objects for select
  using (bucket_id = 'propiedades-manual');

drop policy if exists "un asesor autenticado puede subir sus fotos" on storage.objects;
create policy "un asesor autenticado puede subir sus fotos"
  on storage.objects for insert
  with check (bucket_id = 'propiedades-manual' and auth.role() = 'authenticated');

drop policy if exists "un asesor autenticado puede borrar fotos que subio" on storage.objects;
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
drop policy if exists "todo asesor autenticado ve todos los leads" on leads;
create policy "todo asesor autenticado ve todos los leads"
  on leads for select
  to authenticated
  using (true);

drop policy if exists "todo asesor autenticado puede tomar/mover cualquier lead" on leads;
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

-- ------------------------------------------------------------------ tareas
-- Pendientes/recordatorios de cada asesor (llamar a alguien, subir fotos,
-- dar seguimiento...). Ligados opcionalmente a un contacto o propiedad,
-- pero funcionan igual de bien sueltos -- no todo pendiente tiene un
-- contacto o propiedad detrás.
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  vence timestamptz,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  lead_id uuid references leads(id) on delete set null,
  propiedad_id uuid references propiedades_manual(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table tareas enable row level security;

grant select, insert, update, delete on tareas to authenticated;

drop policy if exists "cada quien ve y gestiona sus propias tareas, admin ve todas" on tareas;
create policy "cada quien ve y gestiona sus propias tareas, admin ve todas"
  on tareas for select
  using (asesor_id = auth.uid() or is_admin());

drop policy if exists "cada quien crea sus propias tareas" on tareas;
create policy "cada quien crea sus propias tareas"
  on tareas for insert
  with check (asesor_id = auth.uid());

drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (upd)" on tareas;
create policy "cada quien edita/borra sus propias tareas, admin todas (upd)"
  on tareas for update
  using (asesor_id = auth.uid() or is_admin());

drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (del)" on tareas;
create policy "cada quien edita/borra sus propias tareas, admin todas (del)"
  on tareas for delete
  using (asesor_id = auth.uid() or is_admin());

drop trigger if exists on_tarea_updated on tareas;
create trigger on_tarea_updated
  before update on tareas
  for each row execute function set_actualizado_en();

-- ------------------------------------------------------------------ NOTAS
-- 1. Login es SOLO con Google (sin contraseñas). Antes de que nadie pueda
--    entrar, hay que activar el proveedor de Google en Supabase:
--      a. Google Cloud Console → crea un OAuth Client ID (tipo "Web
--         application"). En "Authorized redirect URIs" pon EXACTAMENTE:
--         https://vjhchuofznfupkpkepky.supabase.co/auth/v1/callback
--      b. Supabase Dashboard → Authentication → Providers → Google → pega
--         el Client ID y Client Secret de arriba → Enable → Save.
-- 2. Después de correr este script, invita a Gio como primer admin (correr
--    en el SQL Editor, con su correo real de Google):
--      insert into invitaciones (email, nombre, rol)
--      values ('CORREO-REAL-DE-GIO@gmail.com', 'Gio Filio', 'admin');
--    Con eso, la próxima vez que Gio entre al panel y de clic en "Iniciar
--    sesión con Google" con ese correo, su cuenta se crea sola como admin.
-- 3. De ahí en adelante, invitar a alguien más ya no requiere SQL — se hace
--    desde el panel, pestaña "Equipo" → "+ Invitar asesor" (cualquier admin
--    puede hacerlo).
-- 4. Para que "Contactos" reciba leads reales, agrega en Vercel (Project
--    Settings → Environment Variables) las mismas SUPABASE_URL y
--    SUPABASE_SERVICE_ROLE_KEY que ya usa el GitHub Action de sync-manual.
--    (Invitar asesores ya NO necesita esto -- es un insert normal a la
--    tabla `invitaciones`, protegido por RLS con is_admin().)
