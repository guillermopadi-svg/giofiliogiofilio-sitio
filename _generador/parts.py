# -*- coding: utf-8 -*-
"""Gio Filio — Bloques de página reutilizables (filtros, resultados, formularios)."""
from render import (e, rel, icon, money, money_short, num, ICONS)
from data_props import TIPOS, AMENIDADES, ESTADOS_INMUEBLE
from data_zonas import ALCALDIAS, COLONIAS, MARCA


# --------------------------------------------------------------- FILTROS
def filters_html(idsuf=""):
    tipos = "".join(
        f'<button type="button" class="pill" data-v="{t[0]}" aria-pressed="false">{e(t[1])}</button>'
        for t in TIPOS
    )
    alcs = "".join(
        f'<option value="{a["slug"]}">{e(a["nombre"])}</option>' for a in ALCALDIAS
    )
    cols = "".join(
        f'<option value="{c["slug"]}">{e(c["nombre"])} — {e(c["alcaldia"])}</option>' for c in COLONIAS
    )
    estados = "".join(f'<option value="{s[0]}">{e(s[1])}</option>' for s in ESTADOS_INMUEBLE)

    def numrow(key, label, maxn=5):
        btns = "".join(
            f'<button type="button" class="pill" data-v="{i}" aria-pressed="false">{i}+</button>'
            for i in range(1, maxn + 1)
        )
        return f'''<div class="filter-group"><h4>{e(label)}</h4>
      <div class="pill-row" data-f-pill="{key}">
        <button type="button" class="pill" data-v="" aria-pressed="true">Todas</button>{btns}
      </div></div>'''

    amen = "".join(
        f'<label class="check"><input type="checkbox" data-f-check="amenidades" data-v="{a[0]}"> {e(a[1])} <span class="cnt"></span></label>'
        for a in AMENIDADES
    )
    estatus = "".join(
        f'<label class="check"><input type="checkbox" data-f-check="badges" data-v="{k}"> {e(v)} <span class="cnt"></span></label>'
        for k, v in [("nueva", "Propiedades nuevas"), ("entrega-inmediata", "Entrega inmediata"),
                     ("preventa", "Preventa"), ("exclusiva", "Exclusiva de Gio Filio"),
                     ("oportunidad", "Oportunidad")]
    )

    return f'''
<div class="filter-group">
  <h4>Operación</h4>
  <div class="seg" data-f-seg="operacion">
    <button type="button" data-v="" aria-pressed="true">Todas</button>
    <button type="button" data-v="venta" aria-pressed="false">Venta</button>
    <button type="button" data-v="renta" aria-pressed="false">Renta</button>
  </div>
</div>
<div class="filter-group">
  <h4>Precio (MXN)</h4>
  <div class="field-pair">
    <input type="number" inputmode="numeric" min="0" step="50000" placeholder="Mínimo" aria-label="Precio mínimo" data-f-input="precioMin" style="height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem;width:100%">
    <input type="number" inputmode="numeric" min="0" step="50000" placeholder="Máximo" aria-label="Precio máximo" data-f-input="precioMax" style="height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem;width:100%">
  </div>
</div>
<div class="filter-group">
  <h4>Tipo de inmueble</h4>
  <div class="pill-row" data-f-pill="tipo">
    <button type="button" class="pill" data-v="" aria-pressed="true">Todos</button>{tipos}
  </div>
</div>
<div class="filter-group">
  <h4>Alcaldía</h4>
  <select data-f-select="alcaldia" aria-label="Filtrar por alcaldía" style="width:100%;height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem">
    <option value="">Todas las alcaldías de CDMX</option>{alcs}
  </select>
</div>
<div class="filter-group">
  <h4>Colonia</h4>
  <select data-f-select="colonia" aria-label="Filtrar por colonia" style="width:100%;height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem">
    <option value="">Todas las colonias</option>{cols}
  </select>
</div>
{numrow("rec", "Recámaras")}
{numrow("ban", "Baños", 4)}
{numrow("est", "Estacionamientos", 4)}
<div class="filter-group">
  <h4>Superficie (m²)</h4>
  <div class="field-pair">
    <input type="number" inputmode="numeric" min="0" step="10" placeholder="Mínima" aria-label="Superficie mínima" data-f-input="m2Min" style="height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem;width:100%">
    <input type="number" inputmode="numeric" min="0" step="10" placeholder="Máxima" aria-label="Superficie máxima" data-f-input="m2Max" style="height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem;width:100%">
  </div>
</div>
<div class="filter-group">
  <h4>Antigüedad</h4>
  <select data-f-select="antiguedad" aria-label="Filtrar por antigüedad" style="width:100%;height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem">
    <option value="">Cualquier antigüedad</option>
    <option value="nueva">Nueva (0 a 1 año)</option>
    <option value="0-5">0 a 5 años</option>
    <option value="5-15">5 a 15 años</option>
    <option value="15+">Más de 15 años</option>
  </select>
</div>
<div class="filter-group">
  <h4>Estado del inmueble</h4>
  <select data-f-select="estado" aria-label="Filtrar por estado del inmueble" style="width:100%;height:44px;border:1px solid var(--line);border-radius:var(--r-sm);padding:0 .7rem">
    <option value="">Cualquier estado</option>{estados}
  </select>
</div>
<div class="filter-group">
  <h4>Estatus y oportunidades</h4>
  <div class="check-list">{estatus}</div>
</div>
<div class="filter-group">
  <h4>Amenidades y características</h4>
  <div class="check-list">{amen}</div>
</div>'''


SORT_OPTS = [
    ("recomendadas", "Recomendadas por Gio"),
    ("recientes", "Más recientes"),
    ("precio-asc", "Menor precio"),
    ("precio-desc", "Mayor precio"),
    ("superficie", "Mayor superficie"),
    ("m2", "Precio por m²"),
]


def results_block(path, titulo, intro=""):
    R = lambda t: rel(path, t)
    sorts = "".join(f'<option value="{k}">{e(v)}</option>' for k, v in SORT_OPTS)
    return f'''
<section id="resultados">
  <div class="results-layout" data-view="split">
    <div class="results-col">
      <div style="display:grid;grid-template-columns:238px 1fr;gap:1.5rem;align-items:start">
        <aside aria-label="Filtros de búsqueda" style="min-width:0" class="filters-desktop">
          <div class="filters-panel">
            <div class="flex-between" style="margin-bottom:.5rem">
              <h3 style="font-size:var(--step-1);margin:0">Filtros</h3>
              <button type="button" class="link-arrow small" onclick="window.gfClearFilters&&window.gfClearFilters()">Limpiar</button>
            </div>
            {filters_html()}
          </div>
        </aside>
        <div style="min-width:0">
          <div class="results-head">
            <div>
              <h1 style="font-size:var(--step-2);margin-bottom:.2rem">{e(titulo)}</h1>
              <p class="results-count" id="resCount"><b>0</b> propiedades</p>
              {f'<p class="small muted" style="max-width:60ch;margin-top:.4rem">{e(intro)}</p>' if intro else ''}
            </div>
            <div class="results-toolbar">
              <div class="view-switch" role="group" aria-label="Modo de vista">
                <button type="button" data-view="lista" aria-pressed="false">Lista</button>
                <button type="button" data-view="split" aria-pressed="true">Lista + mapa</button>
                <button type="button" data-view="mapa" aria-pressed="false">Mapa</button>
              </div>
              <label class="sr-only" for="sortSel">Ordenar resultados</label>
              <select class="sort-select" id="sortSel" data-sort>{sorts}</select>
            </div>
          </div>
          <div class="active-filters" id="activeFilters"></div>
          <div id="resList" aria-live="polite"></div>
        </div>
      </div>
    </div>
    <div class="map-col" aria-label="Mapa de propiedades">
      <div id="map" style="height:100%">
        <div class="map-canvas"></div>
        <div class="map-toolbar">
          <button type="button" class="btn btn--light btn--sm" id="mapSearchArea" style="display:none">{icon("search")} Buscar en esta zona</button>
        </div>
        <div class="map-zoom">
          <button type="button" data-map-zoom="1" aria-label="Acercar mapa">{icon("plus")}</button>
          <button type="button" data-map-zoom="-1" aria-label="Alejar mapa">{icon("minus")}</button>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="mobile-actions">
  <button type="button" class="btn btn--ghost" data-open-drawer="filtersDrawer">{icon("filter")} Filtros</button>
  <button type="button" class="btn" id="mobileMapBtn">{icon("map")} Ver mapa</button>
</div>

<div class="drawer drawer--filters" id="filtersDrawer" role="dialog" aria-modal="true" aria-label="Filtros de búsqueda" aria-hidden="true">
  <div class="drawer-grab"></div>
  <div class="drawer-head">
    <h3>Filtros</h3>
    <button type="button" class="icon-btn" data-close-drawer aria-label="Cerrar filtros">{icon("close")}</button>
  </div>
  <div class="drawer-body">{filters_html("-m")}</div>
  <div class="drawer-foot">
    <button type="button" class="btn btn--ghost" onclick="window.gfClearFilters&&window.gfClearFilters()">Limpiar todo</button>
    <button type="button" class="btn" data-close-drawer>Ver resultados</button>
  </div>
</div>

<div class="cmp-bar" id="cmpBar">
  <span class="cb-txt">0 propiedades seleccionadas</span>
  <a class="btn btn--light btn--sm" href="{R("comparador/")}">Comparar</a>
</div>

<style>
@media (max-width:1080px){{ .filters-desktop{{ display:none; }} .results-col > div{{ grid-template-columns:1fr !important; }} }}
</style>'''


# --------------------------------------------------------------- FORMULARIOS
def contact_form(path, *, form_name="contacto", property_id="", source="sitio_web",
                 titulo="¿Te interesa esta propiedad?", sub="Habla directamente con Gio.",
                 event="generate_lead", show_operacion=False):
    R = lambda t: rel(path, t)
    op = ""
    if show_operacion:
        op = '''<div class="form-row">
      <label for="cf-op">¿Qué te interesa?</label>
      <select id="cf-op" name="operacion" required>
        <option value="">Selecciona una opción</option>
        <option value="comprar">Comprar</option>
        <option value="rentar">Rentar</option>
        <option value="vender">Vender</option>
        <option value="invertir">Invertir</option>
        <option value="valuar">Saber cuánto vale mi propiedad</option>
      </select><span class="err">Elige una opción</span>
    </div>'''
    return f'''
<form data-lead-form data-form-name="{e(form_name)}" data-source="{e(source)}" data-event="{e(event)}"
      {f'data-property-id="{e(property_id)}"' if property_id else ''} id="contactoGio" novalidate>
  <div class="form-grid-2">
    <div class="form-row">
      <label for="cf-nombre">Nombre</label>
      <input type="text" id="cf-nombre" name="nombre" required autocomplete="name" placeholder="Tu nombre">
      <span class="err">Escribe tu nombre</span>
    </div>
    <div class="form-row">
      <label for="cf-tel">WhatsApp</label>
      <input type="tel" id="cf-tel" name="telefono" required autocomplete="tel" placeholder="55 1234 5678" inputmode="tel">
      <span class="err">Escribe un teléfono de 10 dígitos</span>
    </div>
  </div>
  <div class="form-row">
    <label for="cf-mail">Correo</label>
    <input type="email" id="cf-mail" name="email" required autocomplete="email" placeholder="tu@correo.com">
    <span class="err">Escribe un correo válido</span>
  </div>
  {op}
  <div class="form-row">
    <label for="cf-msg">Mensaje</label>
    <textarea id="cf-msg" name="mensaje" placeholder="Cuéntame qué buscas y cómo te gustaría vivir."></textarea>
  </div>
  <label class="form-consent">
    <input type="checkbox" name="consent" required>
    <span>Acepto el <a href="{R("aviso-de-privacidad/")}">aviso de privacidad</a> y que Gio Filio me contacte por WhatsApp, correo o teléfono.</span>
  </label>
  <div class="form-actions">
    <button type="submit" class="btn btn--block">Enviar mensaje</button>
    <a class="btn btn--wa btn--block" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="{e(form_name)}">{icon("wa")} WhatsApp</a>
    {f'<button type="button" class="btn btn--gold btn--block" data-schedule="{e(property_id)}">Agendar visita</button>' if property_id else ''}
  </div>
</form>
<div class="form-success" data-form-success role="status">
  {icon("checkc")}
  <h4 style="margin-bottom:.35rem">Mensaje recibido</h4>
  <p class="small" style="margin:0">Gio te contacta personalmente, normalmente el mismo día. Si prefieres avanzar ahora, escríbele por WhatsApp.</p>
  <a class="btn btn--wa btn--sm" style="margin-top:1rem" href="https://wa.me/{MARCA["whatsapp"]}" target="_blank" rel="noopener" data-wa-global="post_lead">{icon("wa")} Abrir WhatsApp</a>
</div>'''


def gio_card(path, property_id="", titulo="¿Te interesa esta propiedad?", sub="Habla directamente con Gio."):
    R = lambda t: rel(path, t)
    return f'''<aside class="gio-card" aria-label="Contactar a Gio Filio">
  <div class="gio-card-top">
    <img class="gio-avatar" src="{R("assets/img/gio/avatar-320.jpg")}" alt="Gio Filio, asesora inmobiliaria" width="62" height="62">
    <div>
      <div class="gc-name">Gio Filio</div>
      <div class="gc-role">Asesora Inmobiliaria · CDMX</div>
    </div>
    <img class="gc-logo" src="{R("assets/img/brand/isotipo-blanco-navy.png")}" alt="" aria-hidden="true" width="26" height="26">
  </div>
  <div class="gio-card-body">
    <h4>{e(titulo)}</h4>
    <p class="small">{e(sub)}</p>
    {contact_form(path, form_name="ficha_propiedad" if property_id else "contacto_lateral",
                  property_id=property_id, source="ficha_propiedad" if property_id else "sitio_web")}
  </div>
</aside>'''


def testimonial_block(testimonios, limit=3):
    cards = "".join(f'''<figure class="testimonial">
  <div class="t-mark" aria-hidden="true">”</div>
  <blockquote style="margin:0"><p>{e(t["texto"])}</p></blockquote>
  <footer><cite>{e(t["nombre"])}</cite><small>{e(t["contexto"])}</small></footer>
</figure>''' for t in testimonios[:limit])
    return f'<div class="grid grid-3">{cards}</div>'


def lightbox_markup():
    return f'''<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Galería de fotografías" aria-hidden="true">
  <div class="lb-head">
    <span id="lbCounter" class="small">1 / 1</span>
    <button type="button" id="lbClose" aria-label="Cerrar galería">{icon("close")}</button>
  </div>
  <div class="lb-stage">
    <button type="button" class="lb-nav lb-prev" id="lbPrev" aria-label="Fotografía anterior">{icon("chevl")}</button>
    <img id="lbStageImg" src="" alt="">
    <button type="button" class="lb-nav lb-next" id="lbNext" aria-label="Fotografía siguiente">{icon("chev")}</button>
  </div>
  <div class="lb-thumbs" id="lbThumbs"></div>
</div>'''
