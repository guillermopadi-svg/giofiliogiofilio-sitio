# -*- coding: utf-8 -*-
"""Screenshots + prueba funcional del sitio con Chromium."""
import os, sys, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8899"
OUT = "shots"
os.makedirs(OUT, exist_ok=True)

PAGES = [
    ("home", "/", 2600),
    ("propiedades", "/propiedades/", 1400),
    ("ficha", "/propiedad/departamento-polanco-terraza-y-vista-a-chapultepec-gf1024/", 2600),
    ("colonia", "/propiedades/polanco/", 2400),
    ("alcaldia", "/zonas/miguel-hidalgo/", 2000),
    ("gio", "/conoce-a-gio/", 2600),
    ("vender", "/vender/", 2400),
    ("valuacion", "/valuacion/", 1800),
    ("blog", "/blog/", 1600),
    ("post", "/blog/roma-norte-vs-condesa/", 1800),
    ("comparador", "/comparador/", 1200),
    ("contacto", "/contacto/", 1600),
    ("seo-combo", "/venta/departamentos/polanco/", 1800),
    ("zonas", "/zonas/", 2000),
]

errors = []

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])

    # ---------------- Desktop
    ctx = b.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=1.6, locale="es-MX")
    pg = ctx.new_page()
    logs = []
    pg.on("console", lambda m: logs.append((m.type, m.text)) if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda ex: errors.append(f"PAGEERROR {pg.url}: {ex}"))

    for name, url, h in PAGES:
        pg.goto(BASE + url, wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(700)
        pg.screenshot(path=f"{OUT}/d-{name}.png", clip={"x": 0, "y": 0, "width": 1440, "height": h})

    # ---------------- Pruebas funcionales
    print("\n— PRUEBAS FUNCIONALES —")

    # 1. Buscador desde el home
    pg.goto(BASE + "/", wait_until="networkidle")
    pg.fill("#sb-loc", "Polan")
    pg.wait_for_timeout(400)
    ac = pg.locator("#sb-ac .ac-item").first
    assert ac.is_visible(), "autocomplete no abrió"
    ac.click()
    pg.click(".search-actions button[type=submit]")
    pg.wait_for_load_state("networkidle")
    print("  buscador →", pg.url)
    assert "colonia=polanco" in pg.url, "el buscador no propagó la colonia"

    # 2. Resultados y conteo
    pg.wait_for_timeout(800)
    cnt = pg.inner_text("#resCount")
    n_cards = pg.locator("#resList .pcard").count()
    print(f"  resultados Polanco: '{cnt.strip()}' · {n_cards} tarjetas")
    assert n_cards > 0, "sin tarjetas en resultados"

    # 3. Filtro por operación
    pg.click('[data-f-seg="operacion"] button[data-v="renta"]')
    pg.wait_for_timeout(600)
    n2 = pg.locator("#resList .pcard").count()
    print(f"  filtro renta → {n2} tarjetas · URL {pg.url.split('?')[1]}")
    pg.screenshot(path=f"{OUT}/d-resultados-filtrado.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1500})

    # 4. Orden
    pg.select_option("#sortSel", "precio-asc")
    pg.wait_for_timeout(500)
    print("  orden precio-asc OK")

    # 5. Pines de mapa
    pins = pg.locator(".map-pin").count()
    print(f"  mapa: {pins} pines")
    assert pins > 0, "mapa sin pines"

    # 6. Favoritos
    pg.goto(BASE + "/propiedades/", wait_until="networkidle")
    pg.wait_for_timeout(900)
    pg.locator(".pcard-fav").first.click()
    pg.locator(".pcard-fav").nth(1).click()
    pg.wait_for_timeout(400)
    fav = pg.eval_on_selector("[data-fav-count]", "el=>el.textContent")
    print(f"  favoritos guardados: {fav}")
    assert fav == "2", f"contador de favoritos = {fav}"
    pg.goto(BASE + "/favoritos/", wait_until="networkidle")
    pg.wait_for_timeout(600)
    nf = pg.locator("#favList .pcard").count()
    print(f"  página favoritos: {nf} tarjetas")
    assert nf == 2
    pg.screenshot(path=f"{OUT}/d-favoritos.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1300})

    # 7. Comparador
    pg.goto(BASE + "/propiedades/", wait_until="networkidle")
    pg.wait_for_timeout(900)
    for i in range(3):
        pg.locator(".pcard-cmp input").nth(i).check()
        pg.wait_for_timeout(150)
    pg.goto(BASE + "/comparador/", wait_until="networkidle")
    pg.wait_for_timeout(600)
    cols = pg.locator(".cmp-table thead th").count()
    rows = pg.locator(".cmp-table tbody tr").count()
    print(f"  comparador: {cols-1} propiedades × {rows} filas")
    assert cols == 4 and rows > 10
    pg.screenshot(path=f"{OUT}/d-comparador.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1700})

    # 8. Galería / lightbox
    pg.goto(BASE + "/propiedad/departamento-polanco-terraza-y-vista-a-chapultepec-gf1024/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.click(".gallery-more")
    pg.wait_for_timeout(600)
    assert pg.locator("#lightbox.is-open").count() == 1, "lightbox no abrió"
    print("  lightbox abre OK ·", pg.inner_text("#lbCounter"))
    pg.screenshot(path=f"{OUT}/d-lightbox.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})
    pg.click("#lbClose")

    # 9. Formulario de contacto (validación + envío)
    pg.fill("#cf-nombre", "Memo Padilla")
    pg.fill("#cf-tel", "5512345678")
    pg.fill("#cf-mail", "memo@ejemplo.com")
    pg.fill("#cf-msg", "Me interesa agendar una visita.")
    pg.check('input[name="consent"]')
    pg.click('#contactoGio button[type=submit]')
    pg.wait_for_timeout(500)
    ok = pg.locator("[data-form-success].is-on").count()
    print(f"  formulario ficha → success visible: {bool(ok)}")
    assert ok == 1
    lead = pg.evaluate("JSON.parse(localStorage.getItem('gf_leads_v1')||'[]').slice(-1)[0]")
    print("  lead capturado:", json.dumps({k: lead[k] for k in
          ("nombre", "email", "propiedad_id", "colonia", "alcaldia", "ciudad", "fuente")}, ensure_ascii=False))
    dl = pg.evaluate("window.dataLayer.map(x=>x.event).filter(Boolean)")
    print("  dataLayer:", dl)
    assert "generate_lead" in dl and "view_property" in dl

    # 10. Valuación
    pg.goto(BASE + "/valuacion/", wait_until="networkidle")
    pg.select_option("#valAlcaldia", "miguel-hidalgo")
    pg.wait_for_timeout(300)
    pg.select_option("#valColonia", "polanco")
    pg.select_option("#val-tipo", "departamento")
    pg.fill("#val-m2", "165")
    pg.fill("#val-nombre", "Memo Padilla")
    pg.fill("#val-tel", "5512345678")
    pg.fill("#val-mail", "memo@ejemplo.com")
    pg.check('#valForm input[name="consent"]')
    pg.click("#valForm button[type=submit]")
    pg.wait_for_timeout(700)
    print("  valuación →", pg.inner_text("#valLow"), "a", pg.inner_text("#valHigh"))
    assert pg.locator("#valResult.is-on").count() == 1
    pg.screenshot(path=f"{OUT}/d-valuacion-resultado.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1500})

    # 11. Formulario de vender
    pg.goto(BASE + "/vender/", wait_until="networkidle")
    pg.select_option("#venAlcaldia", "coyoacan")
    pg.wait_for_timeout(300)
    opts = pg.locator("#venColonia option").count()
    print(f"  vender: colonias dependientes de alcaldía = {opts}")
    assert opts > 1

    ctx.close()

    # ---------------- Móvil
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                      is_mobile=True, has_touch=True, locale="es-MX",
                      user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    mp = m.new_page()
    for name, url, h in [("home", "/", 1900), ("propiedades", "/propiedades/", 1500),
                         ("ficha", "/propiedad/departamento-polanco-terraza-y-vista-a-chapultepec-gf1024/", 1900),
                         ("colonia", "/propiedades/polanco/", 1700), ("gio", "/conoce-a-gio/", 1700)]:
        mp.goto(BASE + url, wait_until="networkidle", timeout=45000)
        mp.wait_for_timeout(600)
        mp.screenshot(path=f"{OUT}/m-{name}.png", clip={"x": 0, "y": 0, "width": 390, "height": h})

    # menú hamburguesa
    mp.goto(BASE + "/", wait_until="networkidle")
    mp.click("#burger")
    mp.wait_for_timeout(500)
    assert mp.locator("#mobileNav.is-open").count() == 1
    mp.screenshot(path=f"{OUT}/m-menu.png")
    mp.click("#mobileNavClose")

    # drawer de filtros
    mp.goto(BASE + "/propiedades/", wait_until="networkidle")
    mp.wait_for_timeout(800)
    mp.click('[data-open-drawer="filtersDrawer"]')
    mp.wait_for_timeout(600)
    assert mp.locator("#filtersDrawer.is-open").count() == 1
    mp.screenshot(path=f"{OUT}/m-filtros.png")
    mp.click("#filtersDrawer [data-close-drawer]")
    # ver mapa
    mp.click("#mobileMapBtn")
    mp.wait_for_timeout(700)
    mp.screenshot(path=f"{OUT}/m-mapa.png")
    print("  móvil: menú, drawer de filtros y vista mapa OK")

    m.close()
    b.close()

print("\n— CONSOLA —")
if errors:
    for x in errors[:10]: print("  ", x)
else:
    print("  sin errores de JavaScript")
print(f"\nScreenshots en {OUT}/ ({len(os.listdir(OUT))} archivos)")
sys.exit(1 if errors else 0)
