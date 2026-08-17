# -*- coding: utf-8 -*-
"""Gio Filio — Motor de plantillas (layout, componentes, SEO, schema.org)."""
import json, html, re
from data_zonas import MARCA

SITE = MARCA["dominio"]

# ------------------------------------------------------------------ utils
def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)

def rel(from_path, to_path):
    """Devuelve una URL relativa entre dos rutas de salida (para que el sitio
    funcione tanto en file:// como servido por HTTP)."""
    to_path = to_path.lstrip("/")
    depth = from_path.count("/")
    prefix = "../" * depth if depth else ""
    return (prefix + to_path) or "./"

def base_of(from_path):
    depth = from_path.count("/")
    return "../" * depth if depth else "./"

def canonical(path):
    p = path
    if p.endswith("index.html"):
        p = p[: -len("index.html")]
    return SITE.rstrip("/") + "/" + p.lstrip("/")

def money(n):
    return "$" + f"{int(round(n)):,}".replace(",", ",") + " MXN"

def money_short(n):
    n = float(n)
    if n >= 1e6:
        m = n / 1e6
        s = f"{m:.1f}" if m < 10 else f"{m:.1f}"
        return "$" + s.rstrip("0").rstrip(".") + " M"
    if n >= 1e3:
        return "$" + str(int(round(n / 1e3))) + " K"
    return "$" + f"{int(n):,}"

def num(n):
    return f"{int(round(n)):,}"

def slugify(s):
    s = s.lower()
    rep = {"á":"a","é":"e","í":"i","ó":"o","ú":"u","ü":"u","ñ":"n"}
    for k,v in rep.items(): s = s.replace(k,v)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

# ------------------------------------------------------------------ iconos
ICONS = {
    "heart": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 20.5s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9c0 5.3-7.5 10-7.5 10z"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "chev": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    "chevl": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 21s-6.5-5.7-6.5-10a6.5 6.5 0 1 1 13 0c0 4.3-6.5 10-6.5 10z"/><circle cx="12" cy="11" r="2.4"/></svg>',
    "bed": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a1 1 0 0 1 1-1h3v4"/></svg>',
    "bath": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 3.4-1.4M7 19l-1 2M17 19l1 2"/></svg>',
    "car": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 13l1.6-4.3A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.7L19 13M4 13h16v4H4zM7 17v2M17 17v2"/><circle cx="7.5" cy="15" r="1"/><circle cx="16.5" cy="15" r="1"/></svg>',
    "area": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9h16M9 4v16"/></svg>',
    "cal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    "layers": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    "checkc": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.4l2.4 2.4 4.6-5"/></svg>',
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    "filter": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    "map": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/></svg>',
    "wa": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.8 9.8 0 0 0 4.68 1.2h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2zm5.76 14.06c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.13-.13-.19-1.12-1.49-1.12-2.84s.71-2.02.96-2.29c.25-.28.55-.34.73-.34h.53c.17 0 .4-.06.63.48.24.57.8 1.98.87 2.12.07.14.12.31.02.5-.09.19-.14.31-.28.47l-.42.49c-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.25.09 1.62.76 1.9.9.28.14.46.21.53.33.07.12.07.68-.17 1.36z"/></svg>',
    "ig": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.62.07 4.81s0 3.56-.07 4.81c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.62.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.56 2.2 15.19 2.2 12s0-3.56.07-4.81c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.44 2.21 8.8 2.2 12 2.2zm0 1.8c-3.14 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.17C2.4 10.1 2.4 10.46 2.4 12s0 1.9.06 3.13c.05 1.14.24 1.76.4 2.17.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.6.07-3.13s-.01-1.9-.07-3.13c-.05-1.14-.24-1.76-.4-2.17a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4C15.5 4.01 15.14 4 12 4zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88zm0 8.14a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.3-8.34a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z"/></svg>',
    "fb": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.9 3.77-3.9 1.1 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.79 8.44-4.93 8.44-9.94z"/></svg>',
    "li": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 5.5a2.06 2.06 0 1 1-4.12 0 2.06 2.06 0 0 1 4.12 0zM3.15 21.5h3.6V9.1h-3.6v12.4zM9.4 9.1h3.45v1.7h.05c.48-.9 1.65-1.86 3.4-1.86 3.64 0 4.3 2.36 4.3 5.44v7.12h-3.6v-6.31c0-1.5-.03-3.44-2.1-3.44-2.1 0-2.42 1.63-2.42 3.33v6.42H9.4V9.1z"/></svg>',
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    "home": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-6.5 8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8z"/><path d="M9.5 20.5v-6h5v6"/></svg>',
    "key": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="4.2"/><path d="M11 11l8 8M16.5 16.5l2-2M14 14l1.5-1.5"/></svg>',
    "chart": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 19h16M7 16V9M12 16V5M17 16v-5"/></svg>',
    "tag": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5V5a1 1 0 0 1 1-1h6.5L20 12.5 12.5 20 4 11.5z"/><circle cx="8" cy="8" r="1.2"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    "sparkle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></svg>',
    "doc": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13 3v5h5M8.5 13h7M8.5 16.5h5"/></svg>',
    "play": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5v-7z"/></svg>',
    "cube": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
    "plan": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h7V4M10 10v10M14 20v-6h7"/></svg>',
    "360": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="4.5"/><path d="M6.6 14.6A9 9 0 1 0 17.4 9.4"/></svg>',
    "plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    "minus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    "grid": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>',
}

def icon(name, cls=""):
    s = ICONS.get(name, "")
    if cls and s:
        s = s.replace("<svg", f'<svg class="{cls}"', 1)
    return s

# ------------------------------------------------------------------ NAV
NAV = [
    ("Comprar", "comprar/"),
    ("Rentar", "rentar/"),
    ("Propiedades", "propiedades/"),
    ("Zonas", "zonas/"),
    ("Invertir", "invertir/"),
    ("Vender", "vender/"),
    ("Conoce a Gio", "conoce-a-gio/"),
]

CUR = ' aria-current="page"'

def header(path, active=""):
    R = lambda t: rel(path, t)
    nav = "".join(
        f'<a href="{R(u)}"{CUR if active == u else ""}>{e(t)}</a>'
        for t, u in NAV
    )
    mnav = "".join(
        f'<a href="{R(u)}"{CUR if active == u else ""}>{e(t)}{icon("chev")}</a>'
        for t, u in NAV
    )
    return f'''
<a class="skip-link" href="#main">Saltar al contenido principal</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="{R("index.html")}" aria-label="Gio Filio — Tu espacio ideal, inicio">
      <img src="{R("assets/img/brand/logo-principal.png")}" alt="Gio Filio — Tu espacio ideal" width="200" height="76">
    </a>
    <nav class="nav-main" aria-label="Navegación principal">{nav}</nav>
    <div class="header-actions">
      <a class="icon-btn" href="{R("favoritos/")}" aria-label="Mis propiedades favoritas">
        {icon("heart")}<span class="count" data-fav-count data-count="0">0</span>
      </a>
      <a class="btn btn--sm" href="{R("contacto/")}">Hablar con Gio</a>
      <button type="button" class="burger" id="burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileNav">{icon("menu")}</button>
    </div>
  </div>
</header>
<div class="mobile-nav" id="mobileNav" aria-hidden="true" role="dialog" aria-label="Menú de navegación">
  <div class="mobile-nav-head">
    <img src="{R("assets/img/brand/logo-principal.png")}" alt="Gio Filio" style="height:34px;width:auto">
    <button type="button" class="icon-btn" id="mobileNavClose" aria-label="Cerrar menú">{icon("close")}</button>
  </div>
  <div class="mobile-nav-body">
    {mnav}
    <a href="{R("favoritos/")}">Favoritos{icon("chev")}</a>
    <a href="{R("comparador/")}">Comparador{icon("chev")}</a>
    <a href="{R("valuacion/")}">Valuación{icon("chev")}</a>
    <a href="{R("blog/")}">Blog y guías{icon("chev")}</a>
    <a href="{R("contacto/")}">Contacto{icon("chev")}</a>
  </div>
  <div class="mobile-nav-foot">
    <a class="btn btn--block" href="{R("contacto/")}">Hablar con Gio</a>
    <a class="btn btn--wa btn--block" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="mobile_menu">{icon("wa")} WhatsApp</a>
  </div>
</div>'''


def footer(path, colonias, alcaldias):
    R = lambda t: rel(path, t)
    col_links = "".join(f'<li><a href="{R("propiedades/" + c["slug"] + "/")}">{e(c["nombre"])}</a></li>' for c in colonias[:8])
    alc_links = "".join(f'<li><a href="{R("zonas/" + a["slug"] + "/")}">{e(a["nombre"])}</a></li>' for a in alcaldias[:8])
    return f'''
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <div class="footer-logo"><img src="{R("assets/img/brand/logo-blanco.png")}" alt="Gio Filio — Tu espacio ideal" width="230" height="88"></div>
        <p style="max-width:34ch">Asesoría inmobiliaria personal en las 16 alcaldías de la Ciudad de México. Comprar, rentar, vender e invertir con alguien que primero entiende cómo quieres vivir.</p>
        <div class="footer-social">
          <a href="{MARCA["instagram"]}" target="_blank" rel="noopener" aria-label="Instagram de Gio Filio">{icon("ig")}</a>
          <a href="{MARCA["facebook"]}" target="_blank" rel="noopener" aria-label="Facebook de Gio Filio">{icon("fb")}</a>
          <a href="{MARCA["linkedin"]}" target="_blank" rel="noopener" aria-label="LinkedIn de Gio Filio">{icon("li")}</a>
          <a href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" aria-label="WhatsApp de Gio Filio" data-wa-global="footer">{icon("wa")}</a>
        </div>
      </div>
      <div>
        <h4>Explorar</h4>
        <ul>
          <li><a href="{R("propiedades/")}">Todas las propiedades</a></li>
          <li><a href="{R("venta/")}">Propiedades en venta</a></li>
          <li><a href="{R("renta/")}">Propiedades en renta</a></li>
          <li><a href="{R("departamentos/")}">Departamentos</a></li>
          <li><a href="{R("casas/")}">Casas</a></li>
          <li><a href="{R("desarrollos/")}">Desarrollos</a></li>
          <li><a href="{R("inversion/")}">Propiedades para inversión</a></li>
          <li><a href="{R("zonas/")}">Zonas de CDMX</a></li>
        </ul>
      </div>
      <div>
        <h4>Colonias</h4>
        <ul>{col_links}<li><a href="{R("zonas/")}">Ver todas →</a></li></ul>
      </div>
      <div>
        <h4>Con Gio</h4>
        <ul>
          <li><a href="{R("conoce-a-gio/")}">Conoce a Gio</a></li>
          <li><a href="{R("comprar/")}">Quiero comprar</a></li>
          <li><a href="{R("rentar/")}">Quiero rentar</a></li>
          <li><a href="{R("vender/")}">Quiero vender</a></li>
          <li><a href="{R("invertir/")}">Quiero invertir</a></li>
          <li><a href="{R("valuacion/")}">Valuación de propiedad</a></li>
          <li><a href="{R("blog/")}">Blog y guías</a></li>
          <li><a href="{R("contacto/")}">Contacto</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {2026} {e(MARCA["nombre"])} · {e(MARCA["descriptor"])} · Ciudad de México</span>
      <nav aria-label="Enlaces legales">
        <a href="{R("aviso-de-privacidad/")}">Aviso de privacidad</a>
        <a href="{R("terminos-y-condiciones/")}">Términos y condiciones</a>
        <a href="{R("contacto/")}">Contacto</a>
      </nav>
    </div>
  </div>
</footer>'''


def wa_fab(path):
    return f'''<a class="wa-fab" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-fab data-wa-global="fab">{icon("wa")}<span class="wa-text">Habla con Gio</span></a>'''


# ------------------------------------------------------------------ LAYOUT
def page(path, title, description, body, *, colonias, alcaldias, active="",
         schema=None, og_image="assets/img/gio/retrato-1200.jpg", body_attrs="",
         extra_head="", extra_js="", noindex=False, page_type="generic"):
    R = lambda t: rel(path, t)
    B = base_of(path)
    schema_html = ""
    if schema:
        blocks = schema if isinstance(schema, list) else [schema]
        for b in blocks:
            schema_html += '<script type="application/ld+json">' + json.dumps(b, ensure_ascii=False, separators=(",", ":")) + "</script>\n"

    full_title = title if ("Gio Filio" in title or len(title) > 58) else f"{title} | Gio Filio"
    return f'''<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
{'<meta name="robots" content="noindex, follow">' if noindex else '<meta name="robots" content="index, follow, max-image-preview:large">'}
<link rel="canonical" href="{canonical(path)}">
<meta name="author" content="Gio Filio">
<meta name="geo.region" content="MX-CMX">
<meta name="geo.placename" content="Ciudad de México">
<meta name="theme-color" content="#071F4A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gio Filio — Tu espacio ideal">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{canonical(path)}">
<meta property="og:image" content="{SITE}/{og_image}">
<meta property="og:image:alt" content="{e(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(full_title)}">
<meta name="twitter:description" content="{e(description)}">
<meta name="twitter:image" content="{SITE}/{og_image}">
<link rel="icon" type="image/png" sizes="32x32" href="{R("assets/img/brand/favicon-32.png")}">
<link rel="apple-touch-icon" href="{R("assets/img/brand/favicon-180.png")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="{R("assets/css/gio.css")}">
{schema_html}{extra_head}
<script>window.GF_BASE = "{B}";</script>
<!-- Analitica: declara gtmId / ga4Id en assets/js/config.js y pega aqui el snippet de GTM -->
<script>window.dataLayer = window.dataLayer || [];</script>
</head>
<body data-page-type="{e(page_type)}"{(" " + body_attrs) if body_attrs else ""}>
<noscript><div class="demo-bar">Este sitio usa JavaScript para los filtros, el mapa y los favoritos. Puedes navegar el catálogo y las páginas de zona sin JavaScript.</div></noscript>
{header(path, active)}
<main id="main">
{body}
</main>
{footer(path, colonias, alcaldias)}
{wa_fab(path)}
<div class="drawer-backdrop" id="drawerBackdrop"></div>
<script src="{R("assets/js/config.js")}"></script>
<script src="{R("assets/data/gio-data.js")}"></script>
<script src="{R("assets/js/gio.js")}"></script>
{extra_js}
</body>
</html>'''


# ---------------------------------------------------------------- COMPONENTES
def breadcrumb(path, items):
    """items: [(label, target|None)] — el último es la página actual."""
    R = lambda t: rel(path, t)
    lis = []
    for i, (label, target) in enumerate(items):
        last = i == len(items) - 1
        if last or not target:
            lis.append(f'<li aria-current="page">{e(label)}</li>')
        else:
            lis.append(f'<li><a href="{R(target)}">{e(label)}</a></li>')
    return f'<nav class="breadcrumb wrap" aria-label="Ruta de navegación"><ol>{"".join(lis)}</ol></nav>'


def breadcrumb_schema(items):
    el = []
    for i, (label, target) in enumerate(items):
        entry = {"@type": "ListItem", "position": i + 1, "name": label}
        if target:
            entry["item"] = canonical(target)
        el.append(entry)
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": el}


BADGE_LABEL = {
    "nueva": "Nueva", "exclusiva": "Exclusiva", "oportunidad": "Oportunidad",
    "preventa": "Preventa", "entrega-inmediata": "Entrega inmediata",
}

def pcard(path, p, no_cmp=False):
    R = lambda t: rel(path, t)
    badges = f'<span class="badge badge--{p["operacion"]}">{"Venta" if p["operacion"]=="venta" else "Renta"}</span>'
    for b in p.get("badges", []):
        badges += f'<span class="badge badge--{b}">{e(BADGE_LABEL.get(b,b))}</span>'
    specs = []
    if p["rec"]: specs.append(f'<span>{p["rec"]} rec</span>')
    if p["ban"]: specs.append(f'<span>{p["ban"]}{("."+str(p["medios"])) if p["medios"] else ""} baños</span>')
    if p["est"]: specs.append(f'<span>{p["est"]} est</span>')
    if p["m2c"]: specs.append(f'<span>{num(p["m2c"])} m²</span>')
    elif p["m2t"]: specs.append(f'<span>{num(p["m2t"])} m² terreno</span>')
    precio = money(p["precio"]).replace(" MXN", "")
    per = ' <span class="per">/mes</span>' if p["operacion"] == "renta" else ""
    cmp_html = "" if no_cmp else f'<label class="pcard-cmp"><input type="checkbox" data-id="{e(p["id"])}"> Comparar</label>'
    wa_txt = f'Hola Gio, estoy interesado en {p["titulo_wa"]} con ID {p["id"]}. ¿Podrías darme más información?'
    from urllib.parse import quote
    wa = f'https://wa.me/{MARCA["whatsapp"]}?text={quote(wa_txt)}'
    return f'''<article class="pcard" data-id="{e(p["id"])}">
  <a class="pcard-link" href="{R(p["url"])}" data-track-select="{e(p["id"])}" aria-label="Ver {e(p["titulo"])}"></a>
  <div class="pcard-media">
    <picture>
      <source type="image/webp" srcset="{R(p["foto_card_webp"])}">
      <img src="{R(p["foto_card"])}" alt="{e(p["titulo"])} — {e(p["colonia_nombre"])}, {e(p["alcaldia_nombre"])}, Ciudad de México" loading="lazy" decoding="async" width="640" height="480">
    </picture>
    <div class="pcard-badges">{badges}</div>
    <button type="button" class="pcard-fav" data-id="{e(p["id"])}" aria-pressed="false" aria-label="Guardar en favoritos">{icon("heart")}</button>
  </div>
  <div class="pcard-body">
    <div class="pcard-price">{precio}{per} <span class="cur">MXN</span></div>
    <h3 class="pcard-title">{e(p["titulo"])}</h3>
    <p class="pcard-loc">{icon("pin")}{e(p["colonia_nombre"])}, {e(p["alcaldia_nombre"])}, CDMX</p>
    <div class="pcard-specs">{"".join(specs)}</div>
  </div>
  {cmp_html}
  <div class="pcard-actions">
    <a class="btn btn--ghost btn--sm" href="{R(p["url"])}">Ver propiedad</a>
    <a class="btn btn--sm" href="{wa}" target="_blank" rel="noopener" data-wa="{e(p["id"])}">Contactar a Gio</a>
  </div>
</article>'''


def card_grid(path, props, no_cmp=False):
    if not props:
        return ""
    return '<div class="card-grid">' + "".join(pcard(path, p, no_cmp) for p in props) + "</div>"


def searchbox(path, compact=False, preset_op="venta"):
    """Buscador principal reutilizable."""
    R = lambda t: rel(path, t)
    from data_props import TIPOS
    tipos = "".join(f'<option value="{t[0]}">{e(t[1])}</option>' for t in TIPOS)
    precios_v = [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 8_000_000,
                 10_000_000, 12_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000]
    op_min = "".join(f'<option value="{v}">{money_short(v)}</option>' for v in precios_v)
    op_max = "".join(f'<option value="{v}">{money_short(v)}</option>' for v in precios_v)
    return f'''<form class="searchbox" data-search-form action="{R("propiedades/")}" method="get" role="search" aria-label="Buscar propiedades en Ciudad de México">
  <div class="search-tabs" role="tablist" aria-label="Tipo de operación">
    <button type="button" class="search-tab" role="tab" data-op="venta" aria-selected="{'true' if preset_op=='venta' else 'false'}">Comprar</button>
    <button type="button" class="search-tab" role="tab" data-op="renta" aria-selected="{'true' if preset_op=='renta' else 'false'}">Rentar</button>
  </div>
  <input type="hidden" name="operacion" value="{preset_op}">
  <input type="hidden" data-ac-value name="_loc">
  <div class="search-fields">
    <div class="field">
      <label for="sb-loc">Ubicación</label>
      <input type="search" id="sb-loc" name="q" data-ac-input autocomplete="off" role="combobox"
             aria-expanded="false" aria-autocomplete="list" aria-controls="sb-ac"
             placeholder="Alcaldía, colonia, CP, calle o desarrollo">
      <div class="ac-panel" id="sb-ac" data-ac-panel role="listbox" aria-label="Sugerencias de ubicación"></div>
    </div>
    <div class="field">
      <label for="sb-tipo">Tipo de propiedad</label>
      <select id="sb-tipo" name="tipo"><option value="">Todos los tipos</option>{tipos}</select>
    </div>
    <div class="field">
      <label for="sb-pmin">Precio</label>
      <div class="field-pair">
        <select id="sb-pmin" name="precioMin" aria-label="Precio mínimo"><option value="">Mínimo</option>{op_min}</select>
        <select id="sb-pmax" name="precioMax" aria-label="Precio máximo"><option value="">Máximo</option>{op_max}</select>
      </div>
    </div>
    <div class="field">
      <label for="sb-rec">Recámaras</label>
      <select id="sb-rec" name="rec"><option value="">Todas</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option></select>
    </div>
    <div class="field search-actions">
      <button type="submit" class="btn">{icon("search")} Buscar propiedades</button>
    </div>
  </div>
  <div class="search-extra">
    <a class="link-arrow small" href="{R("propiedades/")}">Más filtros{icon("arrow")}</a>
    <span class="tiny muted">Solo propiedades en las 16 alcaldías de la Ciudad de México</span>
  </div>
</form>'''


def cta_band(path, titulo, texto, primario=("Hablar con Gio", "contacto/"), secundario=None):
    R = lambda t: rel(path, t)
    sec = ""
    if secundario:
        sec = f'<a class="btn btn--outline-light" href="{R(secundario[1])}">{e(secundario[0])}</a>'
    return f'''<section class="section"><div class="wrap"><div class="cta-band">
  <h2>{e(titulo)}</h2>
  <p>{e(texto)}</p>
  <div class="cta-actions">
    <a class="btn btn--light" href="{R(primario[1])}">{e(primario[0])}</a>{sec}
  </div>
</div></div></section>'''


def faq_block(faqs, titulo="Preguntas frecuentes"):
    items = "".join(
        f'<details><summary>{e(q)}</summary><div class="acc-body"><p>{e(a)}</p></div></details>'
        for q, a in faqs
    )
    return f'''<section class="section section--ivory"><div class="wrap-narrow">
  <p class="eyebrow">Dudas comunes</p>
  <h2>{e(titulo)}</h2>
  <div class="accordion" style="margin-top:2rem">{items}</div>
</div></section>'''


def faq_schema(faqs):
    return {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs
        ],
    }


def person_schema():
    return {
        "@context": "https://schema.org",
        "@type": "RealEstateAgent",
        "@id": SITE + "/#gio-filio",
        "name": "Gio Filio",
        "alternateName": "Gio Filio — Tu espacio ideal",
        "slogan": "Tu espacio ideal",
        "description": "Asesoría inmobiliaria personal en Ciudad de México para comprar, rentar, vender e invertir.",
        "url": SITE + "/",
        "logo": SITE + "/assets/img/brand/logo-principal.png",
        "image": SITE + "/assets/img/gio/retrato-1200.jpg",
        "email": MARCA["email"],
        "telephone": "+" + MARCA["whatsapp"],
        "priceRange": "$$$",
        "areaServed": {
            "@type": "City", "name": "Ciudad de México",
            "address": {"@type": "PostalAddress", "addressLocality": "Ciudad de México",
                        "addressRegion": "CDMX", "addressCountry": "MX"},
        },
        "address": {"@type": "PostalAddress", "addressLocality": "Ciudad de México",
                    "addressRegion": "CDMX", "addressCountry": "MX"},
        "sameAs": [MARCA["instagram"], MARCA["facebook"], MARCA["linkedin"]],
        "employee": {
            "@type": "Person", "name": "Gio Filio", "jobTitle": "Asesora Inmobiliaria",
            "image": SITE + "/assets/img/gio/perfil-1200.jpg", "worksFor": {"@id": SITE + "/#gio-filio"},
        },
    }
