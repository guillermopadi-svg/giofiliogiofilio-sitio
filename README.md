# Gio Filio — Tu espacio ideal

Sitio inmobiliario boutique especializado **exclusivamente en propiedades de la Ciudad de México**, con Gio Filio como asesora y figura central de la experiencia.

> **⚠️ Dataset DEMO.** Las 36 propiedades publicadas son **ficticias** y están marcadas como DEMO en la interfaz. No representan inventario real ni constituyen oferta. Todas las ubicaciones corresponden exclusivamente a las 16 alcaldías de la CDMX.

---

## 1. Cómo verlo

**Opción A — abrir directamente**

Abre `index.html` con doble clic. Todos los enlaces son relativos, así que el sitio navega completo desde `file://`.

**Opción B — servidor local (recomendado)**

```bash
cd giofilio-sitio
python3 -m http.server 8000
# http://localhost:8000
```

Con servidor obtienes URLs limpias (`/venta/departamentos/polanco/`), `sitemap.xml` y `robots.txt` accesibles, y el comportamiento real de producción.

---

## 2. Qué incluye

| | |
|---|---|
| Páginas HTML | **135** |
| Propiedades demo | **36**, todas en CDMX |
| Alcaldías con página propia | **16** (las 16 oficiales) |
| Colonias con landing SEO | **19** |
| Landings programáticas `/operación/tipo/colonia/` | **32** |
| Guías de blog | **10**, redactadas completas |
| Peso total | ~69 MB (mayormente fotografía) |

### Mapa de rutas

```
/                                   Home con hero, buscador y 8 secciones
/propiedades/                       Buscador maestro: filtros + mapa + orden
/venta/  /renta/                    Resultados preconfigurados por operación
/departamentos/  /casas/            Resultados por tipo
/desarrollos/  /inversion/          Desarrollos y oportunidades
/propiedades/{colonia}/             19 landings de colonia (Polanco, Roma Norte…)
/zonas/                             Índice de zonas
/zonas/{alcaldia}/                  16 páginas de alcaldía
/venta/departamentos/{colonia}/     SEO programático (32 combinaciones con inventario)
/renta/departamentos/{colonia}/
/venta/casas/{colonia}/  …
/propiedad/{slug}-{id}/             36 fichas individuales
/favoritos/   /comparador/          Herramientas del usuario (noindex)
/conoce-a-gio/                      Página editorial de marca personal
/comprar/ /rentar/ /vender/ /invertir/   Landings por intención
/valuacion/                         Estimador de valor + captura de lead
/blog/  /blog/{slug}/               Blog y 10 guías
/contacto/                          Contacto + FAQs
/aviso-de-privacidad/  /terminos-y-condiciones/
/404.html   /sitemap.xml   /robots.txt
```

---

## 3. Configuración

Todo lo configurable vive en **`assets/js/config.js`**. No requiere build ni compilación.

```js
window.GF_CONFIG = {
  googleMapsKey: "",   // ← pega aquí tu API key de Google Maps
  whatsapp: "525512345678",
  gtmId: "", ga4Id: "", metaPixelId: "", googleAdsId: "",
  crmEndpoint: "",
  debug: false
};
```

### 3.1 Google Maps

1. En [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) crea un proyecto y habilita **Maps JavaScript API**.
2. Genera una API key y restríngela por referente HTTP (`https://giofilio.com/*`).
3. Pega la key en `googleMapsKey`.

**Mientras la key esté vacía** el sitio usa un **mapa esquemático de respaldo** propio: proyecta todas las propiedades con pines de precio, hover con preview, clic para mini-ficha y ajuste automático de encuadre. No se rompe nada y no hay costo. Al declarar la key, el mismo componente cambia a Google Maps con estilo de marca (`GMAP_STYLE` en `gio.js`), marcadores con precio, InfoWindow y el botón **“Buscar en esta zona”**.

Para migrar a Mapbox, la única superficie a reemplazar son las funciones `setupGoogle()` y `drawGoogle()` de `assets/js/gio.js`; el resto del flujo (`drawMap(list)`) ya está desacoplado.

### 3.2 Analítica (GA4 + GTM + Meta Pixel)

El `dataLayer` ya está implementado y disparando. Solo falta pegar el snippet del contenedor. En `assets/js/gio.js` (`function page(...)` del generador, o directamente en el `<head>` de las páginas) añade:

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
```

**Eventos implementados** (todos con parámetros de propiedad, colonia, alcaldía, precio, operación y tipo):

| Evento | Se dispara en |
|---|---|
| `search_property` | Envío del buscador y “Buscar en esta zona” |
| `filter_property` | Cada cambio de filtro, orden y limpieza |
| `view_property_list` | Render de resultados (incluye `results_count` y `filters`) |
| `select_property` | Clic en tarjeta o pin del mapa |
| `view_property` | Carga de ficha individual |
| `favorite_property` | Alta y baja de favoritos |
| `compare_property` | Alta, baja y vista del comparador |
| `click_whatsapp` | Todos los CTA de WhatsApp, con `source` |
| `generate_lead` | Formularios de contacto y ficha |
| `schedule_visit` | Botón “Agendar visita” |
| `request_valuation` | Herramienta de valuación (incluye rango estimado) |
| `submit_property` | Formulario de “Quiero vender” |
| `page_view_custom` | Todas las páginas, con `page_type` |

Verifícalos en consola con `GF_CONFIG.debug = true`, o con `window.dataLayer`.

### 3.3 CRM (HubSpot u otro)

Cada envío de formulario se normaliza y se guarda con este shape:

```json
{
  "nombre": "...", "email": "...", "telefono": "...", "mensaje": "...",
  "propiedad_id": "GF-1024", "propiedad_titulo": "...",
  "operacion": "venta", "colonia": "Polanco", "alcaldia": "Miguel Hidalgo",
  "ciudad": "Ciudad de México",
  "fuente": "ficha_propiedad", "formulario": "ficha_propiedad",
  "url": "https://giofilio.com/propiedad/...",
  "referrer": "...", "utm_source": null, "utm_medium": null,
  "utm_campaign": null, "utm_content": null, "utm_term": null,
  "gclid": null, "fbclid": null,
  "fecha": "2026-08-16T18:22:41.113Z"
}
```

En la demo se persiste en `localStorage` (`gf_leads_v1`) — inspecciónalo con `gfLeads()` en consola. Para enviarlo a tu CRM, define el hook antes de `gio.js`:

```js
window.gfSendToCRM = async function (lead) {
  await fetch(GF_CONFIG.crmEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  });
};
```

Para HubSpot Forms API, mapea a `fields: [{name, value}]` y usa el endpoint `https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}`. **No expongas tokens privados en el cliente**: usa una función serverless como proxy.

---

## 4. Estructura de archivos

```
giofilio-sitio/
├── index.html
├── sitemap.xml · robots.txt · 404.html
├── README.md · SCHEMA.sql · .env.example
├── assets/
│   ├── css/gio.css              Design system completo (tokens + componentes)
│   ├── js/
│   │   ├── config.js            ← ÚNICO archivo que necesitas editar
│   │   └── gio.js               Núcleo: búsqueda, filtros, mapa, favoritos,
│   │                            comparador, galería, formularios, dataLayer
│   ├── data/
│   │   ├── gio-data.js          Dataset embebido (funciona en file://)
│   │   └── propiedades.json     Mismo dataset en JSON, para importar a la BD
│   └── img/
│       ├── brand/               Logotipo oficial, isotipo GF, favicons
│       ├── gio/                 Fotografías reales de Gio (retrato, perfil, editorial, avatar)
│       ├── properties/          66 fotografías × 3 tamaños × jpg+webp
│       ├── zonas/               Imagen de cada alcaldía y colonia
│       └── blog/                Imagen de cada guía
└── [rutas de contenido]
```

### Reemplazar fotografías de Gio

Sustituye estos archivos manteniendo nombre y proporción:

| Archivo | Uso | Proporción |
|---|---|---|
| `assets/img/gio/retrato-{480,800,1200}.jpg` | Sección “Conoce a Gio” del home | 2:3 vertical |
| `assets/img/gio/perfil-{480,800,1200}.jpg` | Hero de la página Conoce a Gio | 2:3 vertical |
| `assets/img/gio/editorial-{480,800,1200}.jpg` | Cierre editorial | 2:3 vertical |
| `assets/img/gio/avatar-{160,320}.jpg` | Tarjeta de contacto y WhatsApp | 1:1 |

Existe una variante `.webp` de cada uno; si no la generas, el `<picture>` cae al JPG sin problema.

### Reemplazar fotografías de propiedades

Las imágenes actuales son de banco con licencia libre (Unsplash), incluidas solo para la demo. Al conectar inventario real, sustituye la ruta en el campo `fotos[]` de cada propiedad. Formato recomendado: **1440 px de ancho** para galería, **720 px** para tarjeta, **380 px** para miniatura, en `webp` con fallback `jpg`.

---

## 5. Identidad de marca

Tomada íntegra del **Manual de Marca de Gio Filio**. El logotipo se usa tal cual: sin reconstruir, sin alterar tipografía, proporciones, isotipo, espaciado ni composición.

| Token CSS | HEX | Uso |
|---|---|---|
| `--navy` | `#071F4A` | Color protagonista |
| `--navy-deep` | `#0B285E` | Apoyo, badges de renta |
| `--white` | `#FFFFFF` | Fondo principal |
| `--ivory` | `#F7F5F0` | Fondos cálidos alternos |
| `--beige` | `#E8DDCF` | Lifestyle, barra DEMO |
| `--gold` | `#B88E3E` | **Solo acento**: líneas, botones secundarios, detalles premium |

Tipografía: **Jost** para display y datos (sans geométrica limpia, coherente con el descriptor “TU ESPACIO IDEAL”) e **Inter** para texto corrido. La firma manuscrita se usa exclusivamente dentro del logotipo, como indica el manual.

Aplicaciones del logotipo:
- `brand/logo-principal.png` — azul marino sobre fondo blanco (header, uso general)
- `brand/logo-blanco.png` — sobre fondos azul marino (footer)
- `brand/isotipo-gf.png` — monograma GF suelto
- `brand/isotipo-blanco-navy.png` — avatar circular
- `brand/favicon-{32,180,512}.png`

---

## 6. Copy y tono de voz

El copywriting evita fórmulas genéricas de inmobiliaria. Frases de marca usadas en el sitio:

- Encuentra tu espacio ideal.
- Tu espacio ideal empieza aquí.
- Menos propiedades. Mejores opciones.
- Primero entiendo cómo quieres vivir. Después buscamos la propiedad.
- Encontrar casa es fácil. Encontrar tu casa es diferente.
- Compra mejor acompañado.
- Encuentra un espacio que haga sentido para tu vida.
- No se trata solo de metros cuadrados. Se trata de encontrar el lugar correcto para tu momento de vida.

Cada descripción de propiedad, guía de colonia y artículo del blog está redactado como texto original. **No hay lorem ipsum ni texto de relleno en ninguna página.**

---

## 7. SEO

- **URLs amigables** y jerárquicas: `/venta/departamentos/polanco/`, `/propiedad/departamento-polanco-terraza-y-vista-a-chapultepec-gf1024/`
- **Metadata dinámica** por página: title, description, canonical, Open Graph, Twitter Card
- **Schema.org (JSON-LD)** en todas las páginas:
  - `RealEstateAgent` + `Person` (Gio) — global
  - `RealEstateListing` + `Residence` + `Offer` — fichas de propiedad
  - `BreadcrumbList` — todas las rutas profundas
  - `Place` — alcaldías y colonias, con `geo` y `containedInPlace: Ciudad de México`
  - `FAQPage` — home, colonias, alcaldías, landings SEO, contacto, valuación
  - `Blog` / `BlogPosting` — blog y guías
  - `ItemList` — landings programáticas
  - `WebSite` + `SearchAction` — home
- `sitemap.xml` con 132 URLs, prioridad y frecuencia por tipo de página
- `robots.txt` con `Disallow` de páginas personales (`/favoritos/`, `/comparador/`) y parámetros de orden
- `noindex` en favoritos, comparador y 404

Al mover el sitio a un dominio distinto de `https://giofilio.com`, actualiza `MARCA["dominio"]` en el generador o haz un reemplazo global en los `canonical`, `og:url` y `sitemap.xml`.

---

## 8. Accesibilidad y rendimiento

**Accesibilidad (objetivo WCAG 2.2 AA)**

- `lang="es-MX"`, skip link, landmarks y jerarquía de encabezados
- `alt` descriptivo en el 100 % de las imágenes (verificado por auditoría)
- Estados de foco visibles (contorno dorado de 2.5 px)
- Navegación completa por teclado: menú, drawer de filtros, galería, lightbox (flechas y Escape), autocomplete (flechas + Enter)
- `aria-pressed`, `aria-selected`, `aria-expanded`, `aria-current`, `aria-live` en resultados
- `role="dialog"` + `aria-modal` en menú móvil, drawer y lightbox
- Contraste: navy `#071F4A` sobre blanco = 14.8:1; dorado `#B88E3E` sobre blanco = 3.5:1 (reservado a elementos ≥ 18 px y bordes)
- `prefers-reduced-motion` respetado

**Rendimiento**

- Imágenes en WebP con fallback JPG vía `<picture>`, tres tamaños por foto
- `loading="lazy"` + `decoding="async"` en todo lo que está bajo el pliegue; `fetchpriority="high"` en el LCP
- `width`/`height` explícitos para evitar CLS
- Cero dependencias JavaScript externas (~34 KB de JS propio sin minificar)
- El mapa de Google **no se carga hasta que hay una key configurada**; el respaldo es CSS puro
- Fuentes con `preconnect` y `display=swap`

Para producción: activa compresión Brotli/gzip, cachea `assets/` con `max-age=31536000, immutable` y sirve el HTML con `max-age=0, must-revalidate`.

---

## 9. Migración a Next.js 15

Esta entrega es un sitio estático navegable. Para llevarlo a Next.js 15 + TypeScript + Tailwind + Supabase, el mapeo directo es:

| Aquí | En Next.js |
|---|---|
| `assets/data/propiedades.json` | Seed de Supabase (ver `SCHEMA.sql`) |
| Plantillas del generador | `app/**/page.tsx` con las mismas rutas |
| `assets/css/gio.css` (tokens) | `tailwind.config.ts` → `theme.extend.colors` |
| `gio.js` filtros/orden | Server Components + `searchParams` |
| `gio.js` favoritos/comparador | Client Component con `localStorage`, luego tabla `favoritos` |
| Bloques JSON-LD | `generateMetadata()` + `<script type="application/ld+json">` |
| `sitemap.xml` / `robots.txt` | `app/sitemap.ts` / `app/robots.ts` |
| `captureLead()` | Route Handler `app/api/leads/route.ts` |

Rutas dinámicas sugeridas:

```
app/propiedad/[slug]/page.tsx
app/propiedades/[colonia]/page.tsx
app/zonas/[alcaldia]/page.tsx
app/[operacion]/[tipo]/[colonia]/page.tsx
app/blog/[slug]/page.tsx
```

---

## 10. Regenerar el sitio

El código fuente del generador vive en la carpeta `_build/` del proyecto:

```
_build/
├── data_zonas.py     16 alcaldías + 19 colonias con contenido editorial
├── data_props.py     36 propiedades DEMO
├── data_content.py   Blog, testimonios, proceso de asesoría, FAQs
├── render.py         Layout, header, footer, SEO, schema.org, iconos
├── parts.py          Filtros, bloque de resultados, formularios, tarjeta de Gio
├── prep.py           Pipeline de imágenes + normalización + dataset JS
├── build.py          Rutas y páginas          → python3 build.py
├── audit.py          Auditoría de calidad     → python3 audit.py
└── shots.py          Pruebas E2E + capturas   → python3 shots.py
```

`audit.py` verifica en cada compilación: enlaces internos rotos, imágenes faltantes, ausencia de ubicaciones fuera de la CDMX, placeholders, `alt` en imágenes, `lang`, títulos y descriptions, JSON-LD válido y coordenadas dentro del polígono de la ciudad. **Estado actual: 0 errores, 0 advertencias.**

---

## 11. Alcance territorial

El sitio está construido para operar **solo en la Ciudad de México**. La auditoría bloquea explícitamente cualquier mención a Interlomas, Estado de México, Naucalpan, Huixquilucan, Satélite, Valle de Bravo y otras localidades fuera de la ciudad, y valida que las coordenadas de toda propiedad caigan dentro del polígono de la CDMX (lat 19.0–19.6, lng −99.40 a −98.94).

**Las 16 alcaldías tienen página propia**, incluidas aquellas sin inventario publicado, que muestran un estado vacío honesto con CTA a Gio en lugar de una página muerta.

---

## 12. Créditos y licencias

- Logotipo, isotipo, descriptor y fotografías de Gio Filio: propiedad de Gio Filio.
- Fotografías de inmuebles: banco de imágenes con licencia libre (Unsplash), incluidas únicamente con fines de demostración. Sustitúyelas antes de publicar inventario real.
- Tipografías: Jost e Inter (SIL Open Font License).
- Ningún texto, hoja de estilos, marcado, componente o recurso gráfico proviene de Inmuebles24 ni de ningún otro portal. La referencia se limitó a profundidad funcional y arquitectura de información.
