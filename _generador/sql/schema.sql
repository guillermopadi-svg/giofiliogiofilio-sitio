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
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

grant execute on function is_admin() to authenticated;

-- Auditoria de seguridad 2026-09-11 (GIO-004): desactivar a un asesor
-- (perfiles.activo = false) antes solo lo sacaba del panel la PROXIMA vez
-- que cargaba /admin/ -- su token de Supabase seguia siendo valido y ninguna
-- policy de leads/propiedades_manual/tareas/estudios_precio revisaba
-- `activo`, asi que seguia pudiendo leer/escribir todo eso llamando la REST
-- API directo. is_activo() cierra eso a nivel de base de datos: se usa en
-- todas las policies de "dueno del renglon" de aqui en adelante.
create or replace function is_activo()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select activo from perfiles where id = auth.uid()), false);
$$;

grant execute on function is_activo() to authenticated;

-- Antes solo veias tu propio perfil (o todos si eras admin) -- se abrio a
-- "cualquier activo ve a todo el equipo" porque el @mencionar en
-- tarea_comentarios necesita poder listar/nombrar a cualquier compañero,
-- no solo a uno mismo.
drop policy if exists "cada quien lee su propio perfil, admin lee todos" on perfiles;
drop policy if exists "cualquier activo ve a todo el equipo, admin ve todos" on perfiles;
create policy "cualquier activo ve a todo el equipo, admin ve todos"
  on perfiles for select
  using (is_activo() or is_admin() or auth.uid() = id);

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

-- ------------------------------------------------ inventario de EasyBroker
-- Antes de esto, las propiedades de EasyBroker (RE/MAX Blue) vivian SOLO
-- como codigo Python (_generador/data_props_live.py) -- nunca tocaban
-- Supabase, asi que el panel no las veia. importar_easybroker_a_panel.py
-- (corre a diario junto con sync_easybroker.py) las trae aqui para que
-- cualquier asesor las pueda editar desde /admin/, sin perder el
-- refresco automatico diario de EasyBroker para las que nadie ha tocado.
alter table propiedades_manual add column if not exists easybroker_id text unique;
alter table propiedades_manual add column if not exists bloqueado_por_panel boolean not null default false;
alter table propiedades_manual add column if not exists moneda text not null default 'MXN';
alter table propiedades_manual add column if not exists calle text not null default '';
alter table propiedades_manual add column if not exists cp text not null default '';
alter table propiedades_manual add column if not exists lat numeric;
alter table propiedades_manual add column if not exists lng numeric;
alter table propiedades_manual add column if not exists antig int not null default 0;
alter table propiedades_manual add column if not exists piso text not null default '';
alter table propiedades_manual add column if not exists niveles int not null default 0;
alter table propiedades_manual add column if not exists badges text[] not null default '{}';
-- Para propiedades de EasyBroker fuera del catalogo de colonias con
-- pagina propia (fuera de CDMX, o una colonia de CDMX sin pagina) --
-- sin esto, fetch_manual_props.py no tiene forma de reconstruir su
-- nombre real y las omite por completo al regenerar el sitio (404).
alter table propiedades_manual add column if not exists colonia_nombre_real text not null default '';
alter table propiedades_manual add column if not exists alcaldia_real text not null default '';
alter table propiedades_manual add column if not exists estado_real text not null default '';
alter table propiedades_manual add column if not exists sin_pagina boolean not null default false;
alter table propiedades_manual add column if not exists fuera_cdmx boolean not null default false;

alter table propiedades_manual enable row level security;

grant select, insert, update, delete on propiedades_manual to authenticated;
grant select, insert, update on propiedades_manual to service_role;

drop policy if exists "todos ven las publicadas, cada quien ve tambien las suyas" on propiedades_manual;
create policy "todos ven las publicadas, cada quien ve tambien las suyas"
  on propiedades_manual for select
  using (estado = 'disponible' or (is_activo() and (asesor_id = auth.uid() or is_admin())));

drop policy if exists "cada asesor crea sus propias fichas" on propiedades_manual;
create policy "cada asesor crea sus propias fichas"
  on propiedades_manual for insert
  with check (is_activo() and asesor_id = auth.uid());

-- "or easybroker_id is not null": una ficha importada de EasyBroker no
-- pertenece a ningun asesor en particular -- cualquiera activo la puede
-- editar, sin importar quien haya quedado como asesor_id nominal.
drop policy if exists "cada asesor edita las suyas, admin edita todas" on propiedades_manual;
create policy "cada asesor edita las suyas, admin edita todas"
  on propiedades_manual for update
  using (is_activo() and (asesor_id = auth.uid() or is_admin() or easybroker_id is not null));

drop policy if exists "cada asesor borra las suyas, admin borra todas" on propiedades_manual;
create policy "cada asesor borra las suyas, admin borra todas"
  on propiedades_manual for delete
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

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
  with check (bucket_id = 'propiedades-manual' and auth.role() = 'authenticated' and is_activo());

drop policy if exists "un asesor autenticado puede borrar fotos que subio" on storage.objects;
create policy "un asesor autenticado puede borrar fotos que subio"
  on storage.objects for delete
  using (bucket_id = 'propiedades-manual' and auth.uid() = owner and is_activo());

-- Auditoria de seguridad 2026-09-11 (GIO-001): antes cualquiera podia subir
-- cualquier tipo/tamano de archivo a este bucket publico. Se restringe a
-- imagenes y 8 MB por archivo -- suficiente para fotos de propiedades.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'],
    file_size_limit = 8388608
where id = 'propiedades-manual';

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
  using (is_activo());

drop policy if exists "todo asesor autenticado puede tomar/mover cualquier lead" on leads;
create policy "todo asesor autenticado puede tomar/mover cualquier lead"
  on leads for update
  to authenticated
  using (is_activo())
  with check (is_activo());

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

-- Las tareas eran privadas (solo dueño + admin) hasta que se agrego el
-- seguimiento por comentarios/menciones entre asesores -- para que alguien
-- pueda comentar/dar seguimiento en una tarea de otro, primero necesita
-- poder verla, asi que ahora es un pipeline compartido de todo el equipo
-- activo (ver tarea_comentarios abajo).
drop policy if exists "cada quien ve y gestiona sus propias tareas, admin ve todas" on tareas;
drop policy if exists "cualquier asesor activo ve todas las tareas del equipo" on tareas;
create policy "cualquier asesor activo ve todas las tareas del equipo"
  on tareas for select
  using (is_activo());

drop policy if exists "cada quien crea sus propias tareas" on tareas;
create policy "cada quien crea sus propias tareas"
  on tareas for insert
  with check (is_activo() and asesor_id = auth.uid());

drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (upd)" on tareas;
create policy "cada quien edita/borra sus propias tareas, admin todas (upd)"
  on tareas for update
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (del)" on tareas;
create policy "cada quien edita/borra sus propias tareas, admin todas (del)"
  on tareas for delete
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

drop trigger if exists on_tarea_updated on tareas;
create trigger on_tarea_updated
  before update on tareas
  for each row execute function set_actualizado_en();

-- ------------------------------------------------------- tarea_comentarios
-- Hilo de seguimiento tipo Slack debajo de cada tarea -- cualquier asesor
-- activo puede comentar en cualquier tarea (ya son visibles a todo el
-- equipo, ver policy de select en tareas arriba). `menciones` guarda los
-- ids de perfiles mencionados con @; `leido_por` guarda quien de esos
-- mencionados ya vio el comentario (asi se calcula el badge de "@menciones
-- sin leer" sin necesitar tiempo real, solo se recalcula al cargar/entrar).
create table if not exists tarea_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references tareas(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  menciones uuid[] not null default '{}',
  leido_por uuid[] not null default '{}',
  creado_en timestamptz not null default now()
);

alter table tarea_comentarios enable row level security;

grant select, insert, update, delete on tarea_comentarios to authenticated;

drop policy if exists "cualquier asesor activo ve los comentarios" on tarea_comentarios;
create policy "cualquier asesor activo ve los comentarios"
  on tarea_comentarios for select
  using (is_activo());

drop policy if exists "cualquier asesor activo comenta" on tarea_comentarios;
create policy "cualquier asesor activo comenta"
  on tarea_comentarios for insert
  with check (is_activo() and autor_id = auth.uid());

-- El UPDATE solo existe para que un mencionado se agregue a si mismo en
-- leido_por (marcar la mencion como vista) -- el trigger de abajo bloquea
-- cualquier intento de tocar el texto/autor/menciones ya guardados.
drop policy if exists "cualquier asesor activo marca como leido" on tarea_comentarios;
create policy "cualquier asesor activo marca como leido"
  on tarea_comentarios for update
  using (is_activo())
  with check (is_activo());

drop policy if exists "cada quien borra su comentario, admin cualquiera" on tarea_comentarios;
create policy "cada quien borra su comentario, admin cualquiera"
  on tarea_comentarios for delete
  using (is_activo() and (autor_id = auth.uid() or is_admin()));

-- Sin esto, la policy de update de arriba (necesaria para que cualquiera
-- pueda marcar una mencion como leida) tambien dejaria editar el texto de
-- un comentario ajeno via la REST API directo -- este trigger corre para
-- TODO update sin importar la policy y tira error si algo aparte de
-- leido_por esta cambiando.
create or replace function proteger_comentario_tarea()
returns trigger as $$
begin
  if new.texto is distinct from old.texto
    or new.autor_id is distinct from old.autor_id
    or new.tarea_id is distinct from old.tarea_id
    or new.menciones is distinct from old.menciones
    or new.creado_en is distinct from old.creado_en then
    raise exception 'un comentario ya guardado no se puede editar, solo marcar como leido';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_tarea_comentario_updated on tarea_comentarios;
create trigger on_tarea_comentario_updated
  before update on tarea_comentarios
  for each row execute function proteger_comentario_tarea();

-- ---------------------------------------------------- TAREAS COMO WORKSPACE
-- Evolucion del modulo de Tareas: antes "responsable" (asesor_id) y "quien la
-- creo" eran siempre la misma persona porque solo podias crear tareas para ti
-- mismo. `creado_por` separa ambos roles para poder asignarle una tarea a
-- alguien mas ("Gio asigna a Carlos") sin perder de vista quien la genero.
alter table tareas add column if not exists creado_por uuid references auth.users(id) on delete set null;
update tareas set creado_por = asesor_id where creado_por is null;

alter table tareas add column if not exists prioridad text not null default 'normal'
  check (prioridad in ('baja', 'normal', 'alta'));

-- Antes solo se podia crear una tarea para uno mismo (with check asesor_id =
-- auth.uid()) -- se abre para poder asignarla a otro asesor del equipo
-- (equipo chico, misma confianza que ya existe para ver/comentar cualquier
-- tarea). creado_por = auth.uid() sigue siendo obligatorio, asi que siempre
-- queda registro real de quien la genero, sin importar a quien se la asigne.
drop policy if exists "cada quien crea sus propias tareas" on tareas;
create policy "cualquier asesor activo crea tareas, para si mismo o para otro"
  on tareas for insert
  with check (is_activo() and creado_por = auth.uid());

-- Se agrega "or creado_por = auth.uid()" -- quien genero/asigno la tarea
-- tambien puede editarla o borrarla despues, ademas del responsable actual
-- y de un admin.
drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (upd)" on tareas;
create policy "responsable, creador o admin editan"
  on tareas for update
  using (is_activo() and (asesor_id = auth.uid() or creado_por = auth.uid() or is_admin()));

drop policy if exists "cada quien edita/borra sus propias tareas, admin todas (del)" on tareas;
create policy "responsable, creador o admin borran"
  on tareas for delete
  using (is_activo() and (asesor_id = auth.uid() or creado_por = auth.uid() or is_admin()));

-- `tarea_comentarios` se reusa como el feed de actividad completo de la
-- tarea, no solo comentarios humanos: `tipo='sistema'` son eventos generados
-- por la app misma (cambio de estado, reasignacion, prioridad...), con
-- `metadata` guardando el detalle estructurado (ej. {"campo":"estado","de":
-- "pendiente","a":"hecha"}) para poder redactar el texto en el momento que
-- se necesite sin perder el dato crudo. autor_id de una fila de sistema es
-- quien disparo la accion (no un usuario "sistema" generico) -- asi la
-- policy de insert existente (autor_id = auth.uid()) sirve tal cual, sin
-- policy nueva ni usuario tecnico.
alter table tarea_comentarios add column if not exists tipo text not null default 'comentario'
  check (tipo in ('comentario', 'sistema'));
alter table tarea_comentarios add column if not exists metadata jsonb not null default '{}'::jsonb;

-- proteger_comentario_tarea (arriba) no cubria tipo/metadata porque no
-- existian cuando se escribio -- se amplia para que tampoco se puedan
-- alterar despues de creado un evento, por la misma razon que ya aplica a
-- texto/autor_id/menciones: la unica mutacion legitima de una fila ya
-- guardada es agregarse a leido_por.
create or replace function proteger_comentario_tarea()
returns trigger as $$
begin
  if new.texto is distinct from old.texto
    or new.autor_id is distinct from old.autor_id
    or new.tarea_id is distinct from old.tarea_id
    or new.menciones is distinct from old.menciones
    or new.creado_en is distinct from old.creado_en
    or new.tipo is distinct from old.tipo
    or new.metadata is distinct from old.metadata
    or new.archivos is distinct from old.archivos then
    raise exception 'un comentario ya guardado no se puede editar, solo marcar como leido';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Cada comentario (de tareas o de propiedades) puede llevar archivos
-- adjuntos -- no solo fotos como en los buckets existentes, tambien PDFs/
-- Excel/Word (contratos, identificaciones, comparativos...).
alter table tarea_comentarios add column if not exists archivos jsonb not null default '[]'::jsonb;

-- --------------------------------------------------- PROPIEDAD_COMENTARIOS
-- Mismo patron que tarea_comentarios (hilo tipo Slack, comentarios humanos +
-- eventos de sistema, @menciones, adjuntos) pero anclado a una propiedad en
-- vez de una tarea -- sirve tanto para coordinacion interna del equipo sobre
-- esa ficha como para llevar registro de la comunicacion con el vendedor
-- (tipo='vendedor' marca esas interacciones sin ser un comentario del
-- equipo). Es tabla aparte (no polimorfica con tarea_comentarios) porque
-- quien puede VER una propiedad sigue reglas distintas a quien ve una tarea
-- (propiedades_manual restringe por asesor_id/estado; tareas es bandeja
-- compartida de todo el equipo) -- mezclar ambas en una sola tabla
-- complicaria las policies sin necesidad real.
create table if not exists propiedad_comentarios (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references propiedades_manual(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null default '',
  tipo text not null default 'comentario' check (tipo in ('comentario', 'sistema', 'vendedor')),
  menciones uuid[] not null default '{}',
  leido_por uuid[] not null default '{}',
  archivos jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now()
);

alter table propiedad_comentarios enable row level security;

grant select, insert, update, delete on propiedad_comentarios to authenticated;

-- "Quien puede ver la propiedad" repite exactamente la formula de la policy
-- de select de propiedades_manual (arriba) -- si cambia alla, debe cambiar
-- aqui tambien.
drop policy if exists "quien puede ver la propiedad ve su hilo" on propiedad_comentarios;
create policy "quien puede ver la propiedad ve su hilo"
  on propiedad_comentarios for select
  using (exists (
    select 1 from propiedades_manual p
    where p.id = propiedad_comentarios.propiedad_id
      and (p.estado = 'disponible' or (is_activo() and (p.asesor_id = auth.uid() or is_admin())))
  ));

drop policy if exists "quien puede ver la propiedad comenta" on propiedad_comentarios;
create policy "quien puede ver la propiedad comenta"
  on propiedad_comentarios for insert
  with check (
    is_activo() and autor_id = auth.uid() and exists (
      select 1 from propiedades_manual p
      where p.id = propiedad_comentarios.propiedad_id
        and (p.estado = 'disponible' or (is_activo() and (p.asesor_id = auth.uid() or is_admin())))
    )
  );

-- El UPDATE solo existe para marcar un comentario como leido (igual que en
-- tarea_comentarios) -- el trigger de abajo bloquea cualquier otro cambio.
drop policy if exists "quien puede ver la propiedad marca como leido" on propiedad_comentarios;
create policy "quien puede ver la propiedad marca como leido"
  on propiedad_comentarios for update
  using (exists (
    select 1 from propiedades_manual p
    where p.id = propiedad_comentarios.propiedad_id
      and (p.estado = 'disponible' or (is_activo() and (p.asesor_id = auth.uid() or is_admin())))
  ))
  with check (is_activo());

drop policy if exists "cada quien borra su comentario de propiedad, admin cualquiera" on propiedad_comentarios;
create policy "cada quien borra su comentario de propiedad, admin cualquiera"
  on propiedad_comentarios for delete
  using (is_activo() and (autor_id = auth.uid() or is_admin()));

create or replace function proteger_comentario_propiedad()
returns trigger as $$
begin
  if new.texto is distinct from old.texto
    or new.autor_id is distinct from old.autor_id
    or new.propiedad_id is distinct from old.propiedad_id
    or new.menciones is distinct from old.menciones
    or new.creado_en is distinct from old.creado_en
    or new.tipo is distinct from old.tipo
    or new.archivos is distinct from old.archivos then
    raise exception 'un comentario ya guardado no se puede editar, solo marcar como leido';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_propiedad_comentario_updated on propiedad_comentarios;
create trigger on_propiedad_comentario_updated
  before update on propiedad_comentarios
  for each row execute function proteger_comentario_propiedad();

-- ------------------------------------------------------------- PANEL_ADJUNTOS
-- Bucket compartido para archivos adjuntos a comentarios (de tareas o de
-- propiedades) -- separado de `propiedades-manual`/`solicitudes-alta` porque
-- aqui SI se permiten documentos (PDF/Word/Excel), no solo imagenes.
insert into storage.buckets (id, name, public)
values ('panel-adjuntos', 'panel-adjuntos', true)
on conflict (id) do nothing;

drop policy if exists "cualquiera puede ver los adjuntos (bucket publico)" on storage.objects;
create policy "cualquiera puede ver los adjuntos (bucket publico)"
  on storage.objects for select
  using (bucket_id = 'panel-adjuntos');

drop policy if exists "un asesor activo puede subir adjuntos" on storage.objects;
create policy "un asesor activo puede subir adjuntos"
  on storage.objects for insert
  with check (bucket_id = 'panel-adjuntos' and auth.role() = 'authenticated' and is_activo());

drop policy if exists "un asesor activo puede borrar adjuntos que subio" on storage.objects;
create policy "un asesor activo puede borrar adjuntos que subio"
  on storage.objects for delete
  using (bucket_id = 'panel-adjuntos' and auth.uid() = owner and is_activo());

-- Mismo criterio de seguridad que GIO-001 (propiedades-manual/solicitudes-alta):
-- tipo y tamano de archivo restringidos desde el dia uno, no despues de un
-- hallazgo de auditoria. La lista cubre "cualquier documento de oficina" en
-- la practica (fotos, PDF, Word, Excel/CSV, lo que exporta Google Sheets/
-- Docs/Slides, PowerPoint, texto plano) -- se deja fuera .zip/.exe y otros
-- ejecutables/comprimidos, que no tienen uso legitimo aqui y son el vector
-- clasico para convertir un bucket publico en hosting de malware. Tope mas
-- alto que las fotos (20 MB) porque aqui tambien van PDFs de contratos
-- escaneados.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
      'application/pdf','text/plain','text/csv',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.text',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ],
    file_size_limit = 20971520
where id = 'panel-adjuntos';

-- ------------------------------------------------------------------ REALTIME
-- Sin esto, un comentario/reasignacion de un compañero solo se veia al
-- recargar la pagina -- el panel se suscribe a estas 3 tablas via
-- supabase-js (`sb.channel(...).on('postgres_changes', ...)`, ver admin.js
-- funcion iniciarRealtime). "add table" truena si la tabla ya esta en la
-- publicacion, asi que se checa antes -- mismo espiritu "seguro de volver a
-- correr" que el resto del archivo.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tarea_comentarios') then
    alter publication supabase_realtime add table tarea_comentarios;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'propiedad_comentarios') then
    alter publication supabase_realtime add table propiedad_comentarios;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tareas') then
    alter publication supabase_realtime add table tareas;
  end if;
end $$;

-- ------------------------------------------------------------ solicitudes_alta
-- Formulario público de alta de propiedad (/alta-propiedad/) -- lo llena
-- directo el dueño de la propiedad, sin necesidad de cuenta ni login. Vive
-- separada de `propiedades_manual` a propósito: el INSERT es publico (anon),
-- pero SELECT/UPDATE/DELETE quedan solo para el equipo autenticado -- un
-- asesor revisa la solicitud en el panel (pestaña "Solicitudes") y, si
-- procede, la pasa a mano a `propiedades_manual` para publicarla.
create table if not exists solicitudes_alta (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null default '',
  telefono text not null default '',
  email text not null default '',
  operacion text not null check (operacion in ('venta', 'renta')),
  tipo text not null,
  precio numeric not null default 0,
  calle text not null default '',
  numero text not null default '',
  colonia text not null default '',
  alcaldia text not null default '',
  cp text not null default '',
  rec int not null default 0,
  ban int not null default 0,
  est int not null default 0,
  m2c int not null default 0,
  m2t int not null default 0,
  antig int not null default 0,
  hipoteca text not null default 'no_se' check (hipoteca in ('si', 'no', 'no_se')),
  hipoteca_detalle text not null default '',
  gravamen text not null default 'no_se' check (gravamen in ('si', 'no', 'no_se')),
  gravamen_detalle text not null default '',
  deuda_admin text not null default 'no_se' check (deuda_admin in ('si', 'no', 'no_se')),
  deuda_admin_detalle text not null default '',
  amenidades text[] not null default '{}',
  descripcion text not null default '',
  fotos text[] not null default '{}',
  estado text not null default 'nueva' check (estado in ('nueva', 'revisada', 'descartada', 'publicada')),
  notas_internas text not null default '',
  creado_en timestamptz not null default now()
);

alter table solicitudes_alta enable row level security;

grant insert on solicitudes_alta to anon;
grant select, insert, update, delete on solicitudes_alta to authenticated;
grant select, insert on solicitudes_alta to service_role;

drop policy if exists "cualquiera puede registrar una solicitud" on solicitudes_alta;
create policy "cualquiera puede registrar una solicitud"
  on solicitudes_alta for insert
  to anon
  with check (true);

drop policy if exists "solo el equipo autenticado ve y da seguimiento" on solicitudes_alta;
create policy "solo el equipo autenticado ve y da seguimiento"
  on solicitudes_alta for select
  to authenticated
  using (is_activo());

drop policy if exists "solo el equipo autenticado actualiza" on solicitudes_alta;
create policy "solo el equipo autenticado actualiza"
  on solicitudes_alta for update
  to authenticated
  using (is_activo());

drop policy if exists "solo el equipo autenticado borra" on solicitudes_alta;
create policy "solo el equipo autenticado borra"
  on solicitudes_alta for delete
  to authenticated
  using (is_activo());

-- Bucket separado del de asesores (`propiedades-manual`): aqui SI puede
-- subir cualquier visitante anonimo (es el mismo formulario publico), pero
-- solo puede insertar, nunca leer el listado, sobreescribir ni borrar --
-- evita que alguien use este bucket como hosting de archivos gratis.
insert into storage.buckets (id, name, public)
values ('solicitudes-alta', 'solicitudes-alta', true)
on conflict (id) do nothing;

drop policy if exists "cualquiera puede ver fotos de solicitudes (bucket publico)" on storage.objects;
create policy "cualquiera puede ver fotos de solicitudes (bucket publico)"
  on storage.objects for select
  using (bucket_id = 'solicitudes-alta');

-- to anon, authenticated: el mismo navegador que tiene sesion iniciada en
-- /admin/ comparte esa sesion con /alta-propiedad/ (mismo dominio) -- un
-- asesor probando o usando el formulario publico ya no entra como anon.
drop policy if exists "cualquier visitante puede subir foto a su solicitud" on storage.objects;
create policy "cualquier visitante puede subir foto a su solicitud"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'solicitudes-alta');

drop policy if exists "solo el equipo autenticado borra fotos de solicitudes" on storage.objects;
create policy "solo el equipo autenticado borra fotos de solicitudes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'solicitudes-alta' and is_activo());

-- Auditoria de seguridad 2026-09-11 (GIO-001, hallazgo principal): este
-- bucket es publico y el INSERT esta abierto a "anon" a proposito (es el
-- formulario publico, sin login) -- pero no tenia NINGUNA restriccion de
-- tipo o tamano de archivo, asi que cualquiera en internet podia usarlo
-- como hosting de archivos gratis llamando la Storage REST API directo,
-- sin pasar por el formulario. Se restringe a imagenes y 8 MB por archivo.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'],
    file_size_limit = 8388608
where id = 'solicitudes-alta';

-- ------------------------------------------------------------- estudios_precio
-- Digitaliza el estudio comparativo que Gio hacia a mano en Excel (liga,
-- ubicacion, m2, precio... de propiedades similares) para estimar un precio
-- real de venta o renta. Combina dos fuentes: el inventario propio (se
-- calcula al vuelo en el panel contra assets/data/propiedades.json, no se
-- guarda aqui) y comparables externos capturados a mano (si se guardan,
-- en la columna `comparables`).
create table if not exists estudios_precio (
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null default '',
  operacion text not null check (operacion in ('venta', 'renta')),
  tipo text not null,
  colonia text not null default '',
  m2c numeric not null default 0,
  m2t numeric not null default 0,                 -- m2 de terreno del sujeto -- junto con m2c arma el "m2 homologado" para comparar casas/terrenos con distinto tamano de terreno
  propiedades_mercado int not null default 0,     -- cuantas propiedades similares hay en el mercado -- el factor de negociacion usa este numero como %
  factor_publicar numeric not null default 55,    -- % del factor de negociacion que se resta al "valor asignado" para armar el precio de publicacion (el resto queda de margen para negociar hasta el precio de cierre)
  solicitud_id uuid references solicitudes_alta(id) on delete set null,
  propiedad_id uuid references propiedades_manual(id) on delete set null,
  comparables jsonb not null default '[]'::jsonb,
  notas text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table estudios_precio add column if not exists m2t numeric not null default 0;
-- Solo de referencia (ver notas del estudio) -- NO entra en ningun calculo,
-- tal como funciona en el Excel original de Gio ("Actualmente hay N
-- propiedades en X" es una nota, no una celda usada en formulas).
alter table estudios_precio add column if not exists propiedades_mercado int not null default 0;
-- El % que Gio escribe a mano para el factor de negociacion (antes se
-- calculaba mal como propiedades_mercado/100 -- se corrigio tras revisar
-- su Excel real: ese numero no tiene relacion con el conteo de arriba).
alter table estudios_precio add column if not exists factor_negociacion numeric not null default 0;
-- Margen que se SUMA al precio de cierre para sugerir el precio de
-- publicacion (antes se restaba del valor asignado -- formula equivocada,
-- corregida tras revisar el Excel real: factor_publicar = 5% ahi).
alter table estudios_precio add column if not exists factor_publicar numeric not null default 5;
-- add column if not exists no cambia el default de una columna que ya
-- existia (se creo antes con default 55) -- se corrige aparte.
alter table estudios_precio alter column factor_publicar set default 5;
-- Homologar (sumar terreno al m2 de construccion) es opcional: solo tiene
-- sentido cuando el terreno es mucho mas grande que lo construido (ej. un
-- terreno de 1000 m2 con 300 construidos) -- en departamentos/condominios
-- no suele aplicar. Default true para no cambiar el comportamiento de los
-- estudios que ya existian antes de esta columna.
alter table estudios_precio add column if not exists homologar_m2 boolean not null default true;
-- Cuando el estudio nace de una solicitud de alta (ver
-- crearEstudioDeSolicitud en admin.js), se copian aqui las fotos que el
-- propietario subio en el formulario publico -- solo para que el asesor
-- las vea de referencia dentro del estudio, NUNCA se incluyen en el PDF
-- exportado (ese va al cliente, no lleva fotos sin curar del propietario).
alter table estudios_precio add column if not exists fotos jsonb not null default '[]'::jsonb;

alter table estudios_precio enable row level security;

grant select, insert, update, delete on estudios_precio to authenticated;

drop policy if exists "cada quien ve y gestiona sus estudios, admin ve todos" on estudios_precio;
create policy "cada quien ve y gestiona sus estudios, admin ve todos"
  on estudios_precio for select
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

drop policy if exists "cada quien crea sus propios estudios" on estudios_precio;
create policy "cada quien crea sus propios estudios"
  on estudios_precio for insert
  with check (is_activo() and asesor_id = auth.uid());

drop policy if exists "cada quien edita/borra sus estudios, admin todos (upd)" on estudios_precio;
create policy "cada quien edita/borra sus estudios, admin todos (upd)"
  on estudios_precio for update
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

drop policy if exists "cada quien edita/borra sus estudios, admin todos (del)" on estudios_precio;
create policy "cada quien edita/borra sus estudios, admin todos (del)"
  on estudios_precio for delete
  using (is_activo() and (asesor_id = auth.uid() or is_admin()));

drop trigger if exists on_estudio_updated on estudios_precio;
create trigger on_estudio_updated
  before update on estudios_precio
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
