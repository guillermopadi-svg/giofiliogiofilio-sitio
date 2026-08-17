-- ============================================================================
-- Gio Filio — Tu espacio ideal
-- Esquema de base de datos · PostgreSQL 15+ / Supabase
--
-- Alcance: exclusivamente propiedades de la Ciudad de México.
-- Ejecutar en el SQL Editor de Supabase o con `psql -f SCHEMA.sql`.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;      -- geolocalización y búsqueda por radio
create extension if not exists pg_trgm;      -- autocomplete difuso de ubicaciones
create extension if not exists unaccent;     -- búsquedas sin acentos

-- ---------------------------------------------------------------- ENUMS
create type operacion_t        as enum ('venta', 'renta');
create type tipo_propiedad_t   as enum ('departamento','casa','casa-en-condominio','penthouse',
                                        'loft','terreno','oficina','local-comercial','desarrollo');
create type estado_publicacion_t as enum ('borrador','disponible','apartada','vendida','rentada','inactiva');
create type estado_inmueble_t   as enum ('nuevo','excelente','remodelado','por-remodelar');
create type lead_estado_t       as enum ('nuevo','contactado','calificado','visita_agendada',
                                         'en_negociacion','cerrado_ganado','cerrado_perdido','descartado');
create type lead_intencion_t    as enum ('comprar','rentar','vender','invertir','valuar','otro');

-- ============================================================ GEOGRAFÍA
-- Las 16 alcaldías oficiales de la Ciudad de México. Tabla cerrada por diseño.
create table alcaldias (
  id              smallint primary key,
  slug            text not null unique,
  nombre          text not null unique,
  lat             numeric(9,6) not null,
  lng             numeric(9,6) not null,
  resumen         text,
  perfil          text,
  vive            text,
  destacados      text[] default '{}',
  seo_title       text,
  seo_description text,
  hero_image      text,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  constraint alcaldia_en_cdmx check (lat between 19.00 and 19.60 and lng between -99.40 and -98.94)
);

create table colonias (
  id                uuid primary key default uuid_generate_v4(),
  alcaldia_id       smallint not null references alcaldias(id) on delete restrict,
  slug              text not null unique,
  nombre            text not null,
  codigos_postales  text[] not null default '{}',
  lat               numeric(9,6) not null,
  lng               numeric(9,6) not null,
  geom              geography(Point, 4326)
                    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  tagline           text,
  vivir             text,
  tipo_oferta       text,
  movilidad         text,
  restaurantes      text,
  parques           text,
  escuelas          text,
  servicios         text,
  -- Referencias de mercado, actualizadas periódicamente
  precio_m2_venta   integer check (precio_m2_venta > 0),
  precio_m2_renta   integer check (precio_m2_renta > 0),
  prioritaria       boolean not null default false,   -- ¿tiene landing SEO propia?
  hero_image        text,
  seo_title         text,
  seo_description   text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint colonia_en_cdmx check (lat between 19.00 and 19.60 and lng between -99.40 and -98.94),
  unique (alcaldia_id, nombre)
);
create index colonias_alcaldia_idx on colonias(alcaldia_id);
create index colonias_geom_idx     on colonias using gist(geom);
create index colonias_nombre_trgm  on colonias using gin (unaccent(nombre) gin_trgm_ops);

-- ============================================================ CATÁLOGOS
create table amenidades (
  slug       text primary key,
  nombre     text not null,
  categoria  text,          -- 'seguridad' | 'exterior' | 'comun' | 'interior' | 'accesibilidad'
  icono      text,
  orden      smallint not null default 100
);

-- ============================================================ EQUIPO
create table asesores (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  nombre         text not null,
  rol            text not null default 'Asesor Inmobiliario',
  bio            text,
  email          text unique,
  telefono       text,
  whatsapp       text,
  foto_url       text,
  avatar_url     text,
  instagram      text,
  facebook       text,
  linkedin       text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

-- ============================================================ PROPIEDADES
create table propiedades (
  id                    uuid primary key default uuid_generate_v4(),
  codigo                text not null unique,          -- GF-1024
  slug                  text not null unique,          -- departamento-polanco-terraza-gf1024

  titulo                text not null,
  descripcion           text not null,

  operacion             operacion_t not null,
  tipo                  tipo_propiedad_t not null,

  precio                numeric(14,2) not null check (precio > 0),
  moneda                char(3) not null default 'MXN' check (moneda in ('MXN','USD')),
  mantenimiento         numeric(12,2) default 0 check (mantenimiento >= 0),
  precio_negociable     boolean not null default false,

  -- Ubicación (siempre CDMX)
  calle                 text,
  numero_exterior       text,
  numero_interior       text,
  colonia_id            uuid not null references colonias(id) on delete restrict,
  alcaldia_id           smallint not null references alcaldias(id) on delete restrict,
  codigo_postal         text,
  lat                   numeric(9,6) not null,
  lng                   numeric(9,6) not null,
  geom                  geography(Point, 4326)
                        generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  ubicacion_exacta      boolean not null default false, -- si es false, se muestra aproximada

  -- Características
  recamaras             smallint default 0 check (recamaras >= 0),
  banos                 smallint default 0 check (banos >= 0),
  medios_banos          smallint default 0 check (medios_banos >= 0),
  estacionamientos      smallint default 0 check (estacionamientos >= 0),
  m2_construccion       numeric(10,2) check (m2_construccion >= 0),
  m2_terreno            numeric(10,2) check (m2_terreno >= 0),
  antiguedad_anios      smallint check (antiguedad_anios >= 0),
  piso                  smallint,
  niveles               smallint,
  estado_inmueble       estado_inmueble_t not null default 'excelente',

  -- Métrica derivada (usada para ordenar por precio/m²)
  precio_m2             numeric(12,2)
                        generated always as (
                          case when coalesce(m2_construccion, m2_terreno, 0) > 0
                               then precio / coalesce(nullif(m2_construccion,0), m2_terreno)
                          end
                        ) stored,

  -- Multimedia
  video_url             text,
  tour_virtual_url      text,
  plano_url             text,
  vista_360_url         text,

  -- Publicación
  estado                estado_publicacion_t not null default 'borrador',
  destacada             boolean not null default false,
  exclusiva             boolean not null default false,   -- exclusiva Gio Filio
  preventa              boolean not null default false,
  entrega_inmediata     boolean not null default false,
  oportunidad           boolean not null default false,

  asesor_id             uuid references asesores(id) on delete set null,
  publicado_en          timestamptz,
  actualizado_en        timestamptz not null default now(),
  creado_en             timestamptz not null default now(),

  -- SEO
  seo_title             text,
  seo_description       text,

  -- Búsqueda full-text en español
  busqueda              tsvector generated always as (
                          setweight(to_tsvector('spanish', coalesce(titulo,'')), 'A') ||
                          setweight(to_tsvector('spanish', coalesce(calle,'')),  'B') ||
                          setweight(to_tsvector('spanish', coalesce(descripcion,'')), 'C')
                        ) stored,

  constraint propiedad_en_cdmx check (lat between 19.00 and 19.60 and lng between -99.40 and -98.94),
  constraint superficie_requerida check (
    tipo = 'terreno' or coalesce(m2_construccion, 0) > 0
  )
);

create index propiedades_operacion_idx  on propiedades(operacion) where estado = 'disponible';
create index propiedades_tipo_idx       on propiedades(tipo)      where estado = 'disponible';
create index propiedades_colonia_idx    on propiedades(colonia_id);
create index propiedades_alcaldia_idx   on propiedades(alcaldia_id);
create index propiedades_precio_idx     on propiedades(precio)    where estado = 'disponible';
create index propiedades_precio_m2_idx  on propiedades(precio_m2) where estado = 'disponible';
create index propiedades_publicado_idx  on propiedades(publicado_en desc nulls last);
create index propiedades_geom_idx       on propiedades using gist(geom);
create index propiedades_busqueda_idx   on propiedades using gin(busqueda);
create index propiedades_destacada_idx  on propiedades(destacada, exclusiva) where estado = 'disponible';

-- Fotografías (orden explícito, portada única)
create table propiedad_fotos (
  id            uuid primary key default uuid_generate_v4(),
  propiedad_id  uuid not null references propiedades(id) on delete cascade,
  url           text not null,
  url_webp      text,
  url_thumb     text,
  alt           text not null,
  orden         smallint not null default 0,
  es_portada    boolean not null default false,
  ancho         integer,
  alto          integer,
  creado_en     timestamptz not null default now()
);
create index propiedad_fotos_idx on propiedad_fotos(propiedad_id, orden);
create unique index propiedad_una_portada
  on propiedad_fotos(propiedad_id) where es_portada;

create table propiedad_amenidades (
  propiedad_id   uuid not null references propiedades(id) on delete cascade,
  amenidad_slug  text not null references amenidades(slug) on delete cascade,
  primary key (propiedad_id, amenidad_slug)
);
create index propiedad_amenidades_slug_idx on propiedad_amenidades(amenidad_slug);

-- Características libres (texto), distintas de las amenidades catalogadas
create table propiedad_caracteristicas (
  id            uuid primary key default uuid_generate_v4(),
  propiedad_id  uuid not null references propiedades(id) on delete cascade,
  texto         text not null,
  orden         smallint not null default 0
);

-- ============================================================ LEADS / CRM
create table leads (
  id                 uuid primary key default uuid_generate_v4(),

  nombre             text not null,
  email              text,
  telefono           text,
  mensaje            text,

  intencion          lead_intencion_t not null default 'otro',
  propiedad_id       uuid references propiedades(id) on delete set null,
  colonia_id         uuid references colonias(id)    on delete set null,
  alcaldia_id        smallint references alcaldias(id) on delete set null,
  ciudad             text not null default 'Ciudad de México',

  -- Datos de la propiedad que el usuario quiere vender / valuar
  inmueble_tipo      tipo_propiedad_t,
  inmueble_m2        numeric(10,2),
  inmueble_recamaras smallint,
  inmueble_banos     smallint,
  inmueble_direccion text,
  precio_esperado    numeric(14,2),
  valuacion_min      numeric(14,2),
  valuacion_max      numeric(14,2),

  -- Atribución
  formulario         text not null,      -- ficha_propiedad | contacto_general | valuacion | vender_propiedad
  fuente             text not null,      -- sitio_web | landing_vender | herramienta_valuacion …
  url_origen         text,
  referrer           text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_content        text,
  utm_term           text,
  gclid              text,
  fbclid             text,

  -- Gestión
  estado             lead_estado_t not null default 'nuevo',
  asesor_id          uuid references asesores(id) on delete set null,
  notas              text,
  consentimiento     boolean not null default false,
  consentimiento_en  timestamptz,
  crm_externo_id     text,               -- id en HubSpot u otro CRM

  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
create index leads_estado_idx     on leads(estado, creado_en desc);
create index leads_propiedad_idx  on leads(propiedad_id);
create index leads_campana_idx    on leads(utm_campaign, utm_source);
create index leads_creado_idx     on leads(creado_en desc);

create table lead_eventos (
  id         uuid primary key default uuid_generate_v4(),
  lead_id    uuid not null references leads(id) on delete cascade,
  tipo       text not null,       -- nota | llamada | whatsapp | correo | visita | cambio_estado
  detalle    text,
  asesor_id  uuid references asesores(id) on delete set null,
  creado_en  timestamptz not null default now()
);
create index lead_eventos_idx on lead_eventos(lead_id, creado_en desc);

create table visitas (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid not null references leads(id) on delete cascade,
  propiedad_id  uuid not null references propiedades(id) on delete cascade,
  asesor_id     uuid references asesores(id) on delete set null,
  programada_en timestamptz not null,
  estado        text not null default 'programada',  -- programada | confirmada | realizada | cancelada
  notas         text,
  creado_en     timestamptz not null default now()
);
create index visitas_fecha_idx on visitas(programada_en);

-- ============================================================ USUARIOS
-- Estructura preparada para cuentas de usuario. Mientras no existan,
-- el sitio guarda favoritos y comparador en localStorage.
create table usuarios (
  id          uuid primary key default uuid_generate_v4(),  -- = auth.users.id en Supabase
  email       text unique,
  nombre      text,
  telefono    text,
  creado_en   timestamptz not null default now()
);

create table favoritos (
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  propiedad_id  uuid not null references propiedades(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  primary key (usuario_id, propiedad_id)
);

create table busquedas_guardadas (
  id           uuid primary key default uuid_generate_v4(),
  usuario_id   uuid not null references usuarios(id) on delete cascade,
  nombre       text,
  filtros      jsonb not null,
  alertas      boolean not null default true,   -- avisar cuando entre inventario que coincida
  creado_en    timestamptz not null default now()
);

-- ============================================================ CONTENIDO
create table articulos (
  id               uuid primary key default uuid_generate_v4(),
  slug             text not null unique,
  titulo           text not null,
  resumen          text not null,
  cuerpo           jsonb not null,       -- [{titulo, parrafos[]}]
  categoria        text not null,
  minutos_lectura  smallint,
  hero_image       text,
  autor_id         uuid references asesores(id) on delete set null,
  publicado        boolean not null default false,
  publicado_en     date,
  seo_title        text,
  seo_description  text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index articulos_categoria_idx on articulos(categoria, publicado_en desc);

create table testimonios (
  id           uuid primary key default uuid_generate_v4(),
  nombre       text not null,
  contexto     text,
  texto        text not null,
  colonia_id   uuid references colonias(id) on delete set null,
  publicado    boolean not null default true,
  orden        smallint not null default 100,
  creado_en    timestamptz not null default now()
);

-- ============================================================ TRIGGERS
create or replace function tocar_actualizado_en() returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_propiedades_touch before update on propiedades
  for each row execute function tocar_actualizado_en();
create trigger trg_leads_touch       before update on leads
  for each row execute function tocar_actualizado_en();
create trigger trg_colonias_touch    before update on colonias
  for each row execute function tocar_actualizado_en();
create trigger trg_articulos_touch   before update on articulos
  for each row execute function tocar_actualizado_en();

-- Coherencia: la alcaldía de la propiedad debe ser la de su colonia
create or replace function validar_alcaldia_propiedad() returns trigger as $$
declare
  alc smallint;
begin
  select alcaldia_id into alc from colonias where id = new.colonia_id;
  if alc is null then
    raise exception 'La colonia % no existe', new.colonia_id;
  end if;
  new.alcaldia_id := alc;
  return new;
end;
$$ language plpgsql;

create trigger trg_propiedad_alcaldia before insert or update of colonia_id on propiedades
  for each row execute function validar_alcaldia_propiedad();

-- ============================================================ VISTAS
create or replace view v_propiedades_publicas as
select
  p.id, p.codigo, p.slug, p.titulo, p.descripcion,
  p.operacion, p.tipo, p.precio, p.moneda, p.mantenimiento, p.precio_m2,
  p.recamaras, p.banos, p.medios_banos, p.estacionamientos,
  p.m2_construccion, p.m2_terreno, p.antiguedad_anios, p.piso, p.estado_inmueble,
  p.lat, p.lng, p.codigo_postal, p.calle,
  c.slug  as colonia_slug,  c.nombre as colonia_nombre,
  a.slug  as alcaldia_slug, a.nombre as alcaldia_nombre,
  'Ciudad de México'::text as ciudad,
  p.destacada, p.exclusiva, p.preventa, p.entrega_inmediata, p.oportunidad,
  p.publicado_en, p.actualizado_en,
  (select url from propiedad_fotos f
    where f.propiedad_id = p.id order by f.es_portada desc, f.orden limit 1) as foto_portada,
  (select array_agg(f.url order by f.orden) from propiedad_fotos f
    where f.propiedad_id = p.id) as fotos,
  (select array_agg(pa.amenidad_slug) from propiedad_amenidades pa
    where pa.propiedad_id = p.id) as amenidades
from propiedades p
join colonias  c on c.id = p.colonia_id
join alcaldias a on a.id = p.alcaldia_id
where p.estado = 'disponible';

-- Métricas de mercado por colonia, recalculadas a partir del inventario real
create or replace view v_mercado_colonia as
select
  c.slug, c.nombre, a.nombre as alcaldia,
  count(*) filter (where p.operacion = 'venta')  as en_venta,
  count(*) filter (where p.operacion = 'renta')  as en_renta,
  round(avg(p.precio_m2) filter (where p.operacion = 'venta')) as precio_m2_venta_real,
  round(avg(p.precio_m2) filter (where p.operacion = 'renta')) as precio_m2_renta_real,
  min(p.precio) filter (where p.operacion = 'venta') as precio_min_venta,
  max(p.precio) filter (where p.operacion = 'venta') as precio_max_venta
from colonias c
join alcaldias a on a.id = c.alcaldia_id
left join propiedades p on p.colonia_id = c.id and p.estado = 'disponible'
group by c.slug, c.nombre, a.nombre;

-- ============================================================ RLS (Supabase)
alter table propiedades            enable row level security;
alter table propiedad_fotos        enable row level security;
alter table propiedad_amenidades   enable row level security;
alter table colonias               enable row level security;
alter table alcaldias              enable row level security;
alter table articulos              enable row level security;
alter table testimonios            enable row level security;
alter table leads                  enable row level security;
alter table favoritos              enable row level security;
alter table busquedas_guardadas    enable row level security;

-- Lectura pública solo del inventario publicado
create policy "propiedades disponibles son públicas" on propiedades
  for select using (estado = 'disponible');
create policy "fotos de propiedades públicas" on propiedad_fotos
  for select using (exists (
    select 1 from propiedades p where p.id = propiedad_id and p.estado = 'disponible'));
create policy "amenidades de propiedades públicas" on propiedad_amenidades
  for select using (exists (
    select 1 from propiedades p where p.id = propiedad_id and p.estado = 'disponible'));
create policy "geografía pública"  on colonias   for select using (true);
create policy "alcaldías públicas" on alcaldias  for select using (true);
create policy "artículos publicados" on articulos for select using (publicado);
create policy "testimonios publicados" on testimonios for select using (publicado);

-- Los leads solo se insertan desde el cliente; nunca se leen
create policy "cualquiera puede enviar un lead" on leads
  for insert with check (true);

-- Favoritos y búsquedas: cada usuario ve únicamente los suyos
create policy "favoritos propios" on favoritos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "búsquedas propias" on busquedas_guardadas
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ============================================================ SEED MÍNIMO
insert into alcaldias (id, slug, nombre, lat, lng) values
  ( 1,'alvaro-obregon',         'Álvaro Obregón',        19.359500, -99.203300),
  ( 2,'azcapotzalco',           'Azcapotzalco',          19.484400, -99.184400),
  ( 3,'benito-juarez',          'Benito Juárez',         19.386100, -99.165300),
  ( 4,'coyoacan',               'Coyoacán',              19.346700, -99.161700),
  ( 5,'cuajimalpa-de-morelos',  'Cuajimalpa de Morelos', 19.357300, -99.298600),
  ( 6,'cuauhtemoc',             'Cuauhtémoc',            19.432600, -99.153300),
  ( 7,'gustavo-a-madero',       'Gustavo A. Madero',     19.483300, -99.113300),
  ( 8,'iztacalco',              'Iztacalco',             19.395600, -99.097200),
  ( 9,'iztapalapa',             'Iztapalapa',            19.357400, -99.066200),
  (10,'la-magdalena-contreras', 'La Magdalena Contreras',19.307800, -99.241900),
  (11,'miguel-hidalgo',         'Miguel Hidalgo',        19.432600, -99.195000),
  (12,'milpa-alta',             'Milpa Alta',            19.192200, -99.023100),
  (13,'tlahuac',                'Tláhuac',               19.287800, -99.005600),
  (14,'tlalpan',                'Tlalpan',               19.291100, -99.168300),
  (15,'venustiano-carranza',    'Venustiano Carranza',   19.424700, -99.109200),
  (16,'xochimilco',             'Xochimilco',            19.257200, -99.103100)
on conflict (id) do nothing;

insert into amenidades (slug, nombre, categoria, orden) values
  ('seguridad','Seguridad 24/7','seguridad',10),
  ('elevador','Elevador','comun',20),
  ('alberca','Alberca','comun',30),
  ('gimnasio','Gimnasio','comun',40),
  ('roof-garden','Roof garden','comun',50),
  ('salon-eventos','Salón de eventos','comun',60),
  ('jardin','Jardín','exterior',70),
  ('terraza','Terraza','exterior',80),
  ('balcon','Balcón','exterior',90),
  ('bodega','Bodega','interior',100),
  ('cuarto-servicio','Cuarto de servicio','interior',110),
  ('home-office','Home office','interior',120),
  ('pet-friendly','Pet friendly','comun',130),
  ('amueblado','Amueblado','interior',140),
  ('accesibilidad','Accesibilidad','accesibilidad',150),
  ('estacionamiento-visitas','Estacionamiento de visitas','comun',160),
  ('area-juegos','Área de juegos','comun',170),
  ('cisterna','Cisterna','seguridad',180),
  ('planta-emergencia','Planta de emergencia','seguridad',190),
  ('asador','Área de asadores','exterior',200)
on conflict (slug) do nothing;

-- Las colonias, propiedades, fotos, artículos y testimonios pueden cargarse
-- directamente desde assets/data/propiedades.json.
-- ============================================================================
