# -*- coding: utf-8 -*-
"""Gio Filio — Generador del sitio estático. Ejecuta: python3 build.py"""
import os, json, shutil, sys
from datetime import date

from render import (page, e, rel, icon, money, money_short, num, breadcrumb,
                    breadcrumb_schema, card_grid, pcard, searchbox, cta_band,
                    faq_block, faq_schema, person_schema, canonical, SITE, slugify)
from parts import (results_block, contact_form, gio_card, testimonial_block,
                   lightbox_markup, filters_html)
from data_zonas import ALCALDIAS, COLONIAS, COLONIA_BY_SLUG, ALCALDIA_BY_SLUG, ALCALDIA_SLUG_BY_NOMBRE, MARCA
from data_props import TIPOS, TIPO_LABEL, TIPO_PLURAL, AMENIDAD_LABEL, ESTADOS_INMUEBLE, AMENIDADES
from data_content import TESTIMONIOS, PROCESO, FAQS_GENERALES, BLOG, BLOG_CATEGORIAS
import prep

OUT = "giofilio-sitio"
PAGES = []          # rutas generadas para sitemap
TODAY = "2026-08-16"

def write(path, html):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html)
    PAGES.append(path)

def K(**kw):
    """Atajo con colonias/alcaldías siempre presentes para el layout."""
    kw.setdefault("colonias", COLONIAS)
    kw.setdefault("alcaldias", ALCALDIAS)
    return kw

# =========================================================== PREPARACIÓN
print("→ Procesando fotografías…")
POOL = [l.strip() for l in open("ok_ids.txt")]
IMAGES = prep.build_images(POOL)

ZONE_IMG_MAP = {
    "polanco": 24, "lomas-de-chapultepec": 40, "condesa": 19, "hipodromo-condesa": 3,
    "roma-norte": 2, "roma-sur": 34, "juarez": 35, "del-valle": 48, "narvarte": 33,
    "napoles": 17, "portales": 21, "insurgentes-mixcoac": 12, "anzures": 9,
    "escandon": 64, "santa-fe": 55, "bosques-de-las-lomas": 62, "pedregal": 27,
    "san-angel": 42, "coyoacan": 7,
    # alcaldías
    "alvaro-obregon": 11, "azcapotzalco": 51, "benito-juarez": 50, "cuajimalpa-de-morelos": 22,
    "cuauhtemoc": 57, "gustavo-a-madero": 36, "iztacalco": 31, "iztapalapa": 18,
    "la-magdalena-contreras": 13, "miguel-hidalgo": 60, "milpa-alta": 16, "tlahuac": 46,
    "tlalpan": 8, "venustiano-carranza": 44, "xochimilco": 23, "coyoacan-alc": 54,
    "_cdmx": 57, "_cdmx2": 60, "_hero": 22,
}
ZONE_IMG = prep.build_zone_images(ZONE_IMG_MAP, pool_ids=POOL)
BLOG_IMG_MAP = {b["slug"]: idx for b, idx in zip(BLOG, [24, 19, 0, 32, 38, 50, 33, 45, 48, 4])}
BLOG_IMG = prep.build_blog_images(BLOG_IMG_MAP, pool_ids=POOL)

print("→ Normalizando dataset…")
PROPS = prep.normalize(IMAGES)
prep.emit_data_js(PROPS, COLONIAS, ALCALDIAS)
prep.emit_config_js()
print(f"   {len(PROPS)} propiedades · {len(COLONIAS)} colonias · {len(ALCALDIAS)} alcaldías")

BY_ID = {p["id"]: p for p in PROPS}
def by(**kw):
    out = PROPS
    for k, v in kw.items():
        if k == "colonia": out = [p for p in out if p["colonia_slug"] == v]
        elif k == "alcaldia": out = [p for p in out if p["alcaldia"] == v]
        elif k == "tipos": out = [p for p in out if p["tipo"] in v]
        elif k == "badge": out = [p for p in out if v in p["badges"]]
        else: out = [p for p in out if p.get(k) == v]
    return out

def destacadas(n=6, **kw):
    l = sorted(by(**kw), key=lambda p: (not p.get("destacada"), not p.get("exclusiva"), -p["precio"]))
    return l[:n]

def rango(props):
    if not props: return ""
    lo, hi = min(p["precio"] for p in props), max(p["precio"] for p in props)
    return f"{money_short(lo)} a {money_short(hi)}"


# =========================================================== SCHEMA LISTING
def listing_schema(p):
    from urllib.parse import quote
    return {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        "@id": canonical(p["url"]) + "#listing",
        "url": canonical(p["url"]),
        "name": p["titulo"],
        "description": p["descripcion"].split("\n")[0],
        "datePosted": p["publicado"],
        "dateModified": p["actualizado"],
        "image": [SITE + "/" + f for f in p["fotos"][:5]],
        "provider": {"@id": SITE + "/#gio-filio"},
        "isPartOf": {"@type": "WebSite", "name": "Gio Filio — Tu espacio ideal", "url": SITE + "/"},
        "about": {
            "@type": "Residence" if p["tipo"] not in ("oficina", "local-comercial", "terreno") else "Place",
            "name": p["titulo"],
            "address": {
                "@type": "PostalAddress",
                "streetAddress": p["calle"],
                "addressLocality": p["alcaldia_nombre"],
                "addressRegion": "Ciudad de México",
                "postalCode": p["cp"],
                "addressCountry": "MX",
            },
            "geo": {"@type": "GeoCoordinates", "latitude": p["lat"], "longitude": p["lng"]},
            **({"numberOfRooms": p["rec"]} if p["rec"] else {}),
            **({"numberOfBathroomsTotal": p["ban"]} if p["ban"] else {}),
            **({"floorSize": {"@type": "QuantitativeValue", "value": p["m2c"], "unitCode": "MTK"}} if p["m2c"] else {}),
            **({"lotSize": {"@type": "QuantitativeValue", "value": p["m2t"], "unitCode": "MTK"}} if p["m2t"] else {}),
            "amenityFeature": [
                {"@type": "LocationFeatureSpecification", "name": AMENIDAD_LABEL.get(a, a), "value": True}
                for a in p["amenidades"]
            ],
        },
        "offers": {
            "@type": "Offer",
            "price": p["precio"],
            "priceCurrency": "MXN",
            "availability": "https://schema.org/InStock",
            "businessFunction": "https://schema.org/Sell" if p["operacion"] == "venta" else "https://schema.org/LeaseOut",
            "url": canonical(p["url"]),
            "seller": {"@id": SITE + "/#gio-filio"},
            **({"priceSpecification": {"@type": "UnitPriceSpecification",
                "price": p["precio"], "priceCurrency": "MXN",
                "unitCode": "MON", "billingIncrement": 1}} if p["operacion"] == "renta" else {}),
        },
    }


# =========================================================== HOME
def build_home():
    path = "index.html"
    R = lambda t: rel(path, t)
    dest = destacadas(6)
    nuevas = [p for p in PROPS if "nueva" in p["badges"] or "preventa" in p["badges"]][:8]
    inversion = [p for p in PROPS if "oportunidad" in p["badges"] or p["tipo"] == "desarrollo"][:6]
    zonas_home = ["polanco", "roma-norte", "condesa", "del-valle", "san-angel", "santa-fe"]

    objetivos = [
        ("Comprar", "comprar/", "home", "Encontrar el lugar correcto para tu momento de vida, no solo una propiedad disponible.", "Quiero comprar"),
        ("Rentar", "rentar/", "key", "Opciones verificadas que sí aceptan tus condiciones, sin perder semanas en visitas inútiles.", "Quiero rentar"),
        ("Invertir", "invertir/", "chart", "Números reales de rendimiento y vacancia antes de comprar, no promesas de plusvalía.", "Quiero invertir"),
        ("Vender", "vender/", "tag", "Precio correcto desde el primer día y material profesional que sí genera visitas.", "Quiero vender"),
    ]
    obj_html = "".join(f'''<a class="objetivo-card" href="{R(u)}">
      <div class="oc-icon">{icon(ic)}</div>
      <h3>{e(t)}</h3><p>{e(d)}</p>
      <span class="link-arrow">{e(cta)}{icon("arrow")}</span>
    </a>''' for t, u, ic, d, cta in objetivos)

    zonas_html = "".join(f'''<a class="zona-card" href="{R("propiedades/" + s + "/")}">
      <img src="{R(ZONE_IMG[s] + "-card.jpg")}" alt="Propiedades en {e(COLONIA_BY_SLUG[s]["nombre"])}, Ciudad de México" loading="lazy" width="640" height="853">
      <div class="zc-body"><h3>{e(COLONIA_BY_SLUG[s]["nombre"])}</h3>
      <span>{len(by(colonia=s))} propiedades · {e(COLONIA_BY_SLUG[s]["alcaldia"])}</span></div>
    </a>''' for s in zonas_home)

    posts_html = "".join(f'''<a class="post-card" href="{R("blog/" + b["slug"] + "/")}">
      <div class="pc-media"><img src="{R(BLOG_IMG[b["slug"]] + "-card.jpg")}" alt="{e(b["titulo"])}" loading="lazy" width="640" height="400"></div>
      <div class="pc-body">
        <div class="post-meta"><span class="cat">{e(b["categoria"])}</span><span>{b["lectura"]} min</span></div>
        <h3>{e(b["titulo"])}</h3><p>{e(b["resumen"])}</p>
      </div></a>''' for b in BLOG[:3])

    body = f'''
<section class="hero">
  <div class="hero-media">
    <picture>
      <source type="image/webp" srcset="{R(ZONE_IMG["_hero"] + "-hero.webp")}">
      <img src="{R(ZONE_IMG["_hero"] + "-hero.jpg")}" alt="Residencia contemporánea en Ciudad de México" fetchpriority="high" width="1600" height="900">
    </picture>
  </div>
  <div class="hero-inner wrap">
    <p class="eyebrow hero-eyebrow">Asesoría inmobiliaria en Ciudad de México</p>
    <h1>Encuentra tu espacio ideal.</h1>
    <p class="lead">Propiedades seleccionadas y asesoría personalizada para comprar, rentar o invertir en Ciudad de México.</p>
    {searchbox(path)}
    <div class="hero-stats">
      <div class="hero-stat"><b>16</b><span>Alcaldías de CDMX</span></div>
      <div class="hero-stat"><b>{len(COLONIAS)}</b><span>Colonias con guía propia</span></div>
      <div class="hero-stat"><b>{len(PROPS)}</b><span>Propiedades publicadas</span></div>
      <div class="hero-stat"><b>1</b><span>Asesora, de principio a fin</span></div>
    </div>
  </div>
</section>

<section class="section" id="destacadas">
  <div class="wrap">
    <div class="carousel-head">
      <div>
        <p class="eyebrow">Selección de Gio</p>
        <h2>Propiedades destacadas</h2>
        <p class="lead" style="max-width:52ch">Menos propiedades. Mejores opciones. Cada una está aquí por una razón concreta que puedo explicarte.</p>
      </div>
      <a class="btn btn--ghost" href="{R("propiedades/")}">Ver todas</a>
    </div>
    {card_grid(path, dest)}
  </div>
</section>

<section class="section section--ivory" style="padding-block:var(--sp-7)">
  <div class="wrap">
    <p class="eyebrow eyebrow--center center">Por dónde empezamos</p>
    <h2 class="center" style="margin-bottom:.5rem">Encuentra según tu objetivo</h2>
    <p class="lead center" style="max-width:56ch;margin:0 auto var(--sp-6)">Cada objetivo tiene un proceso distinto. Elige el tuyo y te explico exactamente cómo trabajo.</p>
    <div class="grid grid-4">{obj_html}</div>
  </div>
</section>

<section class="section" id="zonas-home">
  <div class="wrap">
    <div class="carousel-head">
      <div>
        <p class="eyebrow">Zonas</p>
        <h2>Explora la Ciudad de México</h2>
        <p class="lead" style="max-width:52ch">Cada colonia se vive distinto. Aquí encuentras cómo es realmente vivir en cada una, no solo cuánto cuesta.</p>
      </div>
      <a class="btn btn--ghost" href="{R("zonas/")}">Ver las 16 alcaldías</a>
    </div>
    <div class="grid grid-3">{zonas_html}</div>
  </div>
</section>

<section class="section section--ivory" data-carousel id="nuevas">
  <div class="wrap">
    <div class="carousel-head">
      <div>
        <p class="eyebrow">Recién publicadas</p>
        <h2>Propiedades nuevas y en preventa</h2>
      </div>
      <div class="carousel-nav">
        <button type="button" data-car="-1" aria-label="Anterior">{icon("chevl")}</button>
        <button type="button" data-car="1" aria-label="Siguiente">{icon("chev")}</button>
      </div>
    </div>
    <div class="carousel">{"".join(pcard(path, p) for p in nuevas)}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="carousel-head">
      <div>
        <p class="eyebrow">Inversión</p>
        <h2>Oportunidades de inversión</h2>
        <p class="lead" style="max-width:54ch">Propiedades donde los números cierran. Puedo compartirte el análisis de rendimiento y comparables de renta de cada una.</p>
      </div>
      <a class="btn btn--ghost" href="{R("inversion/")}">Ver todas</a>
    </div>
    {card_grid(path, inversion)}
  </div>
</section>

<section class="section section--navy">
  <div class="wrap">
    <div class="gio-split">
      <div class="gio-split-media">
        <picture>
          <source type="image/webp" srcset="{R("assets/img/gio/retrato-800.webp")}">
          <img src="{R("assets/img/gio/retrato-800.jpg")}" alt="Gio Filio, asesora inmobiliaria en Ciudad de México" loading="lazy" width="800" height="1200">
        </picture>
      </div>
      <div>
        <p class="eyebrow">Conoce a Gio</p>
        <h2 style="font-weight:300">Primero entiendo cómo quieres vivir. Después buscamos la propiedad.</h2>
        <p class="lead">La mayoría de las búsquedas fracasan por la misma razón: empiezan por el catálogo en lugar de empezar por la persona. Antes de mostrarte una sola propiedad, quiero saber a qué hora sales de casa, si trabajas desde ahí, si tienes perro, cuánto tiempo piensas quedarte y qué te haría sentir que llegaste.</p>
        <p style="color:rgba(255,255,255,.8)">Con eso, la lista de cuarenta opciones se convierte en seis. Y de esas seis, normalmente una es la correcta.</p>
        <div class="cta-actions" style="justify-content:flex-start;margin-top:2rem">
          <a class="btn btn--light" href="{R("conoce-a-gio/")}">Conoce a Gio</a>
          <a class="btn btn--outline-light" href="{R("contacto/")}">Hablemos de tu próximo espacio</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="testimonios">
  <div class="wrap">
    <p class="eyebrow eyebrow--center center">Clientes</p>
    <h2 class="center" style="margin-bottom:3rem">Lo que dicen quienes ya encontraron su espacio</h2>
    {testimonial_block(TESTIMONIOS, 3)}
    <p class="center small muted" style="margin-top:2rem">Testimonios ilustrativos incluidos en la versión de demostración del sitio.</p>
  </div>
</section>

<section class="section section--beige" id="vender-home">
  <div class="wrap">
    <div class="gio-split" style="grid-template-columns:1.15fr .85fr">
      <div>
        <p class="eyebrow">Vender</p>
        <h2>¿Quieres vender tu propiedad en CDMX?</h2>
        <p class="lead">Ocho de cada diez propiedades que llevan más de seis meses publicadas tienen el mismo problema, y casi nunca es la propiedad. Es el precio de salida.</p>
        <p>Empiezo con un análisis de operaciones cerradas en tu colonia durante los últimos doce meses. Con ese número decides si vendes, y a cuánto.</p>
        <div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">
          <a class="btn" href="{R("vender/")}">Solicitar valoración</a>
          <a class="btn btn--ghost" href="{R("valuacion/")}">Calcular valor estimado</a>
        </div>
      </div>
      <div class="stat-row" style="align-self:center">
        <div class="stat"><b>6–12</b><span>Semanas promedio de venta</span></div>
        <div class="stat"><b>5–12%</b><span>Diferencia lista vs. cierre</span></div>
        <div class="stat"><b>2–3×</b><span>Más solicitudes con material profesional</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="carousel-head">
      <div>
        <p class="eyebrow">Blog y guías</p>
        <h2>Para decidir con información</h2>
      </div>
      <a class="btn btn--ghost" href="{R("blog/")}">Ver todas las guías</a>
    </div>
    <div class="grid grid-3">{posts_html}</div>
  </div>
</section>

{cta_band(path, "Tu espacio ideal empieza aquí.",
          "Cuéntame cómo quieres vivir y te muestro las opciones que realmente tienen sentido para ti en la Ciudad de México.",
          ("Hablar con Gio", "contacto/"), ("Ver propiedades", "propiedades/"))}
'''
    schema = [
        person_schema(),
        {"@context": "https://schema.org", "@type": "WebSite", "@id": SITE + "/#website",
         "name": "Gio Filio — Tu espacio ideal", "url": SITE + "/", "inLanguage": "es-MX",
         "publisher": {"@id": SITE + "/#gio-filio"},
         "potentialAction": {"@type": "SearchAction",
                             "target": {"@type": "EntryPoint", "urlTemplate": SITE + "/propiedades/?q={search_term_string}"},
                             "query-input": "required name=search_term_string"}},
        faq_schema(FAQS_GENERALES[:4]),
    ]
    write(path, page(path,
        "Gio Filio | Asesoría inmobiliaria en Ciudad de México — Tu espacio ideal",
        "Encuentra tu espacio ideal en CDMX. Propiedades seleccionadas en venta y renta en Polanco, Roma, Condesa, Del Valle, Santa Fe y más, con la asesoría personal de Gio Filio.",
        body, active="index.html", schema=schema, page_type="home", **K()))


# =========================================================== RESULTADOS
def build_search_pages():
    combos = [
        ("propiedades/index.html", "propiedades/", "Propiedades en Ciudad de México",
         "Todas las propiedades en venta y renta en las 16 alcaldías de la Ciudad de México, con filtros por colonia, precio, superficie y amenidades.",
         "Explora el inventario completo. Usa los filtros para acotar por colonia, tipo, precio o características, y guarda tus favoritas para compararlas después."),
        ("venta/index.html", "venta/", "Propiedades en venta en CDMX",
         "Departamentos, casas, penthouses y desarrollos en venta en Ciudad de México. Filtra por alcaldía, colonia, precio y superficie.",
         "Todo el inventario en venta, de Portales a Lomas de Chapultepec. Si buscas algo específico que no aparece aquí, Gio puede rastrearlo por ti."),
        ("renta/index.html", "renta/", "Propiedades en renta en CDMX",
         "Departamentos y casas en renta en Ciudad de México, con opciones amuebladas y pet friendly. Filtra por colonia, precio y características.",
         "Rentas verificadas en las zonas con mejor conectividad de la ciudad. Ten tu expediente listo: en Roma, Condesa y Del Valle una buena propiedad se coloca en menos de dos semanas."),
        ("departamentos/index.html", "departamentos/", "Departamentos en Ciudad de México",
         "Departamentos en venta y renta en CDMX: Polanco, Roma Norte, Condesa, Del Valle, Narvarte, Santa Fe y más colonias.",
         "El producto más líquido del mercado de la ciudad. Desde estudios de inversión hasta departamentos de gran formato con cuarto de servicio."),
        ("casas/index.html", "casas/", "Casas en venta y renta en CDMX",
         "Casas y casas en condominio en Ciudad de México: San Ángel, Coyoacán, Lomas de Chapultepec, Pedregal y Bosques de las Lomas.",
         "Casa con jardín sin salir de la ciudad. El inventario es limitado y se mueve rápido, sobre todo en el sur."),
        ("desarrollos/index.html", "desarrollos/", "Desarrollos y preventa en CDMX",
         "Desarrollos inmobiliarios nuevos y en preventa en Ciudad de México, con asignación directa y esquemas de pago.",
         "En preventa, el diferencial histórico entre precio de lanzamiento y precio de entrega en estas zonas ha estado entre 12 y 18 por ciento."),
        ("inversion/index.html", "inversion/", "Propiedades para inversión en CDMX",
         "Propiedades de inversión en Ciudad de México con análisis de rendimiento, vacancia y precio por metro cuadrado por colonia.",
         "Una propiedad de inversión se compra con hoja de cálculo, no con emoción. Cada una de estas tiene números que puedo compartirte."),
    ]
    preset = {
        "venta/": {"operacion": "venta"}, "renta/": {"operacion": "renta"},
        "departamentos/": {"tipo": "departamento"}, "casas/": {"tipo": "casa"},
        "desarrollos/": {"tipo": "desarrollo"},
        "inversion/": {"badges": "oportunidad"},
    }
    for path, urlp, titulo, desc, intro in combos:
        R = lambda t: rel(path, t)
        crumbs = [("Inicio", "index.html"), (titulo, None)]
        pre = preset.get(urlp, {})
        pre_js = ""
        if pre:
            qs = "&".join(f"{k}={v}" for k, v in pre.items())
            pre_js = f'''<script>
(function(){{ if(!location.search){{ history.replaceState({{}},"","?{qs}"); }} }})();
</script>'''
        body = (breadcrumb(path, crumbs) +
                f'<div class="wrap" style="padding-top:1rem"></div>' +
                results_block(path, titulo, intro, incluir_mascotas=(urlp in ("renta/", "desarrollos/"))))
        write(path, page(path, titulo + " | Gio Filio", desc, body,
                         active=("propiedades/" if urlp == "propiedades/" else ""),
                         schema=[breadcrumb_schema(crumbs), person_schema()],
                         page_type="search_results",
                         extra_head=pre_js, **K()))


# =========================================================== FICHA PROPIEDAD
def build_property(p):
    path = p["url_file"]
    R = lambda t: rel(path, t)
    op_label = "en venta" if p["operacion"] == "venta" else "en renta"
    crumbs = [("CDMX", "propiedades/"),
              (p["alcaldia_nombre"], f'zonas/{p["alcaldia"]}/'),
              (p["colonia_nombre"], f'propiedades/{p["colonia_slug"]}/'),
              (f'{p["tipo_label"]} {op_label}', None)]

    # galería
    thumbs = ""
    for i, f in enumerate(p["fotos"][1:5], start=1):
        thumbs += f'''<button type="button" class="g-sm" data-lightbox="{i}" aria-label="Ver fotografía {i+1} en pantalla completa">
          <img src="{R(p["fotos_thumb"][i])}" alt="{e(p["titulo"])} — fotografía {i+1}" loading="lazy" width="380" height="285"></button>'''
    tools = "".join(f'<span class="chip">{icon(ic)} {e(t)}</span>' for ic, t in
                    [("play", "Video"), ("360", "Tour virtual"), ("plan", "Plano"), ("cube", "Vista 360°")])

    specs = []
    if p["rec"]: specs.append(("bed", p["rec"], "Recámaras"))
    if p["ban"]: specs.append(("bath", f'{p["ban"]}{"." + str(p["medios"]) if p["medios"] else ""}', "Baños"))
    if p["est"]: specs.append(("car", p["est"], "Estacionamientos"))
    if p["m2c"]: specs.append(("area", num(p["m2c"]), "m² construcción"))
    if p["m2t"]: specs.append(("area", num(p["m2t"]), "m² terreno"))
    specs.append(("cal", "Nueva" if p["antig"] == 0 else p["antig"], "Antigüedad" if p["antig"] else ""))
    if p["piso"]: specs.append(("layers", p["piso"], "Piso"))
    spec_html = "".join(f'<div class="spec">{icon(ic)}<b>{e(v)}</b><span>{e(l)}</span></div>' for ic, v, l in specs)

    desc_html = "".join(f"<p>{e(par)}</p>" for par in p["descripcion"].split("\n") if par.strip())

    amen_html = "".join(f'<li>{icon("check")}{e(AMENIDAD_LABEL.get(a, a))}</li>' for a in p["amenidades"])
    car_html = "".join(f'<li>{icon("check")}{e(c)}</li>' for c in p["caracteristicas"])

    # detalles financieros
    if p["operacion"] == "venta":
        isai = round(p["precio"] * 0.045)
        notaria = round(p["precio"] * 0.018)
        avaluo = 9500
        total = isai + notaria + avaluo
        fin_rows = f'''
      <tr><th>Precio de lista</th><td>{money(p["precio"])}</td></tr>
      <tr><th>Precio por m²</th><td>{money(p["precio_m2"])}</td></tr>
      <tr><th>Mantenimiento mensual</th><td>{money(p["mantenimiento"]) if p["mantenimiento"] else "Sin cuota"}</td></tr>
      <tr><th>ISAI estimado (4.5%)</th><td>{money(isai)}</td></tr>
      <tr><th>Honorarios notariales estimados</th><td>{money(notaria)}</td></tr>
      <tr><th>Avalúo y certificados</th><td>{money(avaluo)}</td></tr>
      <tr><th>Gastos de cierre estimados</th><td>{money(total)}</td></tr>'''
        fin_note = "Los gastos de cierre son estimaciones de referencia y varían según la notaría, el crédito y la fecha de operación. Antes de ofertar te preparo el desglose exacto de tu caso."
    else:
        dep = p["precio"]
        anual = p["precio"] * 12
        fin_rows = f'''
      <tr><th>Renta mensual</th><td>{money(p["precio"])}</td></tr>
      <tr><th>Renta por m² al mes</th><td>{money(p["precio_m2"])}</td></tr>
      <tr><th>Depósito en garantía</th><td>{money(dep)}</td></tr>
      <tr><th>Desembolso inicial estimado</th><td>{money(dep * 2)}</td></tr>
      <tr><th>Costo anual del contrato</th><td>{money(anual)}</td></tr>
      <tr><th>Póliza jurídica estimada</th><td>{money(round(p["precio"] * 0.4))}</td></tr>'''
        fin_note = "El desembolso inicial considera primer mes más depósito. La póliza jurídica sustituye al aval y la contrata el inquilino; su costo varía entre 30 y 50 por ciento de un mes de renta."

    # similares
    sim = [q for q in PROPS if q["id"] != p["id"] and q["colonia_slug"] == p["colonia_slug"] and q["operacion"] == p["operacion"]]
    if len(sim) < 3:
        sim += [q for q in PROPS if q["id"] != p["id"] and q["alcaldia"] == p["alcaldia"] and q not in sim]
    if len(sim) < 3:
        sim += [q for q in PROPS if q["id"] != p["id"] and q["tipo"] == p["tipo"] and q not in sim]
    sim = sim[:3]

    col = COLONIA_BY_SLUG[p["colonia_slug"]]
    gallery_json = json.dumps([p["fotos"][i] for i in range(len(p["fotos"]))], ensure_ascii=False)

    body = f'''
{breadcrumb(path, crumbs)}
<section style="padding-block:1rem 0">
  <div class="wrap">
    <div class="gallery">
      <button type="button" class="g-main" data-lightbox="0" aria-label="Ver galería en pantalla completa">
        <picture>
          <source type="image/webp" srcset="{R(p["fotos_webp"][0])}">
          <img src="{R(p["fotos"][0])}" alt="{e(p["titulo"])} — fotografía principal" fetchpriority="high" width="1440" height="1080">
        </picture>
      </button>
      {thumbs}
      <div class="gallery-tools">{tools}</div>
      <button type="button" class="gallery-more" data-lightbox="0">{icon("grid")} Ver todas las fotos ({len(p["fotos"])})</button>
    </div>
  </div>
</section>

<section class="section-sm">
  <div class="wrap">
    <div class="prop-layout">
      <div>
        <div class="prop-header">
          <div>
            <div class="flex flex-wrap" style="margin-bottom:.75rem">
              <span class="badge badge--{p["operacion"]}">{"Venta" if p["operacion"]=="venta" else "Renta"}</span>
              {"".join(f'<span class="badge badge--{b}">{e({"nueva":"Nueva","exclusiva":"Exclusiva","oportunidad":"Oportunidad","preventa":"Preventa","entrega-inmediata":"Entrega inmediata"}.get(b,b))}</span>' for b in p["badges"])}
              <span class="badge badge--demo">Demo</span>
            </div>
            <h1 style="font-size:var(--step-3);max-width:22ch">{e(p["titulo"])}</h1>
            <p class="pcard-loc" style="font-size:var(--step-0)">{icon("pin")}{e(p["calle"])}, {e(p["colonia_nombre"])}, {e(p["alcaldia_nombre"])}, Ciudad de México · CP {e(p["cp"])}</p>
          </div>
          <div style="text-align:right">
            <div class="prop-price">{money(p["precio"]).replace(" MXN","")} <span class="cur">MXN{" /mes" if p["operacion"]=="renta" else ""}</span></div>
            <div class="prop-price-sub">{money(p["precio_m2"])} por m²{" al mes" if p["operacion"]=="renta" else ""}</div>
            <div class="prop-price-sub">ID {e(p["id"])} · Actualizada el {e(p["actualizado"])}</div>
          </div>
        </div>

        <div class="spec-grid" style="margin-top:2rem">{spec_html}</div>

        <div class="prop-section">
          <h3>Sobre esta propiedad</h3>
          <div class="prose" style="font-size:var(--step-1);line-height:1.75;color:var(--ink-70)">{desc_html}</div>
        </div>

        <div class="prop-section">
          <h3>Características</h3>
          <ul class="feature-list">{car_html}</ul>
        </div>

        <div class="prop-section">
          <h3>Amenidades</h3>
          <ul class="feature-list">{amen_html}</ul>
        </div>

        <div class="prop-section">
          <h3>Ubicación</h3>
          <p class="lead" style="font-size:var(--step-0)">{e(col["tagline"])} {e(col["movilidad"])}</p>
          <div class="prop-map" style="margin-top:1.25rem">
            <div id="map" style="height:100%"><div class="map-canvas"></div></div>
          </div>
          <p class="small muted" style="margin-top:.75rem">Ubicación aproximada dentro de {e(p["colonia_nombre"])}. La dirección exacta se comparte al agendar la visita.</p>
          <div class="flex flex-wrap" style="margin-top:1rem">
            <a class="chip" href="{R("propiedades/" + p["colonia_slug"] + "/")}">Ver todo en {e(p["colonia_nombre"])}</a>
            <a class="chip" href="{R("zonas/" + p["alcaldia"] + "/")}">Ver {e(p["alcaldia_nombre"])}</a>
          </div>
        </div>

        <div class="prop-section">
          <h3>Detalles financieros</h3>
          <table class="fin-table"><tbody>{fin_rows}</tbody></table>
          <p class="fin-note">{e(fin_note)}</p>
        </div>
      </div>

      <div>
        {gio_card(path, property_id=p["id"])}
      </div>
    </div>
  </div>
</section>

<section class="section section--ivory">
  <div class="wrap">
    <p class="eyebrow">También podrían interesarte</p>
    <h2 style="font-size:var(--step-2);margin-bottom:2rem">Propiedades similares en {e(p["colonia_nombre"])} y alrededores</h2>
    {card_grid(path, sim)}
  </div>
</section>

<div class="cmp-bar" id="cmpBar">
  <span class="cb-txt">0 propiedades seleccionadas</span>
  <a class="btn btn--light btn--sm" href="{R("comparador/")}">Comparar</a>
</div>
{lightbox_markup()}
'''
    extra_js = f'<script>window.GF_GALLERY = {gallery_json};</script>'
    seo_title = f'{p["titulo"]} | {money_short(p["precio"])}'
    if len(seo_title) > 68:
        seo_title = f'{p["tipo_label"]} {op_label} en {p["colonia_nombre"]} | {money_short(p["precio"])}'
    write(path, page(path, seo_title,
        f'{p["tipo_label"]} {op_label} en {p["colonia_nombre"]}, {p["alcaldia_nombre"]}, CDMX. '
        f'{p["rec"] or "—"} recámaras, {p["ban"] or "—"} baños, {num(p["m2_ref"])} m². {money(p["precio"])}. Asesoría de Gio Filio.',
        body, schema=[listing_schema(p), breadcrumb_schema(crumbs), person_schema()],
        og_image=p["fotos"][0], body_attrs=f'data-property-id="{e(p["id"])}"',
        page_type="property_detail", extra_js=extra_js, **K()))


# =========================================================== ZONAS
def build_zonas_index():
    path = "zonas/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Zonas de CDMX", None)]
    alc_cards = ""
    for a in ALCALDIAS:
        n = len(by(alcaldia=a["slug"]))
        alc_cards += f'''<a class="objetivo-card" href="{R("zonas/" + a["slug"] + "/")}">
      <h3 style="margin-bottom:.35rem">{e(a["nombre"])}</h3>
      <p style="margin-bottom:1rem">{e(a["resumen"])}</p>
      <span class="link-arrow">{n} propiedad{"es" if n != 1 else ""} publicadas{icon("arrow")}</span>
    </a>'''
    col_cards = "".join(f'''<a class="zona-card" href="{R("propiedades/" + c["slug"] + "/")}">
      <img src="{R(ZONE_IMG[c["slug"]] + "-card.jpg")}" alt="Propiedades en {e(c["nombre"])}, CDMX" loading="lazy" width="640" height="853">
      <div class="zc-body"><h3>{e(c["nombre"])}</h3><span>{len(by(colonia=c["slug"]))} propiedades · {e(c["alcaldia"])}</span></div>
    </a>''' for c in COLONIAS)

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page hero--light">
  <div class="hero-inner wrap">
    <p class="eyebrow">Ciudad de México</p>
    <h1>Las 16 alcaldías, colonia por colonia</h1>
    <p class="lead" style="max-width:62ch">Trabajo exclusivamente en la Ciudad de México. Conocer bien un mercado vale más que cubrir muchos de forma superficial. Aquí encuentras cómo se vive cada zona, qué se consigue y a qué precio.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow">Colonias con guía completa</p>
    <h2 style="margin-bottom:2rem">{len(COLONIAS)} colonias prioritarias</h2>
    <div class="grid grid-4">{col_cards}</div>
  </div>
</section>

<section class="section section--ivory">
  <div class="wrap">
    <p class="eyebrow">Por alcaldía</p>
    <h2 style="margin-bottom:2rem">Las 16 alcaldías de la Ciudad de México</h2>
    <div class="grid grid-3">{alc_cards}</div>
  </div>
</section>

{cta_band(path, "¿No sabes por dónde empezar?",
          "Cuéntame cómo es tu día y te digo en qué tres colonias deberías estar buscando. Es la conversación que más tiempo ahorra.",
          ("Hablar con Gio", "contacto/"), ("Ver todas las propiedades", "propiedades/"))}
'''
    write(path, page(path, "Zonas de CDMX: las 16 alcaldías y sus colonias | Gio Filio",
        "Guía de zonas de CDMX: las 16 alcaldías y las colonias con más demanda —Polanco, Roma, Condesa, Del Valle, Santa Fe— con precios y estilo de vida.",
        body, active="zonas/", schema=[breadcrumb_schema(crumbs), person_schema()],
        page_type="zonas_index", **K()))


def build_alcaldia(a):
    path = f'zonas/{a["slug"]}/index.html'
    R = lambda t: rel(path, t)
    props = by(alcaldia=a["slug"])
    cols_here = [c for c in COLONIAS if c["alcaldia"] == a["nombre"]]
    crumbs = [("Inicio", "index.html"), ("Zonas de CDMX", "zonas/"), (a["nombre"], None)]

    if props:
        venta = [p for p in props if p["operacion"] == "venta"]
        renta = [p for p in props if p["operacion"] == "renta"]
        stats = f'''<div class="stat-row" style="margin-block:2.5rem">
      <div class="stat"><b>{len(props)}</b><span>Propiedades publicadas</span></div>
      <div class="stat"><b>{len(venta)}</b><span>En venta</span></div>
      <div class="stat"><b>{len(renta)}</b><span>En renta</span></div>
      <div class="stat"><b>{money_short(round(sum(p["precio_m2"] for p in venta)/len(venta)) if venta else 0)}</b><span>Precio medio por m² (venta)</span></div>
    </div>'''
        listado = f'''<section class="section">
      <div class="wrap">
        <p class="eyebrow">Inventario</p>
        <h2 style="margin-bottom:2rem">Propiedades en {e(a["nombre"])}</h2>
        {card_grid(path, props[:9])}
        <div class="cta-actions" style="margin-top:2.5rem">
          <a class="btn" href="{R("propiedades/")}?alcaldia={a["slug"]}">Ver las {len(props)} propiedades con filtros</a>
        </div>
      </div>
    </section>'''
    else:
        stats = ""
        listado = f'''<section class="section">
      <div class="wrap">
        <div class="empty">
          {icon("search")}
          <h3>Todavía no publico inventario en {e(a["nombre"])}</h3>
          <p>Prefiero trabajar a fondo pocas zonas antes que listar propiedades que no conozco. Si buscas en {e(a["nombre"])}, escríbeme: puedo rastrear opciones con mi red de colegas y acompañarte igual en todo el proceso.</p>
          <div class="cta-actions">
            <a class="btn" href="{R("contacto/")}">Pedirle a Gio que busque aquí</a>
            <a class="btn btn--ghost" href="{R("zonas/")}">Ver zonas con inventario</a>
          </div>
        </div>
      </div>
    </section>'''

    col_chips = "".join(f'<a class="chip" href="{R("propiedades/" + c["slug"] + "/")}">{e(c["nombre"])}</a>' for c in cols_here)
    dest_chips = "".join(f'<span class="chip">{e(d)}</span>' for d in a["destacados"])

    faqs = [
        (f'¿Cuántas propiedades hay disponibles en {a["nombre"]}?',
         f'En este momento hay {len(props)} propiedades publicadas en {a["nombre"]} dentro del catálogo de demostración. El inventario se actualiza conforme se integran nuevas propiedades a la plataforma.'
         if props else
         f'Por ahora no hay inventario publicado en {a["nombre"]}. Trabajo con profundidad un número acotado de zonas, pero puedo buscar en {a["nombre"]} a través de mi red de colegas.'),
        (f'¿Cómo es vivir en {a["nombre"]}?', a["vive"]),
        ("¿Gio Filio trabaja fuera de la Ciudad de México?",
         "No. Toda la asesoría se concentra exclusivamente en las 16 alcaldías de la Ciudad de México."),
    ]

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page">
  <div class="hero-media">
    <picture>
      <source type="image/webp" srcset="{R(ZONE_IMG[a["slug"]] + "-hero.webp")}">
      <img src="{R(ZONE_IMG[a["slug"]] + "-hero.jpg")}" alt="{e(a["nombre"])}, Ciudad de México" width="1600" height="900" fetchpriority="high">
    </picture>
  </div>
  <div class="hero-inner wrap">
    <p class="eyebrow hero-eyebrow">Alcaldía · Ciudad de México</p>
    <h1>Propiedades en {e(a["nombre"])}</h1>
    <p class="lead">{e(a["resumen"])}</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="gio-split" style="grid-template-columns:1.2fr .8fr;align-items:start">
      <div>
        <p class="eyebrow">El mercado aquí</p>
        <h2 style="font-size:var(--step-2)">Qué encuentras en {e(a["nombre"])}</h2>
        <p class="lead" style="font-size:var(--step-0)">{e(a["perfil"])}</p>
        <h3 style="font-size:var(--step-1);margin-top:2rem">Cómo se vive</h3>
        <p>{e(a["vive"])}</p>
      </div>
      <div>
        <h3 style="font-size:var(--step-1)">Colonias destacadas</h3>
        <div class="flex flex-wrap" style="margin-bottom:1.5rem">{dest_chips}</div>
        {f'<h3 style="font-size:var(--step-1)">Con guía completa</h3><div class="flex flex-wrap">{col_chips}</div>' if col_chips else ''}
      </div>
    </div>
    {stats}
  </div>
</section>

{listado}

{faq_block(faqs, f"Preguntas sobre {a['nombre']}")}

{cta_band(path, f"¿Buscas en {a['nombre']}?",
          "Escríbeme y te digo con franqueza si es la zona correcta para lo que necesitas, o cuál lo sería.",
          ("Hablar con Gio", "contacto/"), ("Ver propiedades", "propiedades/"))}
'''
    write(path, page(path,
        f'Propiedades en {a["nombre"]}, CDMX | Gio Filio',
        f'Guía de {a["nombre"]}, Ciudad de México: cómo se vive, colonias destacadas y {len(props)} propiedades en venta y renta con la asesoría de Gio Filio.',
        body, active="zonas/",
        schema=[breadcrumb_schema(crumbs), faq_schema(faqs), person_schema(),
                {"@context": "https://schema.org", "@type": "Place", "name": a["nombre"],
                 "description": a["resumen"],
                 "address": {"@type": "PostalAddress", "addressLocality": a["nombre"],
                             "addressRegion": "Ciudad de México", "addressCountry": "MX"},
                 "geo": {"@type": "GeoCoordinates", "latitude": a["lat"], "longitude": a["lng"]},
                 "containedInPlace": {"@type": "City", "name": "Ciudad de México"}}],
        og_image=ZONE_IMG[a["slug"]] + "-hero.jpg", page_type="alcaldia", **K()))


def build_colonia(c):
    path = f'propiedades/{c["slug"]}/index.html'
    R = lambda t: rel(path, t)
    props = by(colonia=c["slug"])
    venta = [p for p in props if p["operacion"] == "venta"]
    renta = [p for p in props if p["operacion"] == "renta"]
    deptos = [p for p in props if p["tipo"] in ("departamento", "penthouse", "loft")]
    casas = [p for p in props if p["tipo"] in ("casa", "casa-en-condominio")]
    alc_slug = ALCALDIA_SLUG_BY_NOMBRE[c["alcaldia"]]
    crumbs = [("Inicio", "index.html"), ("Zonas de CDMX", "zonas/"),
              (c["alcaldia"], f"zonas/{alc_slug}/"), (c["nombre"], None)]

    def bloque(titulo, lista, href=None):
        if not lista:
            return ""
        cta = f'<div class="cta-actions" style="margin-top:2rem"><a class="btn btn--ghost" href="{href}">Ver todas</a></div>' if href else ""
        return f'''<section class="section">
      <div class="wrap">
        <h2 style="font-size:var(--step-2);margin-bottom:2rem">{e(titulo)}</h2>
        {card_grid(path, lista[:6])}{cta}
      </div>
    </section>'''

    vida = [
        ("Estilo de vida", c["vivir"]),
        ("Qué tipo de propiedades hay", c["tipo_oferta"]),
        ("Movilidad", c["movilidad"]),
        ("Restaurantes y comercio", c["restaurantes"]),
        ("Parques y espacio público", c["parques"]),
        ("Escuelas y cultura", c["escuelas"]),
        ("Servicios cercanos", c["servicios"]),
    ]
    vida_html = "".join(f'<div><h3 style="font-size:var(--step-1)">{e(t)}</h3><p>{e(x)}</p></div>' for t, x in vida)

    faqs = [
        (f'¿Cuánto cuesta el metro cuadrado en {c["nombre"]}?',
         f'El precio de referencia en {c["nombre"]} ronda los {money(c["precio_m2_venta"])} por metro cuadrado en venta y {money(c["precio_m2_renta"])} por metro cuadrado al mes en renta. Es un promedio de zona: el valor real depende del nivel, la orientación, el estado del inmueble y la calle exacta.'),
        (f'¿Qué tipo de propiedades se consiguen en {c["nombre"]}?', c["tipo_oferta"]),
        (f'¿Cómo es la movilidad en {c["nombre"]}?', c["movilidad"]),
        (f'¿Conviene invertir en {c["nombre"]}?',
         f'Depende del objetivo. Con un precio de referencia de {money(c["precio_m2_venta"])} por m² en venta y {money(c["precio_m2_renta"])} por m² al mes en renta, el rendimiento bruto teórico de la zona se ubica cerca del {round(c["precio_m2_renta"]*12/c["precio_m2_venta"]*100,1)} por ciento anual. Antes de comprar hay que correr los números de la propiedad específica con comparables reales de renta.'),
    ]

    sin_inv = ""
    if not props:
        sin_inv = f'''<section class="section"><div class="wrap"><div class="empty">{icon("search")}
  <h3>Sin inventario publicado ahora mismo en {e(c["nombre"])}</h3>
  <p>La rotación en esta colonia es alta. Escríbeme y te aviso en cuanto entre algo que encaje con lo que buscas.</p>
  <div class="cta-actions"><a class="btn" href="{R("contacto/")}">Avísame cuando haya</a></div>
</div></div></section>'''

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page">
  <div class="hero-media">
    <picture>
      <source type="image/webp" srcset="{R(ZONE_IMG[c["slug"]] + "-hero.webp")}">
      <img src="{R(ZONE_IMG[c["slug"]] + "-hero.jpg")}" alt="{e(c["nombre"])}, {e(c["alcaldia"])}, Ciudad de México" width="1600" height="900" fetchpriority="high">
    </picture>
  </div>
  <div class="hero-inner wrap">
    <p class="eyebrow hero-eyebrow">{e(c["alcaldia"])} · Ciudad de México</p>
    <h1>Propiedades en {e(c["nombre"])}</h1>
    <p class="lead">{e(c["tagline"])}</p>
    <div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">
      <a class="btn btn--light" href="{R("propiedades/")}?colonia={c["slug"]}">Ver las {len(props)} propiedades</a>
      <a class="btn btn--outline-light" href="{R("contacto/")}">Preguntarle a Gio</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="stat-row">
      <div class="stat"><b>{money_short(c["precio_m2_venta"])}</b><span>Precio medio por m² · venta</span></div>
      <div class="stat"><b>${num(c["precio_m2_renta"])}</b><span>Renta media por m² al mes</span></div>
      <div class="stat"><b>{len(props)}</b><span>Propiedades publicadas</span></div>
      <div class="stat"><b>{e(rango(props)) or "—"}</b><span>Rango de precios</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap-narrow">
    <p class="eyebrow">La zona</p>
    <h2>Cómo es vivir en {e(c["nombre"])}</h2>
    <div class="stack" style="margin-top:2rem">{vida_html}</div>
    <div class="flex flex-wrap" style="margin-top:2rem">
      <span class="chip">CP {" · ".join(c["cp"])}</span>
      <a class="chip" href="{R("zonas/" + alc_slug + "/")}">{icon("pin")} {e(c["alcaldia"])}</a>
    </div>
  </div>
</section>

{bloque(f'Propiedades en venta en {c["nombre"]}', venta, R("propiedades/") + f'?colonia={c["slug"]}&operacion=venta')}
{bloque(f'Propiedades en renta en {c["nombre"]}', renta, R("propiedades/") + f'?colonia={c["slug"]}&operacion=renta')}
{bloque(f'Departamentos en {c["nombre"]}', deptos, R("propiedades/") + f'?colonia={c["slug"]}&tipo=departamento') if deptos else ""}
{bloque(f'Casas en {c["nombre"]}', casas, R("propiedades/") + f'?colonia={c["slug"]}&tipo=casa') if casas else ""}

{sin_inv}

{faq_block(faqs, "Preguntas sobre " + c["nombre"])}

{cta_band(path, f"¿{c['nombre']} es tu zona?",
          "Antes de que agendes diez visitas, hablemos veinte minutos. Normalmente eso reduce la búsqueda a la mitad.",
          ("Hablar con Gio", "contacto/"), ("Comparar con otras zonas", "zonas/"))}
'''
    write(path, page(path,
        f'Propiedades en {c["nombre"]}, CDMX | Gio Filio',
        f'{c["nombre"]}, {c["alcaldia"]}, CDMX: {len(props)} propiedades en venta y renta, precio por m² de {money(c["precio_m2_venta"])}, estilo de vida, movilidad y servicios. Asesoría de Gio Filio.',
        body, active="zonas/",
        schema=[breadcrumb_schema(crumbs), faq_schema(faqs), person_schema(),
                {"@context": "https://schema.org", "@type": "Place", "name": f'{c["nombre"]}, Ciudad de México',
                 "description": c["tagline"],
                 "address": {"@type": "PostalAddress", "addressLocality": c["alcaldia"],
                             "addressRegion": "Ciudad de México", "postalCode": c["cp"][0], "addressCountry": "MX"},
                 "geo": {"@type": "GeoCoordinates", "latitude": c["lat"], "longitude": c["lng"]},
                 "containedInPlace": {"@type": "City", "name": "Ciudad de México"}}],
        og_image=ZONE_IMG[c["slug"]] + "-hero.jpg", page_type="colonia", **K()))


# ============================================ SEO PROGRAMÁTICO /op/tipo/colonia
TIPO_URL = {"departamento": "departamentos", "casa": "casas", "penthouse": "penthouses",
            "loft": "lofts", "casa-en-condominio": "casas-en-condominio",
            "oficina": "oficinas", "local-comercial": "locales-comerciales",
            "terreno": "terrenos", "desarrollo": "desarrollos"}

def build_seo_combo(op, tipo, col):
    props = [p for p in PROPS if p["operacion"] == op and p["tipo"] == tipo and p["colonia_slug"] == col["slug"]]
    if not props:
        return
    tipo_url = TIPO_URL[tipo]
    path = f'{op}/{tipo_url}/{col["slug"]}/index.html'
    R = lambda t: rel(path, t)
    op_label = "en venta" if op == "venta" else "en renta"
    plural = TIPO_PLURAL[tipo]
    alc_slug = ALCALDIA_SLUG_BY_NOMBRE[col["alcaldia"]]
    titulo = f'{plural} {op_label} en {col["nombre"]}'
    tipo_index = f"{tipo_url}/" if tipo in ("departamento", "casa", "desarrollo") else "propiedades/"
    crumbs = [("Inicio", "index.html"),
              ("Venta" if op == "venta" else "Renta", f"{op}/"),
              (plural, tipo_index),
              (col["nombre"], None)]
    lo = min(p["precio"] for p in props)
    hi = max(p["precio"] for p in props)
    m2avg = round(sum(p["precio_m2"] for p in props) / len(props))

    faqs = [
        (f'¿Cuánto cuesta un {TIPO_LABEL[tipo].lower()} {op_label} en {col["nombre"]}?',
         f'Los {plural.lower()} {op_label} publicados en {col["nombre"]} van de {money(lo)} a {money(hi)}, con un precio medio de {money(m2avg)} por metro cuadrado{" al mes" if op == "renta" else ""}.'),
        (f'¿Qué incluye vivir en {col["nombre"]}?', col["vivir"]),
        (f'¿Cómo llego a {col["nombre"]}?', col["movilidad"]),
    ]

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page hero--compact hero--light">
  <div class="hero-inner wrap">
    <p class="eyebrow">{e(col["alcaldia"])} · Ciudad de México</p>
    <h1>{e(titulo)}</h1>
    <p class="lead" style="max-width:64ch">{len(props)} {plural.lower()} {op_label} en {e(col["nombre"])}, de {money(lo)} a {money(hi)}. Precio medio de {money(m2avg)} por m²{" al mes" if op == "renta" else ""}. {e(col["tagline"])}</p>
    <div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">
      <a class="btn" href="{R("propiedades/")}?colonia={col["slug"]}&operacion={op}&tipo={tipo}">Abrir con filtros y mapa</a>
      <a class="btn btn--ghost" href="{R("propiedades/" + col["slug"] + "/")}">Guía de {e(col["nombre"])}</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">{card_grid(path, props)}</div>
</section>

<section class="section section--ivory">
  <div class="wrap-narrow">
    <p class="eyebrow">Antes de decidir</p>
    <h2 style="font-size:var(--step-2)">Qué debes saber de {e(col["nombre"])}</h2>
    <p class="lead" style="font-size:var(--step-0)">{e(col["vivir"])}</p>
    <h3 style="font-size:var(--step-1);margin-top:2rem">Oferta típica</h3>
    <p>{e(col["tipo_oferta"])}</p>
    <h3 style="font-size:var(--step-1);margin-top:2rem">Movilidad</h3>
    <p>{e(col["movilidad"])}</p>
    <div class="flex flex-wrap" style="margin-top:2rem">
      <a class="chip" href="{R("propiedades/" + col["slug"] + "/")}">Todo en {e(col["nombre"])}</a>
      <a class="chip" href="{R("zonas/" + alc_slug + "/")}">{e(col["alcaldia"])}</a>
      <a class="chip" href="{R(f"{op}/")}">Todo {"en venta" if op == "venta" else "en renta"} en CDMX</a>
    </div>
  </div>
</section>

{faq_block(faqs, "Preguntas frecuentes")}

{cta_band(path, "¿Te muestro estas propiedades?",
          f"Puedo agendar las visitas de {col['nombre']} en una sola tarde y darte mi lectura honesta de cada una.",
          ("Hablar con Gio", "contacto/"))}
'''
    write(path, page(path,
        f'{titulo}, CDMX | desde {money_short(lo)}',
        f'{len(props)} {plural.lower()} {op_label} en {col["nombre"]}, {col["alcaldia"]}, Ciudad de México. Desde {money(lo)}. Precio medio {money(m2avg)} por m². Asesoría personal de Gio Filio.',
        body, schema=[breadcrumb_schema(crumbs), faq_schema(faqs), person_schema(),
                      {"@context": "https://schema.org", "@type": "ItemList",
                       "name": titulo, "numberOfItems": len(props),
                       "itemListElement": [{"@type": "ListItem", "position": i + 1,
                                            "url": canonical(p["url"]), "name": p["titulo"]}
                                           for i, p in enumerate(props)]}],
        og_image=ZONE_IMG[col["slug"]] + "-hero.jpg", page_type="seo_listing", **K()))


# =========================================================== CONOCE A GIO
def build_gio():
    path = "conoce-a-gio/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Conoce a Gio", None)]
    proc_html = ""
    for key in ("comprar", "rentar", "vender", "invertir"):
        pr = PROCESO[key]
        pasos = "".join(f'<li><div><h4>{e(t)}</h4><p>{e(d)}</p></div></li>' for t, d in pr["pasos"])
        proc_html += f'''<div style="margin-bottom:3.5rem">
      <h3 style="font-size:var(--step-2)">{e(pr["titulo"])}</h3>
      <p class="lead" style="font-size:var(--step-0);max-width:62ch">{e(pr["intro"])}</p>
      <ol class="step-list" style="margin-top:2rem">{pasos}</ol>
    </div>'''

    body = f'''
{breadcrumb(path, crumbs)}
<section class="section">
  <div class="wrap">
    <div class="gio-split">
      <div class="gio-split-media">
        <picture>
          <source type="image/webp" srcset="{R("assets/img/gio/perfil-800.webp")}">
          <img src="{R("assets/img/gio/perfil-800.jpg")}" alt="Gio Filio, asesora inmobiliaria en Ciudad de México" fetchpriority="high" width="800" height="1200">
        </picture>
      </div>
      <div>
        <p class="eyebrow">Conoce a Gio</p>
        <h1 style="font-weight:300;font-size:var(--step-4)">No se trata solo de metros cuadrados. Se trata de encontrar el lugar correcto para tu momento de vida.</h1>
        <hr class="rule-gold">
        <p class="lead">Soy Gio Filio, asesora inmobiliaria en la Ciudad de México. Trabajo exclusivamente aquí, en las 16 alcaldías, porque conocer bien un mercado vale más que cubrir muchos de forma superficial.</p>
        <div class="cta-actions" style="justify-content:flex-start;margin-top:2rem">
          <a class="btn" href="{R("contacto/")}">Hablemos de tu próximo espacio</a>
          <a class="btn btn--wa" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="conoce_gio">{icon("wa")} WhatsApp</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section--ivory">
  <div class="wrap-narrow">
    <p class="eyebrow">Quién soy</p>
    <h2>Empecé al revés que casi todos</h2>
    <div class="article">
      <p>La mayoría de las búsquedas inmobiliarias fracasan por la misma razón: empiezan por el catálogo. Alguien abre un portal, filtra por presupuesto y zona, y termina viendo cuarenta propiedades que se parecen entre sí sin saber cuál le conviene.</p>
      <p>Yo trabajo al revés. Antes de mostrarte una sola propiedad quiero saber a qué hora sales de casa, cuánto tardas en llegar al trabajo, si cocinas o pides, si tienes perro, si trabajas desde casa, cuánto tiempo piensas quedarte y qué te haría sentir que llegaste. Con eso, esas cuarenta opciones se convierten en seis. Y de esas seis, normalmente una es la correcta.</p>
      <p>Me especializo en la Ciudad de México porque es una ciudad donde cuatro cuadras cambian todo: el ruido, la luz, el tráfico, la seguridad, el precio y la reventa. Esa diferencia no se ve en una foto ni en una ficha técnica. Se ve caminando la calle un martes por la mañana y un sábado por la noche.</p>
      <p>Acompaño operaciones de compra, renta, venta e inversión, de principio a fin: desde la primera conversación hasta la firma en notaría y la entrega de llaves. No delego el proceso. Si trabajas conmigo, tratas conmigo.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap-narrow center">
    <p class="quote">“Encontrar casa es fácil. Encontrar tu casa es diferente.”</p>
    <hr class="rule-gold rule-gold--center">
  </div>
</section>

<section class="section section--navy">
  <div class="wrap">
    <p class="eyebrow">Cómo trabajo</p>
    <h2 style="max-width:24ch">Cuatro principios que no negocio</h2>
    <div class="grid grid-2" style="margin-top:3rem">
      <div><h3 style="color:#fff">Te digo lo que no te conviene</h3><p>Si una propiedad tiene un problema estructural, un condominio con el fondo de reserva agotado o una calle que te va a molestar en seis meses, lo vas a saber antes de ofertar. Prefiero perder una operación que ganarla mal.</p></div>
      <div><h3 style="color:#fff">Menos opciones, mejor elegidas</h3><p>No te voy a mandar veinte enlaces. Te voy a mandar cinco o seis, y de cada una te voy a explicar por qué está en la lista y qué le veo de riesgo.</p></div>
      <div><h3 style="color:#fff">Números antes que adjetivos</h3><p>Comparables cerrados de los últimos doce meses, precio por metro cuadrado real, gastos de cierre completos y rendimiento neto si es inversión. Sin “excelente plusvalía” sin respaldo.</p></div>
      <div><h3 style="color:#fff">Acompañamiento completo</h3><p>Revisión documental, negociación, coordinación notarial y entrega. El momento donde más se pierde dinero no es al elegir la propiedad, es en el papeleo.</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow">Proceso de asesoría</p>
    <h2 style="margin-bottom:3rem">Cada objetivo tiene un camino distinto</h2>
    {proc_html}
  </div>
</section>

<section class="section section--ivory">
  <div class="wrap">
    <p class="eyebrow eyebrow--center center">Testimonios</p>
    <h2 class="center" style="margin-bottom:3rem">Clientes que ya encontraron su espacio</h2>
    {testimonial_block(TESTIMONIOS, len(TESTIMONIOS))}
    <p class="center small muted" style="margin-top:2rem">Testimonios ilustrativos incluidos en la versión de demostración del sitio.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="prop-layout">
      <div class="gio-split-media">
        <picture>
          <source type="image/webp" srcset="{R("assets/img/gio/editorial-800.webp")}">
          <img src="{R("assets/img/gio/editorial-800.jpg")}" alt="Gio Filio, asesora inmobiliaria" loading="lazy" width="800" height="1200">
        </picture>
      </div>
      <div>{gio_card(path, titulo="Hablemos de tu próximo espacio", sub="Cuéntame qué buscas y en cuánto tiempo lo necesitas.")}</div>
    </div>
  </div>
</section>
'''
    write(path, page(path,
        "Conoce a Gio Filio — Asesora inmobiliaria en Ciudad de México",
        "Gio Filio, asesora inmobiliaria en las 16 alcaldías de la Ciudad de México. Cómo trabaja, su proceso para comprar, rentar, vender e invertir, y testimonios.",
        body, active="conoce-a-gio/",
        schema=[breadcrumb_schema(crumbs), person_schema(),
                {"@context": "https://schema.org", "@type": "AboutPage",
                 "name": "Conoce a Gio Filio", "url": canonical(path),
                 "mainEntity": {"@id": SITE + "/#gio-filio"}}],
        og_image="assets/img/gio/perfil-1200.jpg", page_type="about", **K()))


# =========================================================== INTENCIONES
def build_intencion(key, slug, titulo, h1, lead, hero_img, props_fn, extra_sections=""):
    path = f"{slug}/index.html"
    R = lambda t: rel(path, t)
    pr = PROCESO[key]
    crumbs = [("Inicio", "index.html"), (h1, None)]
    pasos = "".join(f'<li><div><h4>{e(t)}</h4><p>{e(d)}</p></div></li>' for t, d in pr["pasos"])
    props = props_fn()
    faqs = [f for f in FAQS_GENERALES if key[:5] in f[0].lower() or "asesoría" in f[0].lower()][:2] or FAQS_GENERALES[:3]

    hero_cta = searchbox(path, preset_op=("renta" if key == "rentar" else "venta")) if key in ("comprar", "rentar") else (
        '<div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">'
        f'<a class="btn btn--light" href="{R("contacto/")}">Hablar con Gio</a>'
        f'<a class="btn btn--outline-light" href="{R("valuacion/")}">Calcular valor de mi propiedad</a></div>')

    inventario = ""
    if props:
        inventario = f'''<section class="section section--ivory">
  <div class="wrap">
    <div class="carousel-head">
      <div><p class="eyebrow">Inventario</p><h2>Propiedades para empezar</h2></div>
      <a class="btn btn--ghost" href="{R("propiedades/")}">Ver todas</a>
    </div>
    {card_grid(path, props)}
  </div>
</section>'''

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page">
  <div class="hero-media">
    <picture><source type="image/webp" srcset="{R(hero_img + ".webp")}">
    <img src="{R(hero_img + ".jpg")}" alt="{e(h1)} en Ciudad de México" width="1600" height="900" fetchpriority="high"></picture>
  </div>
  <div class="hero-inner wrap">
    <p class="eyebrow hero-eyebrow">Con Gio · Ciudad de México</p>
    <h1>{e(h1)}</h1>
    <p class="lead">{e(lead)}</p>
    {hero_cta}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow">El proceso</p>
    <h2 style="max-width:24ch">{e(pr["titulo"])} con acompañamiento completo</h2>
    <p class="lead" style="max-width:64ch">{e(pr["intro"])}</p>
    <ol class="step-list" style="margin-top:3rem;max-width:820px">{pasos}</ol>
  </div>
</section>

{extra_sections}

{inventario}

{faq_block(faqs)}

<section class="section">
  <div class="wrap">
    <div class="prop-layout">
      <div>
        <p class="eyebrow">Siguiente paso</p>
        <h2>{e(titulo)}</h2>
        <p class="lead">La primera conversación es la que más tiempo ahorra. Veinte minutos bien usados reducen la búsqueda a la mitad.</p>
        <div class="stat-row" style="margin-top:2rem">
          <div class="stat"><b>16</b><span>Alcaldías cubiertas</span></div>
          <div class="stat"><b>1</b><span>Asesora, todo el proceso</span></div>
          <div class="stat"><b>0</b><span>Costo de la asesoría inicial</span></div>
        </div>
      </div>
      <div>{gio_card(path, titulo="Cuéntame qué buscas", sub="Gio te responde personalmente, normalmente el mismo día.")}</div>
    </div>
  </div>
</section>
'''
    write(path, page(path, titulo, lead, body, active=f"{slug}/",
        schema=[breadcrumb_schema(crumbs), faq_schema(faqs), person_schema()],
        og_image=hero_img + ".jpg", page_type=f"intencion_{key}", **K()))


def build_intenciones():
    build_intencion("comprar", "comprar",
        "Quiero comprar una propiedad en CDMX | Gio Filio",
        "Compra mejor acompañado.",
        "Comprar en la Ciudad de México toma entre tres y seis meses. La mayor parte de ese tiempo se reduce si las primeras conversaciones son las correctas.",
        ZONE_IMG["del-valle"] + "-hero",
        lambda: destacadas(6, operacion="venta"))

    build_intencion("rentar", "rentar",
        "Quiero rentar en CDMX | Gio Filio",
        "Encuentra un espacio que haga sentido para tu vida.",
        "En Roma, Condesa y Del Valle una buena propiedad se coloca en menos de dos semanas. Rentar bien es cuestión de velocidad y de llegar con los papeles listos.",
        ZONE_IMG["condesa"] + "-hero",
        lambda: destacadas(6, operacion="renta"))

    vender_extra = f'''<section class="section section--navy">
  <div class="wrap">
    <p class="eyebrow">Por qué no se vende</p>
    <h2 style="max-width:22ch">Casi nunca es la propiedad</h2>
    <div class="grid grid-3" style="margin-top:2.5rem">
      <div><h3 style="color:#fff">El precio de salida</h3><p>En ocho de cada diez casos, el problema es el precio inicial. Una propiedad sobrevalorada recibe visitas tres semanas y después el flujo se detiene por completo.</p></div>
      <div><h3 style="color:#fff">La primera fotografía</h3><p>La decisión de agendar una visita se toma en menos de tres segundos mirando una imagen en un teléfono. Una sesión profesional cuesta entre 3,500 y 8,000 pesos y es la inversión con mejor retorno del proceso.</p></div>
      <div><h3 style="color:#fff">La descripción genérica</h3><p>“Excelente ubicación” no dice nada. Distancia real al Metro, mantenimiento, orientación y estado del fondo de reserva sí filtran y traen prospectos calificados.</p></div>
    </div>
  </div>
</section>'''
    build_intencion("vender", "vender",
        "Quiero vender mi propiedad en CDMX | Gio Filio",
        "¿Quieres vender tu propiedad en CDMX?",
        "Empiezo con operaciones cerradas de los últimos doce meses en tu colonia, no con precios de lista. Con ese número decides si vendes, y a cuánto.",
        ZONE_IMG["san-angel"] + "-hero",
        lambda: [], extra_sections=vender_extra + build_vender_form_section())

    _rp = "invertir/index.html"
    _rows = []
    for c in sorted(COLONIAS, key=lambda x: -x["precio_m2_renta"] * 12 / x["precio_m2_venta"])[:10]:
        bruto = round(c["precio_m2_renta"] * 12 / c["precio_m2_venta"] * 100, 1)
        href = rel(_rp, "propiedades/" + c["slug"] + "/")
        _rows.append(
            f'<tr><th scope="row"><a href="{href}">{e(c["nombre"])}</a></th>'
            f'<td style="text-align:left">{e(c["alcaldia"])}</td>'
            f'<td style="text-align:left">{money(c["precio_m2_venta"])}</td>'
            f'<td style="text-align:left">${num(c["precio_m2_renta"])}</td>'
            f'<td style="text-align:left">{bruto}%</td></tr>')
    invertir_extra = f'''<section class="section section--ivory">
  <div class="wrap">
    <p class="eyebrow">Rendimiento por zona</p>
    <h2 style="margin-bottom:.5rem">Dónde cierran los números hoy</h2>
    <p class="lead" style="max-width:60ch;margin-bottom:2.5rem">Rendimiento bruto teórico calculado con el precio medio por m² de venta y de renta de cada colonia. Son promedios de zona: sirven para orientar, no para decidir.</p>
    <div style="overflow-x:auto"><table class="cmp-table" style="min-width:640px">
      <thead><tr><th scope="col">Colonia</th><th scope="col">Alcaldía</th><th scope="col">Venta / m²</th><th scope="col">Renta / m² mes</th><th scope="col">Bruto anual</th></tr></thead>
      <tbody>{"".join(_rows)}</tbody>
    </table></div>
    <p class="fin-note">El rendimiento neto descuenta mantenimiento, predial, seguro, vacancia y administración. En CDMX la diferencia entre bruto y neto suele estar entre 1.2 y 1.8 puntos porcentuales.</p>
  </div>
</section>'''
    build_intencion("invertir", "invertir",
        "Quiero invertir en bienes raíces en CDMX | Gio Filio",
        "Una propiedad de inversión se compra con hoja de cálculo.",
        "La pregunta correcta no es dónde te gustaría vivir, sino qué se renta rápido, a quién y con qué rendimiento real después de gastos.",
        ZONE_IMG["narvarte"] + "-hero",
        lambda: [p for p in PROPS if "oportunidad" in p["badges"] or p["tipo"] == "desarrollo"][:6],
        extra_sections=invertir_extra)


def build_vender_form_section():
    path = "vender/index.html"
    R = lambda t: rel(path, t)
    alcs = "".join(f'<option value="{a["slug"]}">{e(a["nombre"])}</option>' for a in ALCALDIAS)
    tipos = "".join(f'<option value="{t[0]}">{e(t[1])}</option>' for t in TIPOS)
    return f'''<section class="section" id="formulario">
  <div class="wrap">
    <div class="prop-layout" style="grid-template-columns:1fr 380px">
      <div>
        <p class="eyebrow">Solicitar valoración</p>
        <h2>Cuéntame de tu propiedad</h2>
        <p class="lead">Con estos datos preparo un análisis de comparables cerrados de tu colonia y te doy un rango de precio realista, sin compromiso.</p>
        <form id="venderForm" data-lead-form data-form-name="vender_propiedad" data-source="landing_vender" data-event="submit_property" novalidate style="margin-top:2rem">
          <div class="form-grid-2">
            <div class="form-row"><label for="ven-nombre">Nombre</label>
              <input type="text" id="ven-nombre" name="nombre" required autocomplete="name" placeholder="Tu nombre"><span class="err">Escribe tu nombre</span></div>
            <div class="form-row"><label for="ven-tel">WhatsApp</label>
              <input type="tel" id="ven-tel" name="telefono" required autocomplete="tel" inputmode="tel" placeholder="55 1234 5678"><span class="err">Teléfono de 10 dígitos</span></div>
          </div>
          <div class="form-row"><label for="ven-mail">Correo</label>
            <input type="email" id="ven-mail" name="email" required autocomplete="email" placeholder="tu@correo.com"><span class="err">Correo válido</span></div>
          <div class="form-row"><label for="ven-dir">Dirección aproximada</label>
            <input type="text" id="ven-dir" name="direccion" placeholder="Calle y número, o cruce de calles"></div>
          <div class="form-grid-2">
            <div class="form-row"><label for="venAlcaldia">Alcaldía</label>
              <select id="venAlcaldia" name="alcaldia" required><option value="">Selecciona</option>{alcs}</select><span class="err">Elige la alcaldía</span></div>
            <div class="form-row"><label for="venColonia">Colonia</label>
              <select id="venColonia" name="colonia"><option value="">Selecciona la alcaldía primero</option></select></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label for="ven-tipo">Tipo de propiedad</label>
              <select id="ven-tipo" name="tipo" required><option value="">Selecciona</option>{tipos}</select><span class="err">Elige el tipo</span></div>
            <div class="form-row"><label for="ven-m2">Superficie (m²)</label>
              <input type="number" id="ven-m2" name="m2" min="10" max="5000" required placeholder="120" inputmode="numeric"><span class="err">Indica los metros</span></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label for="ven-rec">Recámaras</label>
              <input type="number" id="ven-rec" name="recamaras" min="0" max="12" placeholder="3" inputmode="numeric"></div>
            <div class="form-row"><label for="ven-ban">Baños</label>
              <input type="number" id="ven-ban" name="banos" min="0" max="12" placeholder="2" inputmode="numeric"></div>
          </div>
          <div class="form-row"><label for="ven-precio">Precio esperado (MXN)</label>
            <input type="number" id="ven-precio" name="precio" min="0" step="50000" placeholder="8,000,000" inputmode="numeric"></div>
          <div class="form-row"><label for="ven-com">Comentarios</label>
            <textarea id="ven-com" name="comentarios" placeholder="Cuéntame del estado del inmueble, si está habitado y en cuánto tiempo te gustaría vender."></textarea></div>
          <div class="form-row">
            <label for="venFotos" id="venFotosLabel">Agregar fotografías (opcional)</label>
            <input type="file" id="venFotos" name="fotos" accept="image/*" multiple>
          </div>
          <label class="form-consent"><input type="checkbox" name="consent" required>
            <span>Acepto el <a href="{R("aviso-de-privacidad/")}">aviso de privacidad</a> y que Gio Filio me contacte.</span></label>
          <div class="form-actions"><button type="submit" class="btn btn--lg">Solicitar valoración</button></div>
        </form>
        <div class="form-success" id="venderSuccess" role="status">
          {icon("checkc")}
          <h4 style="margin-bottom:.35rem">Solicitud recibida</h4>
          <p class="small">Gio prepara el análisis de comparables de tu colonia y te contacta en menos de 48 horas con un rango de precio sustentado.</p>
          <a class="btn btn--wa btn--sm" style="margin-top:1rem" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="post_vender">{icon("wa")} Adelantar por WhatsApp</a>
        </div>
      </div>
      <aside>
        <div class="filters-panel">
          <h3 style="font-size:var(--step-1)">Qué recibes</h3>
          <ul class="feature-list" style="grid-template-columns:1fr;margin-top:1rem">
            <li>{icon("check")}Análisis de operaciones cerradas de los últimos 12 meses</li>
            <li>{icon("check")}Rango de precio realista, no aspiracional</li>
            <li>{icon("check")}Recomendaciones de preparación de bajo costo</li>
            <li>{icon("check")}Plan de difusión y perfil de comprador objetivo</li>
            <li>{icon("check")}Estimación de tiempo de venta</li>
          </ul>
          <hr class="rule-gold">
          <p class="small muted">¿Prefieres una cifra ahora mismo? Usa la herramienta de valuación y en un minuto tienes un rango estimado.</p>
          <a class="btn btn--ghost btn--block" href="{R("valuacion/")}">Calcular valor estimado</a>
        </div>
      </aside>
    </div>
  </div>
</section>'''


# =========================================================== VALUACIÓN
def build_valuacion():
    path = "valuacion/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Valuación de propiedad", None)]
    alcs = "".join(f'<option value="{a["slug"]}">{e(a["nombre"])}</option>' for a in ALCALDIAS)
    cols = "".join(f'<option value="{c["slug"]}">{e(c["nombre"])} — {e(c["alcaldia"])}</option>' for c in COLONIAS)
    tipos = "".join(f'<option value="{t[0]}">{e(t[1])}</option>' for t in TIPOS[:5])
    faqs = [
        ("¿Qué tan precisa es esta estimación?",
         "Es una referencia inicial calculada con el precio medio por metro cuadrado de la colonia y ajustes por tipo, antigüedad, recámaras y estacionamientos. Un valor real requiere revisar la propiedad, su nivel, orientación, estado y comparables cerrados específicos. Por eso el rango es amplio."),
        ("¿La valuación tiene costo?",
         "No. La estimación en línea y el análisis de comparables que preparo después son gratuitos y sin compromiso."),
        ("¿Sirve para trámites bancarios o notariales?",
         "No. Para crédito o escrituración se requiere un avalúo formal realizado por un perito valuador autorizado. Esta herramienta es orientativa y te ayuda a decidir si te conviene vender."),
    ]
    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page hero--light hero--compact">
  <div class="hero-inner wrap">
    <p class="eyebrow">Herramienta</p>
    <h1>¿Cuánto vale tu propiedad?</h1>
    <p class="lead" style="max-width:60ch">Un rango estimado en menos de un minuto, calculado con el precio de referencia por metro cuadrado de tu colonia en la Ciudad de México.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="prop-layout" style="grid-template-columns:1fr 400px">
      <div>
        <form id="valForm" data-lead-form data-form-name="valuacion" data-source="herramienta_valuacion" data-event="request_valuation" novalidate>
          <div class="progress-steps" aria-hidden="true"><i class="is-on"></i><i class="is-on"></i><i></i></div>
          <h2 style="font-size:var(--step-2)">Datos de la propiedad</h2>
          <div class="form-grid-2">
            <div class="form-row"><label for="valAlcaldia">Alcaldía</label>
              <select id="valAlcaldia" name="alcaldia" required><option value="">Selecciona</option>{alcs}</select><span class="err">Elige la alcaldía</span></div>
            <div class="form-row"><label for="valColonia">Colonia</label>
              <select id="valColonia" name="colonia" required><option value="">Selecciona</option>{cols}</select><span class="err">Elige la colonia</span></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label for="val-tipo">Tipo</label>
              <select id="val-tipo" name="tipo" required><option value="">Selecciona</option>{tipos}</select><span class="err">Elige el tipo</span></div>
            <div class="form-row"><label for="val-m2">Superficie (m²)</label>
              <input type="number" id="val-m2" name="m2" min="20" max="3000" required placeholder="120" inputmode="numeric"><span class="err">Indica los metros</span></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label for="val-rec">Recámaras</label>
              <input type="number" id="val-rec" name="recamaras" min="0" max="12" value="2" inputmode="numeric"></div>
            <div class="form-row"><label for="val-ban">Baños</label>
              <input type="number" id="val-ban" name="banos" min="0" max="12" value="2" inputmode="numeric"></div>
          </div>
          <div class="form-grid-2">
            <div class="form-row"><label for="val-est">Estacionamientos</label>
              <input type="number" id="val-est" name="estacionamientos" min="0" max="10" value="1" inputmode="numeric"></div>
            <div class="form-row"><label for="val-ant">Antigüedad (años)</label>
              <input type="number" id="val-ant" name="antiguedad" min="0" max="120" value="10" inputmode="numeric"></div>
          </div>
          <hr class="divider">
          <h3 style="font-size:var(--step-1)">¿A dónde te enviamos el análisis completo?</h3>
          <p class="small muted">Con tus datos preparo además un comparativo con operaciones cerradas reales de tu colonia.</p>
          <div class="form-grid-2">
            <div class="form-row"><label for="val-nombre">Nombre</label>
              <input type="text" id="val-nombre" name="nombre" required autocomplete="name" placeholder="Tu nombre"><span class="err">Escribe tu nombre</span></div>
            <div class="form-row"><label for="val-tel">WhatsApp</label>
              <input type="tel" id="val-tel" name="telefono" required autocomplete="tel" inputmode="tel" placeholder="55 1234 5678"><span class="err">Teléfono de 10 dígitos</span></div>
          </div>
          <div class="form-row"><label for="val-mail">Correo</label>
            <input type="email" id="val-mail" name="email" required autocomplete="email" placeholder="tu@correo.com"><span class="err">Correo válido</span></div>
          <label class="form-consent"><input type="checkbox" name="consent" required>
            <span>Acepto el <a href="{R("aviso-de-privacidad/")}">aviso de privacidad</a> y que Gio Filio me contacte.</span></label>
          <div class="form-actions"><button type="submit" class="btn btn--lg">Ver mi valuación estimada</button></div>
        </form>

        <div class="valuacion-result" id="valResult" role="status">
          <p class="eyebrow">Resultado estimado</p>
          <div class="val-range">
            <div class="vr-lbl">Rango estimado de valor</div>
            <div class="vr-num"><span id="valLow">—</span> — <span id="valHigh">—</span></div>
            <div class="val-bar"><i style="left:12%;right:12%"></i></div>
            <p style="color:rgba(255,255,255,.75);margin:0">Valor central estimado: <strong id="valCentral">—</strong></p>
          </div>
          <table class="fin-table" style="margin-top:2rem">
            <tbody>
              <tr><th>Zona considerada</th><td id="valZona">—</td></tr>
              <tr><th>Precio de referencia de la colonia por m²</th><td id="valBase">—</td></tr>
              <tr><th>Precio estimado por m² de tu propiedad</th><td id="valM2">—</td></tr>
            </tbody>
          </table>
          <p class="fin-note">Esta cifra es orientativa y no sustituye un avalúo formal. Para vender bien, el siguiente paso es revisar operaciones cerradas comparables de tu calle y tu edificio. Gio te contacta para prepararlo.</p>
          <div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">
            <a class="btn" href="{R("vender/")}">Quiero vender con Gio</a>
            <a class="btn btn--wa" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="post_valuacion">{icon("wa")} Comentarlo por WhatsApp</a>
          </div>
        </div>
      </div>
      <aside>
        <div class="filters-panel">
          <h3 style="font-size:var(--step-1)">Cómo se calcula</h3>
          <p class="small">Se parte del precio medio por metro cuadrado de la colonia y se aplican ajustes por tipo de propiedad, antigüedad, número de recámaras y estacionamientos.</p>
          <hr class="rule-gold">
          <h4 style="font-size:var(--step-0)">Lo que la fórmula no ve</h4>
          <ul class="prose" style="font-size:var(--step--1)">
            <li>Nivel, orientación y vista</li>
            <li>Estado real de acabados e instalaciones</li>
            <li>Salud financiera del condominio</li>
            <li>Ruido y características de la calle exacta</li>
            <li>Comparables cerrados de tu edificio</li>
          </ul>
          <p class="small muted">Por eso el rango es amplio: es un punto de partida, no un precio de lista.</p>
        </div>
      </aside>
    </div>
  </div>
</section>

{faq_block(faqs)}
'''
    write(path, page(path, "¿Cuánto vale tu propiedad en CDMX? | Valuación | Gio Filio",
        "Calcula un rango estimado del valor de tu departamento o casa en Ciudad de México con el precio de referencia por m² de tu colonia. Gratis y sin compromiso.",
        body, schema=[breadcrumb_schema(crumbs), faq_schema(faqs), person_schema()],
        page_type="valuacion", **K()))


# =========================================================== FAVORITOS / COMPARADOR
def build_favoritos():
    path = "favoritos/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Favoritos", None)]
    body = f'''
{breadcrumb(path, crumbs)}
<section class="section-sm">
  <div class="wrap">
    <div class="results-head">
      <div>
        <p class="eyebrow">Tu selección</p>
        <h1 style="font-size:var(--step-3)">Mis propiedades favoritas</h1>
        <p class="results-count" id="favCount"><b>0</b> propiedades guardadas</p>
      </div>
      <div class="results-toolbar">
        <button type="button" class="btn btn--ghost btn--sm" id="favClear">Vaciar</button>
        <button type="button" class="btn btn--sm" id="favCompare">Comparar</button>
      </div>
    </div>
    <p class="small muted" style="max-width:62ch">Tus favoritos se guardan en este navegador. La arquitectura está preparada para cuentas de usuario: cuando existan, la lista se sincroniza entre dispositivos.</p>
    <div id="favList" style="margin-top:2rem" aria-live="polite"></div>
  </div>
</section>

<div class="cmp-bar" id="cmpBar">
  <span class="cb-txt">0 propiedades seleccionadas</span>
  <a class="btn btn--light btn--sm" href="{R("comparador/")}">Comparar</a>
</div>

{cta_band(path, "¿Ya tienes tus finalistas?",
          "Mándamelas y te doy mi lectura honesta de cada una: qué le veo bien, qué le veo de riesgo y cuál elegiría yo.",
          ("Hablar con Gio", "contacto/"), ("Seguir explorando", "propiedades/"))}
'''
    write(path, page(path, "Mis propiedades favoritas | Gio Filio",
        "Tus propiedades guardadas en Ciudad de México. Compáralas y compártelas con Gio para recibir una lectura honesta de cada una.",
        body, noindex=True, schema=[breadcrumb_schema(crumbs)], page_type="favoritos", **K()))


def build_comparador():
    path = "comparador/index.html"
    crumbs = [("Inicio", "index.html"), ("Comparador", None)]
    body = f'''
{breadcrumb(path, crumbs)}
<section class="section-sm">
  <div class="wrap">
    <p class="eyebrow">Decidir con datos</p>
    <h1 style="font-size:var(--step-3)">Comparador de propiedades</h1>
    <p class="lead" style="max-width:64ch">Hasta tres propiedades lado a lado: precio, precio por m², superficie, recámaras, baños, estacionamientos, antigüedad, mantenimiento y amenidades. El mejor valor de cada fila aparece resaltado.</p>
    <div id="cmpRoot" style="margin-top:2.5rem" aria-live="polite"></div>
  </div>
</section>

{cta_band(path, "Dos parecen iguales y no lo son.",
          "La diferencia casi nunca está en la ficha técnica. Está en el nivel, la orientación, el condominio y la calle. Eso te lo puedo decir yo.",
          ("Pedirle a Gio que las compare", "contacto/"), ("Ver más propiedades", "propiedades/"))}
'''
    write(path, page(path, "Comparador de propiedades en CDMX | Gio Filio",
        "Compara hasta tres propiedades de Ciudad de México lado a lado: precio, precio por m², superficie, amenidades y antigüedad.",
        body, noindex=True, schema=[breadcrumb_schema(crumbs)], page_type="comparador", **K()))


# =========================================================== BLOG
def build_blog():
    path = "blog/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Blog y guías", None)]
    cats = "".join(f'<a class="chip" href="#cat-{slugify(c)}">{e(c)}</a>' for c in BLOG_CATEGORIAS)
    cards = "".join(f'''<a class="post-card" href="{R("blog/" + b["slug"] + "/")}">
      <div class="pc-media"><img src="{R(BLOG_IMG[b["slug"]] + "-card.jpg")}" alt="{e(b["titulo"])}" loading="lazy" width="640" height="400"></div>
      <div class="pc-body">
        <div class="post-meta"><span class="cat">{e(b["categoria"])}</span><span>{b["lectura"]} min de lectura</span></div>
        <h3>{e(b["titulo"])}</h3><p>{e(b["resumen"])}</p>
        <span class="link-arrow">Leer guía{icon("arrow")}</span>
      </div></a>''' for b in BLOG)
    by_cat = ""
    for c in BLOG_CATEGORIAS:
        posts = [b for b in BLOG if b["categoria"] == c]
        if not posts:
            continue
        lis = "".join(f'<li><a href="{R("blog/" + b["slug"] + "/")}">{e(b["titulo"])}</a> <span class="small muted">· {b["lectura"]} min</span></li>' for b in posts)
        by_cat += f'<div id="cat-{slugify(c)}"><h3 style="font-size:var(--step-1)">{e(c)}</h3><ul class="prose">{lis}</ul></div>'

    body = f'''
{breadcrumb(path, crumbs)}
<section class="hero hero--page hero--light hero--compact">
  <div class="hero-inner wrap">
    <p class="eyebrow">Blog y guías</p>
    <h1>Para decidir con información</h1>
    <p class="lead" style="max-width:64ch">Guías prácticas sobre comprar, rentar, vender e invertir en la Ciudad de México. Sin frases de folleto: números, procesos y lo que realmente conviene revisar.</p>
    <div class="flex flex-wrap" style="margin-top:1.5rem">{cats}</div>
  </div>
</section>

<section class="section">
  <div class="wrap"><div class="grid grid-3">{cards}</div></div>
</section>

<section class="section section--ivory">
  <div class="wrap">
    <p class="eyebrow">Por categoría</p>
    <h2 style="margin-bottom:2rem">Todas las guías</h2>
    <div class="grid grid-3">{by_cat}</div>
  </div>
</section>

{cta_band(path, "¿Tu caso no está en ninguna guía?",
          "Escríbeme y lo resolvemos en una conversación. Suele ser más rápido que leer diez artículos.",
          ("Hablar con Gio", "contacto/"))}
'''
    write(path, page(path, "Blog y guías inmobiliarias de CDMX | Gio Filio",
        "Guías sobre comprar, rentar, vender e invertir en Ciudad de México: precios por zona, créditos hipotecarios, errores comunes y análisis de colonias.",
        body, schema=[breadcrumb_schema(crumbs),
                      {"@context": "https://schema.org", "@type": "Blog",
                       "name": "Blog de Gio Filio", "url": canonical(path),
                       "publisher": {"@id": SITE + "/#gio-filio"},
                       "blogPost": [{"@type": "BlogPosting", "headline": b["titulo"],
                                     "url": canonical(f'blog/{b["slug"]}/'), "datePublished": b["fecha"]}
                                    for b in BLOG]}],
        page_type="blog_index", **K()))

    for b in BLOG:
        build_post(b)


def build_post(b):
    path = f'blog/{b["slug"]}/index.html'
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Blog", "blog/"), (b["titulo"], None)]
    cuerpo = "".join(f'<h2>{e(t)}</h2>' + "".join(f"<p>{e(par)}</p>" for par in x.split("\n") if par.strip())
                     for t, x in b["cuerpo"])
    rel_posts = [o for o in BLOG if o["slug"] != b["slug"] and o["categoria"] == b["categoria"]][:2]
    if len(rel_posts) < 2:
        rel_posts += [o for o in BLOG if o["slug"] != b["slug"] and o not in rel_posts][:2 - len(rel_posts)]
    rel_html = "".join(f'''<a class="post-card" href="{R("blog/" + o["slug"] + "/")}">
      <div class="pc-media"><img src="{R(BLOG_IMG[o["slug"]] + "-card.jpg")}" alt="{e(o["titulo"])}" loading="lazy" width="640" height="400"></div>
      <div class="pc-body"><div class="post-meta"><span class="cat">{e(o["categoria"])}</span><span>{o["lectura"]} min</span></div>
      <h3>{e(o["titulo"])}</h3></div></a>''' for o in rel_posts)

    body = f'''
{breadcrumb(path, crumbs)}
<article>
  <header class="section-sm">
    <div class="wrap-narrow">
      <div class="post-meta" style="margin-bottom:1rem"><span class="cat">{e(b["categoria"])}</span><span>{b["lectura"]} min de lectura</span><span>{e(b["fecha"])}</span></div>
      <h1 style="font-size:var(--step-4)">{e(b["titulo"])}</h1>
      <p class="lead">{e(b["resumen"])}</p>
    </div>
  </header>
  <div class="wrap">
    <picture>
      <source type="image/webp" srcset="{R(BLOG_IMG[b["slug"]] + "-hero.webp")}">
      <img src="{R(BLOG_IMG[b["slug"]] + "-hero.jpg")}" alt="{e(b["titulo"])}" style="border-radius:var(--r-lg)" fetchpriority="high" width="1400" height="700">
    </picture>
  </div>
  <div class="section">
    <div class="wrap-narrow">
      <div class="article">{cuerpo}</div>
      <hr class="divider">
      <div class="flex flex-wrap">
        <a class="chip" href="{R("propiedades/")}">Ver propiedades en CDMX</a>
        <a class="chip" href="{R("zonas/")}">Explorar zonas</a>
        <a class="chip" href="{R("valuacion/")}">Valuar mi propiedad</a>
      </div>
    </div>
  </div>
</article>

<section class="section section--ivory">
  <div class="wrap">
    <div class="prop-layout" style="grid-template-columns:1fr 380px">
      <div>
        <p class="eyebrow">Sigue leyendo</p>
        <h2 style="font-size:var(--step-2);margin-bottom:2rem">Guías relacionadas</h2>
        <div class="grid grid-2">{rel_html}</div>
      </div>
      <div>{gio_card(path, titulo="¿Dudas sobre tu caso?", sub="Gio responde personalmente, sin costo ni compromiso.")}</div>
    </div>
  </div>
</section>
'''
    post_title = b["titulo"] if len(b["titulo"]) > 58 else f'{b["titulo"]} | Gio Filio'
    write(path, page(path, post_title,
        b["resumen"], body,
        schema=[breadcrumb_schema(crumbs), person_schema(),
                {"@context": "https://schema.org", "@type": "BlogPosting",
                 "headline": b["titulo"], "description": b["resumen"],
                 "url": canonical(path), "datePublished": b["fecha"], "dateModified": b["fecha"],
                 "image": SITE + "/" + BLOG_IMG[b["slug"]] + "-hero.jpg",
                 "articleSection": b["categoria"], "inLanguage": "es-MX",
                 "wordCount": sum(len(x.split()) for _, x in b["cuerpo"]),
                 "author": {"@type": "Person", "name": "Gio Filio", "url": SITE + "/conoce-a-gio/"},
                 "publisher": {"@id": SITE + "/#gio-filio"},
                 "mainEntityOfPage": {"@type": "WebPage", "@id": canonical(path)}}],
        og_image=BLOG_IMG[b["slug"]] + "-hero.jpg", page_type="blog_post", **K()))


# =========================================================== CONTACTO + LEGAL
def build_contacto():
    path = "contacto/index.html"
    R = lambda t: rel(path, t)
    crumbs = [("Inicio", "index.html"), ("Contacto", None)]
    body = f'''
{breadcrumb(path, crumbs)}
<section class="section">
  <div class="wrap">
    <div class="prop-layout" style="grid-template-columns:1fr 420px">
      <div>
        <p class="eyebrow">Contacto</p>
        <h1 style="font-size:var(--step-4);max-width:18ch">Hablemos de tu próximo espacio</h1>
        <p class="lead" style="max-width:58ch">Cuéntame qué buscas, en qué zona y en cuánto tiempo lo necesitas. Te respondo personalmente, normalmente el mismo día.</p>
        <hr class="rule-gold">
        <div class="grid grid-2" style="margin-top:2.5rem">
          <div>
            <h3 style="font-size:var(--step-1)">WhatsApp</h3>
            <p class="small muted" style="margin-bottom:.6rem">La vía más rápida. Suelo responder en el día.</p>
            <a class="btn btn--wa" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="pagina_contacto">{icon("wa")} {e(MARCA["whatsapp_display"])}</a>
          </div>
          <div>
            <h3 style="font-size:var(--step-1)">Correo</h3>
            <p class="small muted" style="margin-bottom:.6rem">Para documentos y análisis detallados.</p>
            <a class="btn btn--ghost" href="mailto:{MARCA["email"]}">{icon("mail")} {e(MARCA["email"])}</a>
          </div>
          <div>
            <h3 style="font-size:var(--step-1)">Zona de trabajo</h3>
            <p>Las 16 alcaldías de la Ciudad de México, exclusivamente. Visitas y recorridos coordinados según tu disponibilidad.</p>
          </div>
          <div>
            <h3 style="font-size:var(--step-1)">Horario</h3>
            <p>Lunes a viernes de 9:00 a 19:00 y sábados de 10:00 a 15:00, hora de la Ciudad de México. Los recorridos se agendan también fuera de ese horario.</p>
          </div>
        </div>
        <div class="flex flex-wrap" style="margin-top:2.5rem">
          <a class="chip" href="{MARCA["instagram"]}" target="_blank" rel="noopener">{icon("ig")} Instagram</a>
          <a class="chip" href="{MARCA["facebook"]}" target="_blank" rel="noopener">{icon("fb")} Facebook</a>
        </div>
      </div>
      <div>
        <div class="gio-card" style="position:static">
          <div class="gio-card-top">
            <img class="gio-avatar" src="{R("assets/img/gio/avatar-320.jpg")}" alt="Gio Filio, asesora inmobiliaria" width="62" height="62">
            <div><div class="gc-name">Gio Filio</div><div class="gc-role">Asesora Inmobiliaria · CDMX</div></div>
            <img class="gc-logo" src="{R("assets/img/brand/isotipo-blanco-navy.png")}" alt="" aria-hidden="true" width="26" height="26">
          </div>
          <div class="gio-card-body">
            <h4>Escríbeme</h4>
            <p class="small">Entre más específico seas, mejor puedo ayudarte desde el primer mensaje.</p>
            {contact_form(path, form_name="contacto_general", source="pagina_contacto", show_operacion=True)}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{faq_block(FAQS_GENERALES)}
'''
    write(path, page(path, "Contacto | Gio Filio — Asesoría inmobiliaria en CDMX",
        "Habla con Gio Filio por WhatsApp, correo o formulario. Asesoría inmobiliaria en las 16 alcaldías de la Ciudad de México para comprar, rentar, vender o invertir.",
        body, schema=[breadcrumb_schema(crumbs), faq_schema(FAQS_GENERALES), person_schema(),
                      {"@context": "https://schema.org", "@type": "ContactPage",
                       "name": "Contacto — Gio Filio", "url": canonical(path)}],
        page_type="contacto", **K()))


LEGAL_PRIVACIDAD = [
    ("Responsable del tratamiento",
     "Gio Filio, con domicilio en la Ciudad de México y correo de contacto gio@giofilio.com, es responsable del uso y protección de sus datos personales, en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, su Reglamento y los Lineamientos del Aviso de Privacidad."),
    ("Datos personales que recabamos",
     "Recabamos datos de identificación y contacto: nombre, número de teléfono o WhatsApp, correo electrónico y el contenido de los mensajes que usted nos envía. Cuando solicita una valoración o publica una propiedad, recabamos además datos del inmueble: ubicación aproximada, alcaldía, colonia, tipo, superficie, número de recámaras y baños, antigüedad y precio esperado. No recabamos datos personales sensibles."),
    ("Finalidades primarias",
     "Sus datos se utilizan para: atender su solicitud de información sobre una propiedad; contactarle por WhatsApp, correo o teléfono; agendar y coordinar visitas; preparar análisis de valuación y comparables de mercado; dar seguimiento a su proceso de compra, renta, venta o inversión; y cumplir con las obligaciones legales aplicables a la intermediación inmobiliaria."),
    ("Finalidades secundarias",
     "De manera adicional, y solo si usted no manifiesta su oposición, podemos utilizar sus datos para enviarle nuevas propiedades que coincidan con su búsqueda, guías y contenidos informativos sobre el mercado inmobiliario de la Ciudad de México, e invitaciones a eventos. Puede oponerse a estas finalidades en cualquier momento escribiendo a gio@giofilio.com, sin que ello afecte la atención de su solicitud principal."),
    ("Transferencias de datos",
     "Sus datos pueden compartirse con terceros necesarios para completar la operación que usted solicita: propietarios o arrendadores de la propiedad de su interés, notarías públicas, instituciones financieras que evalúen su crédito, peritos valuadores, empresas de póliza jurídica y proveedores tecnológicos que operan la plataforma. Estas transferencias son las estrictamente necesarias y no requieren su consentimiento adicional conforme al artículo 37 de la Ley. No vendemos ni comercializamos sus datos personales."),
    ("Derechos ARCO",
     "Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de su información personal en caso de que esté desactualizada, sea inexacta o incompleta (Rectificación); que la eliminemos de nuestros registros cuando considere que no está siendo utilizada conforme a los principios, deberes y obligaciones previstos en la normativa (Cancelación); así como oponerse al uso de sus datos personales para fines específicos (Oposición). Para ejercer estos derechos envíe una solicitud a gio@giofilio.com indicando su nombre completo, un medio para comunicarle la respuesta, los documentos que acrediten su identidad y una descripción clara de los datos respecto de los que busca ejercer su derecho. Responderemos en un plazo máximo de veinte días hábiles."),
    ("Revocación del consentimiento",
     "Puede revocar el consentimiento que nos otorgó para el tratamiento de sus datos personales en cualquier momento, escribiendo a gio@giofilio.com. Es posible que por obligaciones legales debamos conservar cierta información aun después de la revocación."),
    ("Uso de cookies y tecnologías de rastreo",
     "Este sitio utiliza almacenamiento local del navegador para conservar sus propiedades favoritas y las seleccionadas para comparación. Esa información permanece en su dispositivo y no se envía a nuestros servidores. Cuando estén activas, las herramientas de analítica —Google Analytics 4, Google Tag Manager, Meta Pixel y Google Ads— pueden recabar datos de navegación como páginas visitadas, origen del tráfico y eventos de interacción. Puede deshabilitar cookies desde la configuración de su navegador."),
    ("Medidas de seguridad",
     "Aplicamos medidas administrativas, técnicas y físicas razonables para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso, acceso o tratamiento no autorizado."),
    ("Cambios al aviso de privacidad",
     "Este aviso puede sufrir modificaciones derivadas de nuevos requerimientos legales, de nuestras propias necesidades o de cambios en nuestro modelo de negocio. Cualquier modificación se publicará en esta misma página, indicando la fecha de última actualización."),
    ("Autoridad competente",
     "Si considera que su derecho a la protección de datos personales ha sido lesionado, puede acudir ante la autoridad competente en materia de protección de datos personales en México para presentar la denuncia que corresponda."),
]

LEGAL_TERMINOS = [
    ("Objeto y aceptación",
     "Estos términos regulan el acceso y uso del sitio web de Gio Filio — Tu espacio ideal. Al navegar en el sitio usted acepta estos términos en su totalidad. Si no está de acuerdo, le pedimos abstenerse de utilizarlo."),
    ("Naturaleza demostrativa del sitio y del inventario",
     "Esta versión del sitio es una demostración funcional. Las propiedades publicadas constituyen un conjunto de datos de ejemplo, están identificadas como DEMO y son ficticias: no corresponden a inmuebles reales, no están disponibles y no constituyen oferta, promesa de venta ni de arrendamiento. Los precios, superficies, características y fotografías mostrados son ilustrativos. Las fotografías de inmuebles provienen de bancos de imágenes con licencia libre y no representan las propiedades descritas."),
    ("Naturaleza de la información",
     "La información publicada tiene fines informativos y orientativos. No constituye asesoría legal, fiscal, financiera ni de inversión. Los rangos de precio por metro cuadrado, rendimientos, estimaciones de gastos de cierre y resultados de la herramienta de valuación son referencias generales de mercado y no sustituyen un avalúo formal realizado por perito valuador autorizado, ni la opinión de un profesional en la materia aplicable a su caso concreto."),
    ("Herramienta de valuación",
     "El estimador de valor calcula un rango a partir del precio medio por metro cuadrado de la colonia seleccionada, con ajustes por tipo de inmueble, antigüedad, número de recámaras y estacionamientos. No considera nivel, orientación, estado real de conservación, calidad de acabados, situación del condominio ni comparables específicos. Su resultado no debe utilizarse como base única para fijar un precio de venta ni para trámites bancarios, fiscales o notariales."),
    ("Ámbito territorial",
     "Los servicios de asesoría y el inventario publicado se limitan exclusivamente a inmuebles ubicados dentro de las dieciséis alcaldías de la Ciudad de México. No se publican ni intermedian propiedades en el Estado de México ni en otras entidades federativas."),
    ("Propiedad intelectual",
     "La marca Gio Filio, el descriptor Tu espacio ideal, el logotipo, el isotipo, los textos, el diseño y la estructura del sitio son propiedad de Gio Filio y están protegidos por la legislación aplicable en materia de propiedad industrial y derechos de autor. Queda prohibida su reproducción, distribución o modificación sin autorización previa y por escrito."),
    ("Uso permitido",
     "Usted se obliga a utilizar el sitio conforme a la ley y a estos términos. Queda prohibido extraer de forma automatizada el contenido del sitio, intentar vulnerar sus medidas de seguridad, suplantar identidades o utilizar los formularios para enviar información falsa o comunicaciones no solicitadas."),
    ("Formularios y datos que usted proporciona",
     "Al enviar cualquier formulario usted declara que la información proporcionada es veraz y que cuenta con facultades para compartirla. El tratamiento de sus datos se rige por el aviso de privacidad. En esta versión de demostración, la información capturada se almacena únicamente en el navegador de su dispositivo y no se transmite a servidores externos."),
    ("Enlaces a sitios de terceros",
     "El sitio puede contener enlaces a plataformas de terceros, como WhatsApp, redes sociales o proveedores de mapas. Gio Filio no controla dichos sitios ni responde por sus contenidos, políticas o prácticas de privacidad."),
    ("Limitación de responsabilidad",
     "El sitio se ofrece en el estado en que se encuentra. No garantizamos disponibilidad ininterrumpida ni ausencia total de errores. En la medida permitida por la ley, Gio Filio no será responsable por daños derivados del uso o la imposibilidad de uso del sitio, ni por decisiones tomadas con base exclusiva en la información aquí publicada."),
    ("Modificaciones",
     "Podemos modificar estos términos en cualquier momento. La versión vigente será siempre la publicada en esta página, con indicación de su fecha de actualización."),
    ("Ley aplicable y jurisdicción",
     "Estos términos se rigen por la legislación mexicana. Para su interpretación y cumplimiento, las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero que pudiera corresponderles."),
]


def build_legal(slug, titulo, intro, secciones, desc):
    path = f"{slug}/index.html"
    crumbs = [("Inicio", "index.html"), (titulo, None)]
    secs = "".join(f'<h2>{e(t)}</h2><p>{e(x)}</p>' for t, x in secciones)
    body = f'''
{breadcrumb(path, crumbs)}
<section class="section">
  <div class="wrap-narrow">
    <p class="eyebrow">Legal</p>
    <h1>{e(titulo)}</h1>
    <p class="lead">{e(intro)}</p>
    <p class="small muted">Última actualización: 16 de agosto de 2026 · Ciudad de México</p>
    <hr class="divider">
    <div class="article">{secs}</div>
    <hr class="divider">
    <p class="small muted">¿Dudas sobre este documento? Escribe a <a href="mailto:{MARCA["email"]}">{e(MARCA["email"])}</a>.</p>
  </div>
</section>
'''
    write(path, page(path, f"{titulo} | Gio Filio", desc, body,
        schema=[breadcrumb_schema(crumbs)], page_type="legal", **K()))


# =========================================================== 404 + SITEMAP
def build_404():
    path = "404.html"
    R = lambda t: rel(path, t)
    body = f'''
<section class="section">
  <div class="wrap-narrow center">
    <p class="eyebrow eyebrow--center">Error 404</p>
    <h1>Esta página no existe</h1>
    <p class="lead">Puede que la propiedad ya no esté disponible o que el enlace haya cambiado. Estos caminos sí llevan a algún lado:</p>
    <div class="cta-actions" style="margin-top:2rem">
      <a class="btn" href="{R("propiedades/")}">Ver propiedades</a>
      <a class="btn btn--ghost" href="{R("zonas/")}">Explorar zonas de CDMX</a>
      <a class="btn btn--ghost" href="{R("contacto/")}">Hablar con Gio</a>
    </div>
  </div>
</section>'''
    write(path, page(path, "Página no encontrada | Gio Filio",
        "La página que buscas no existe. Explora las propiedades disponibles en Ciudad de México o habla con Gio.",
        body, noindex=True, page_type="404", **K()))


def build_sitemap():
    prio = {"index.html": "1.0"}
    urls = []
    for p in sorted(set(PAGES)):
        if p.endswith("404.html"):
            continue
        if p.startswith(("favoritos/", "comparador/")):
            continue
        loc = canonical(p)
        if p == "index.html":
            pr, cf = "1.0", "daily"
        elif p.startswith("propiedad/"):
            pr, cf = "0.9", "weekly"
        elif p.startswith(("propiedades/", "venta/", "renta/", "departamentos/", "casas/", "zonas/")):
            pr, cf = "0.8", "daily"
        elif p.startswith("blog/"):
            pr, cf = "0.6", "monthly"
        elif p.startswith(("aviso-", "terminos-")):
            pr, cf = "0.3", "yearly"
        else:
            pr, cf = "0.7", "monthly"
        urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{cf}</changefreq>\n    <priority>{pr}</priority>\n  </url>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    with open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(xml)

    robots = f"""# Gio Filio — Tu espacio ideal
# https://giofilio.com

User-agent: *
Allow: /

# Páginas personales sin valor de indexación
Disallow: /favoritos/
Disallow: /comparador/
Disallow: /*?orden=
Disallow: /*?view=

# Bots de scraping agresivo
User-agent: SemrushBot
Crawl-delay: 10

Sitemap: {SITE}/sitemap.xml
"""
    with open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots)
    print(f"   sitemap.xml con {len(urls)} URLs")


# =========================================================== MAIN
def main():
    print("→ Generando páginas…")
    build_home()
    build_search_pages()
    for p in PROPS:
        build_property(p)
    build_zonas_index()
    for a in ALCALDIAS:
        build_alcaldia(a)
    for c in COLONIAS:
        build_colonia(c)
    # SEO programático: operación × tipo × colonia (solo combinaciones con inventario)
    combos = 0
    for op in ("venta", "renta"):
        for tipo in TIPO_URL:
            for c in COLONIAS:
                before = len(PAGES)
                build_seo_combo(op, tipo, c)
                combos += len(PAGES) - before
    build_gio()
    build_intenciones()
    build_valuacion()
    build_favoritos()
    build_comparador()
    build_blog()
    build_contacto()
    build_legal("aviso-de-privacidad", "Aviso de privacidad",
                "Cómo Gio Filio recaba, utiliza y protege sus datos personales, conforme a la legislación mexicana aplicable.",
                LEGAL_PRIVACIDAD,
                "Aviso de privacidad de Gio Filio: datos que recabamos, finalidades, transferencias, derechos ARCO y uso de cookies.")
    build_legal("terminos-y-condiciones", "Términos y condiciones",
                "Condiciones de uso del sitio de Gio Filio, alcance de la información publicada y naturaleza demostrativa del inventario.",
                LEGAL_TERMINOS,
                "Términos y condiciones de uso del sitio de Gio Filio — Tu espacio ideal, asesoría inmobiliaria en Ciudad de México.")
    build_404()
    build_sitemap()
    print(f"   {len(PAGES)} páginas HTML ({combos} de SEO programático)")


if __name__ == "__main__":
    main()
