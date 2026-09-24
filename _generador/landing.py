# -*- coding: utf-8 -*-
"""Gio Filio — plantilla de landing individual de propiedad.

Se alimenta de data_landings.LANDINGS (un registro = una página). Reutiliza
header/footer/page() de render.py, el lightbox y el formulario de leads
(data-lead-form) del sitio; no define nada paralelo.
"""
import json
from urllib.parse import quote

from render import (page, e, rel, icon, num, breadcrumb, breadcrumb_schema,
                    person_schema, canonical, full_url, SITE)
from parts import lightbox_markup
from data_zonas import MARCA
from data_props import TIPO_LABEL
from data_landings import LANDINGS

OP_LABEL = {"venta": "Venta", "renta": "Renta", "venta-renta": "Venta y renta"}

# Íconos propios de la ficha (mismo trazo que el resto del sitio)
_S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
LP_ICONS = {
    "users": f'<svg {_S}><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.4-3.2 2.7-5 5.5-5s5.1 1.8 5.5 5M16 6.2a3 3 0 0 1 0 5.6M17.5 14.3c1.7.6 2.7 2.2 3 4.7"/></svg>',
    "cert": f'<svg {_S}><circle cx="12" cy="9" r="5.2"/><path d="M8.7 13.4 7.5 21l4.5-2.4 4.5 2.4-1.2-7.6M9.6 9l1.7 1.7 3.2-3.4"/></svg>',
    "building": f'<svg {_S}><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21M15 9h3.5A1.5 1.5 0 0 1 20 10.5V21M3 21h18M8.5 7h3M8.5 11h3M8.5 15h3"/></svg>',
    "meet": f'<svg {_S}><rect x="4" y="9" width="16" height="6" rx="3"/><path d="M7 9V6.5M12 9V6M17 9V6.5M7 15v2.5M12 15v3M17 15v2.5"/></svg>',
    "train": f'<svg {_S}><rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M8 20l4-4.5 4 4.5M8 9.5h8"/></svg>',
    "dining": f'<svg {_S}><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.6-3.5 7 0 1.6 1.3 2.5 3.5 2.5"/></svg>',
    "site": f'<svg {_S}><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h2M15 16h.01"/></svg>',
    "bath": f'<svg {_S}><path d="M4 12h16v2.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V12zM6 12V6.2A2.2 2.2 0 0 1 8.2 4c.9 0 1.7.5 2 1.3M7 19l-1 2M17 19l1 2"/></svg>',
    "view": f'<svg {_S}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    "zoom": f'<svg {_S}><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>',
    "route": f'<svg {_S}><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/></svg>',
}


def _ic(name):
    return LP_ICONS.get(name) or icon(name)


def _imgs(base, kind=""):
    """(jpg, webp) de una imagen. kind: '' | 'card' | 'thumb'."""
    suf = f"-{kind}" if kind else ""
    return f"{base}{suf}.jpg", f"{base}{suf}.webp"


def landing_path(l):
    return f'propiedades/{l["slug"]}/index.html'


def landing_url(l):
    return f'propiedades/{l["slug"]}/'


def _wa_text(l):
    return l["whatsappMessage"]


def _title_wa(l):
    return f'la oficina {l["title"]}'


def published(l):
    return l.get("status") != "oculto"


# ------------------------------------------------- datos "slim" para el buscador
def shadow_prop(l):
    """Registro compatible con las tarjetas y con window.GF_DATA.

    Se usa solo para render de tarjetas (home / inventario) y para que el
    tracking (view_property, generate_lead) encuentre la propiedad por id.
    """
    card_jpg, card_webp = _imgs(l["heroImage"], "card")
    tipo = l["propertyType"]
    ops = ["venta", "renta"] if l["operation"] == "venta-renta" else [l["operation"]]
    return {
        "id": l["id"], "titulo": l["title"], "titulo_wa": _title_wa(l),
        "url": landing_url(l), "url_file": landing_path(l),
        "operacion": ops[0], "operaciones": ops, "operacion_label": OP_LABEL[l["operation"]],
        "tipo": tipo, "tipo_label": TIPO_LABEL[tipo],
        "precio": l["price"] or 0, "moneda": l["currency"], "mantenimiento": 0,
        "precio_consultar": bool(l["priceOnRequest"]),
        "colonia_slug": l["neighborhoodSlug"], "colonia_nombre": "Santa Fe",
        "alcaldia": l["boroughSlug"], "alcaldia_nombre": l["borough"],
        "alcaldia_tiene_pagina": True, "estado_nombre": l["state"], "sin_pagina": False,
        "calle": l["address"], "cp": l["postalCode"], "lat": l["latitude"], "lng": l["longitude"],
        "rec": 0, "ban": 0, "medios": 0, "est": l["parkingSpaces"],
        "m2c": l["surface"], "m2t": 0, "antig": 0, "piso": l["floor"], "privados": l["privateOffices"],
        "estado_inm": "excelente", "amenidades": [], "badges": [],
        "destacada": bool(l["featured"]), "exclusiva": False, "landing": True,
        "publicado": l["publicado"], "actualizado": l["actualizado"],
        "foto_card": card_jpg, "foto_card_webp": card_webp, "sin_webp": False,
        "precio_m2": 0, "estado": "disponible", "wa_text": _wa_text(l),
        "m2_ref": l["surface"],
    }


# ------------------------------------------------------------------ SCHEMA
def landing_schema(l):
    url = canonical(landing_url(l))
    imgs = [full_url(_imgs(g[0])[0]) for g in l["gallery"]]
    place = {
        "@type": "Place",
        "name": l["title"],
        "address": {
            "@type": "PostalAddress", "streetAddress": l["address"],
            "addressLocality": l["neighborhood"] + ", " + l["borough"],
            "addressRegion": "CDMX", "postalCode": l["postalCode"], "addressCountry": "MX",
        },
        "geo": {"@type": "GeoCoordinates", "latitude": l["latitude"], "longitude": l["longitude"]},
        "floorSize": {"@type": "QuantitativeValue", "value": l["surface"], "unitCode": "MTK"},
        "amenityFeature": [
            {"@type": "LocationFeatureSpecification", "name": "Certificación", "value": l["certification"]},
            {"@type": "LocationFeatureSpecification", "name": "Estacionamientos", "value": l["parkingSpaces"]},
            {"@type": "LocationFeatureSpecification", "name": "Privados", "value": l["privateOffices"]},
            {"@type": "LocationFeatureSpecification", "name": "Piso", "value": l["floor"]},
            {"@type": "LocationFeatureSpecification", "name": "Elevadores con acceso al piso", "value": l["elevators"]},
        ],
    }
    return {
        "@context": "https://schema.org", "@type": "RealEstateListing",
        "@id": url + "#listing", "url": url, "name": l["title"],
        "description": l["seoDescription"], "image": imgs,
        "datePosted": l["publicado"], "about": place,
        "provider": {"@id": f"{SITE}/#gio-filio"},
    }


# --------------------------------------------------------------------- PÁGINA
def _picture(R, base, alt, kind="", **attrs):
    jpg, webp = _imgs(base, kind)
    a = " ".join(f'{k.replace("_", "-")}="{e(str(v))}"' for k, v in attrs.items())
    return (f'<picture><source type="image/webp" srcset="{R(webp)}">'
            f'<img src="{R(jpg)}" alt="{e(alt)}" {a}></picture>')


def build_landing(l, write, K):
    path = landing_path(l)
    R = lambda t: rel(path, t)
    title = l["title"]
    hero_alt = l["gallery"][0][1]
    surface = f'{l["surface"]:,.2f}'
    op_label = OP_LABEL[l["operation"]]
    wa_href = f'https://wa.me/{MARCA["whatsapp"]}?text={quote(_wa_text(l))}'
    pid = l["id"]
    crumbs = [("Inicio", "index.html"), ("Propiedades", "propiedades/"), (title, None)]

    facts = [
        ("area", f"{surface} m²", "Superficie"),
        ("car", str(l["parkingSpaces"]), "Estacionamientos"),
        ("users", str(l["privateOffices"]), "Privados"),
        ("layers", f'Piso {l["floor"]}', "Ubicación"),
        ("building", l["buildingClass"], "Corporativo"),
        ("cert", l["certification"], "Certificación"),
        ("view", "Panorámica", "Vistas"),
    ]
    facts_html = "".join(
        f'<li class="lp-fact">{_ic(ic)}<b>{e(v)}</b><span>{e(lab)}</span></li>' for ic, v, lab in facts)

    desc_html = "".join(f"<p>{e(par)}</p>" for par in l["description"])
    feats_html = "".join(f'<li>{icon("check")}{e(f)}</li>' for f in l["features"])

    # galería: escritorio (principal + 4) y móvil (slider con snap)
    g = l["gallery"]
    thumbs = "".join(
        f'<button type="button" class="g-sm" data-lightbox="{i}" data-lp="gallery_open" aria-label="Ver fotografía {i+1} en pantalla completa">'
        + _picture(R, g[i][0], g[i][1], "thumb", loading="lazy", decoding="async", width=380, height=285)
        + "</button>" for i in range(1, min(5, len(g))))
    main_btn = (f'<button type="button" class="g-main" data-lightbox="0" data-lp="gallery_open" aria-label="Ver galería en pantalla completa">'
                + _picture(R, g[0][0], g[0][1], "", loading="lazy", decoding="async", width=948, height=948)
                + "</button>")
    slides = "".join(
        f'<button type="button" class="lp-slide" data-lightbox="{i}" data-lp="gallery_open" aria-label="Ver fotografía {i+1} de {len(g)}">'
        + _picture(R, g[i][0], g[i][1], "card", loading="lazy" if i else "eager", decoding="async", width=640, height=480)
        + "</button>" for i in range(len(g)))
    gallery_html = f'''<div class="gallery lp-gallery">
      {main_btn}
      {thumbs}
      <button type="button" class="gallery-more" data-lightbox="0" data-lp="gallery_open">{icon("grid")} Ver todas las fotos ({len(g)})</button>
    </div>
    <div class="lp-slider" aria-label="Fotografías de {e(title)}" tabindex="0">{slides}</div>
    <p class="lp-slider-count">{len(g)} fotografías · desliza para ver más · toca para ampliar</p>'''

    plan = l["floorPlans"][0]
    plan_jpg, plan_webp = plan[0] + ".jpg", plan[0] + ".webp"
    plan_html = f'''<button type="button" class="lp-plan" data-lp-plan="{R(plan_jpg)}" aria-label="Ampliar el plano del piso 18">
        <picture><source type="image/webp" srcset="{R(plan_webp)}"><img src="{R(plan_jpg)}" alt="{e(plan[1])}" loading="lazy" decoding="async" width="2690" height="1510"></picture>
        <span class="lp-plan-zoom">{_ic("zoom")} Ampliar plano</span>
      </button>'''
    dist_html = "".join(f'<li>{_ic(ic)}<span>{e(t)}</span></li>' for ic, t in l["distribution"])
    access_html = "".join(f'<li>{_ic("route")}<span>{e(a)}</span></li>' for a in l["accessibility"])

    body = f'''
<section class="hero lp-hero" id="top">
  <div class="hero-media">
    <picture><source type="image/webp" srcset="{R(_imgs(l["heroImage"])[1])}">
      <img src="{R(_imgs(l["heroImage"])[0])}" alt="{e(hero_alt)}" fetchpriority="high" width="948" height="948"></picture>
  </div>
  <div class="wrap hero-inner lp-hero-inner">
    <p class="eyebrow hero-eyebrow">Propiedad destacada</p>
    <h1>{e(title)}</h1>
    <p class="lead lp-hero-sub">{e(l["subtitle"])}</p>
    <p class="lp-hero-meta">{e(surface)} m² <i>·</i> {l["parkingSpaces"]} estacionamientos <i>·</i> Piso {l["floor"]}</p>
    <p class="lp-hero-op"><span class="badge badge--exclusiva">{e(op_label)}</span></p>
    <div class="lp-hero-cta">
      <a class="btn btn--gold-solid btn--lg" href="#agendar" data-schedule="{e(pid)}" data-lp="schedule_visit" data-lp-src="hero">Agendar visita</a>
      <a class="btn btn--wa btn--lg" href="{wa_href}" target="_blank" rel="noopener" data-lp-wa="hero">{icon("wa")} WhatsApp</a>
      <a class="btn btn--outline-light btn--lg" href="#galeria" data-lp="gallery_jump">Ver galería</a>
    </div>
  </div>
</section>

<section class="lp-facts-wrap" aria-label="Ficha rápida">
  <div class="wrap"><ul class="lp-facts">{facts_html}</ul></div>
</section>

<section class="section-sm lp-about">
  <div class="wrap lp-two">
    <div>
      <p class="eyebrow">Oficina corporativa</p>
      <h2 class="lp-h2">{e(l["intro"])}</h2>
      <div class="prose lp-prose">{desc_html}</div>
    </div>
    <div class="lp-card">
      <h3>Lo que incluye</h3>
      <ul class="feature-list lp-feature-list">{feats_html}</ul>
    </div>
  </div>
</section>

<section class="section-sm" id="galeria" style="padding-top:0">
  <div class="wrap">
    <p class="eyebrow">Galería</p>
    <h2 class="lp-h2" style="margin-bottom:1.25rem">Conoce el espacio</h2>
    {gallery_html}
  </div>
</section>

<section class="section section--ivory" id="distribucion">
  <div class="wrap">
    <p class="eyebrow">Conoce la distribución</p>
    <h2 class="lp-h2">Un piso pensado para trabajar en equipo</h2>
    <div class="lp-dist">
      {plan_html}
      <div class="lp-card lp-card--flat">
        <h3>Distribución del piso</h3>
        <ul class="lp-list">{dist_html}</ul>
        <p class="small muted lp-note">Plano de referencia. Las medidas y la distribución exactas se confirman durante la visita.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="ubicacion">
  <div class="wrap">
    <p class="eyebrow">Ubicación</p>
    <h2 class="lp-h2">Una ubicación estratégica en Santa Fe</h2>
    <div class="lp-loc">
      <div>
        <p class="lp-address">{icon("pin")}<span>{e(l["address"])}, Col. {e(l["neighborhood"])}, {e(l["borough"])}, {e(l["city"])}, C.P. {e(l["postalCode"])}</span></p>
        <h3 style="margin-top:1.5rem">Cómo llegar</h3>
        <ul class="lp-list">{access_html}</ul>
        <p style="margin-top:1.5rem"><a class="btn btn--ghost" href="{e(l["mapsUrl"])}" target="_blank" rel="noopener" data-lp-map="link">Abrir en Google Maps</a></p>
      </div>
      <div class="prop-map lp-map" id="lpMap" data-lat="{l["latitude"]}" data-lng="{l["longitude"]}" data-title="{e(title)}" role="region" aria-label="Mapa de ubicación de {e(title)}">
        <a class="lp-map-fallback" href="{e(l["mapsUrl"])}" target="_blank" rel="noopener" data-lp-map="fallback">{icon("pin")}<b>Ver ubicación en Google Maps</b><span>{e(l["address"])}, {e(l["neighborhood"])}</span></a>
      </div>
    </div>
  </div>
</section>

<section class="section section--navy lp-cta" id="agendar">
  <div class="wrap lp-cta-grid">
    <div class="lp-cta-copy">
      <p class="eyebrow" style="color:var(--gold-soft)">Agenda tu visita</p>
      <h2>¿Quieres conocer esta propiedad?</h2>
      <p class="lead">Agenda una visita y descubre si este espacio es el indicado para tu empresa.</p>
      <div class="lp-cta-alt">
        <a class="btn btn--wa" href="{wa_href}" target="_blank" rel="noopener" data-lp-wa="cta">{icon("wa")} WhatsApp</a>
      </div>
    </div>
    <div class="lp-form-card">
      <form data-lead-form data-form-name="landing_espacio_santa_fe_p18" data-source="landing_propiedad" data-event="generate_lead" data-property-id="{e(pid)}" id="contactoGio" novalidate>
        <div class="form-grid-2">
          <div class="form-row"><label for="lp-nombre">Nombre</label>
            <input type="text" id="lp-nombre" name="nombre" required autocomplete="name" placeholder="Tu nombre"><span class="err">Escribe tu nombre</span></div>
          <div class="form-row"><label for="lp-tel">Teléfono</label>
            <input type="tel" id="lp-tel" name="telefono" required autocomplete="tel" placeholder="55 1234 5678" inputmode="tel"><span class="err">Escribe un teléfono de 10 dígitos</span></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label for="lp-mail">Email</label>
            <input type="email" id="lp-mail" name="email" required autocomplete="email" placeholder="tu@empresa.com"><span class="err">Escribe un correo válido</span></div>
          <div class="form-row"><label for="lp-empresa">Empresa</label>
            <input type="text" id="lp-empresa" name="empresa" autocomplete="organization" placeholder="Nombre de tu empresa"></div>
        </div>
        <div class="form-row"><label for="lp-msg">Mensaje</label>
          <textarea id="lp-msg" name="mensaje" placeholder="Cuéntame cuántas personas son y cuándo te gustaría visitarla."></textarea></div>
        <label class="form-consent"><input type="checkbox" name="consent" required>
          <span>Acepto el <a href="{R("aviso-de-privacidad/")}">aviso de privacidad</a> y que Gio Filio me contacte por WhatsApp, correo o teléfono.</span></label>
        <div class="form-actions"><button type="submit" class="btn btn--gold-solid btn--block btn--lg">Quiero agendar una visita</button></div>
      </form>
      <div class="form-success" data-form-success role="status">
        {icon("checkc")}
        <h4 style="margin-bottom:.35rem">Mensaje recibido</h4>
        <p class="small" style="margin:0">Gio te contacta personalmente, normalmente el mismo día.</p>
      </div>
    </div>
  </div>
</section>

<div class="lp-sticky" role="group" aria-label="Contactar sobre {e(title)}">
  <a class="btn btn--wa" href="{wa_href}" target="_blank" rel="noopener" data-lp-wa="sticky">{icon("wa")} WhatsApp</a>
  <a class="btn btn--gold-solid" href="#agendar" data-schedule="{e(pid)}" data-lp="schedule_visit" data-lp-src="sticky">Agendar visita</a>
</div>
{lightbox_markup()}
'''
    gallery_json = json.dumps([_imgs(x[0])[0] for x in g], ensure_ascii=False)
    extra_head = (f'<link rel="preload" as="image" type="image/webp" href="{R(_imgs(l["heroImage"])[1])}" fetchpriority="high">\n'
                  f'<link rel="stylesheet" href="{R("assets/css/landing.css")}?v=1">')
    ctx = {"property_id": pid, "property_title": title, "property_type": l["propertyType"],
           "property_location": f'{l["neighborhood"]}, {l["borough"]}, {l["city"]}',
           "operation": op_label}
    extra_js = (f'<script>window.GF_GALLERY = {gallery_json};window.GF_LANDING = '
                f'{json.dumps(ctx, ensure_ascii=False)};</script>\n'
                f'<script src="{R("assets/js/landing.js")}?v=1" defer></script>')
    write(path, page(path, l["seoTitle"], l["seoDescription"], body,
                     schema=[landing_schema(l), breadcrumb_schema(crumbs), person_schema()],
                     og_image=_imgs(l["heroImage"])[0], body_attrs=f'data-landing-id="{e(pid)}"',
                     page_type="property_landing", extra_head=extra_head, extra_js=extra_js, **K()))
