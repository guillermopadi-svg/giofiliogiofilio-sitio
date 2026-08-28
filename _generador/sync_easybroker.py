# -*- coding: utf-8 -*-
"""Sincroniza el inventario real de Gio Filio desde la API de EasyBroker.

Requiere la variable de entorno EASYBROKER_API_KEY (cuenta propia de Gio Filio,
no la de otra inmobiliaria). La key solo se usa desde este script — nunca se
expone al navegador, tal como exige EasyBroker.

Uso:
    export EASYBROKER_API_KEY="..."
    python3 sync_easybroker.py

Genera:
    - data_props_live.py   (mismo esquema que data_props.py, con datos reales)
    - assets/img/properties/eb-<public_id>-<n>-<size>.(jpg|webp)
    - un reporte en consola con colonias/tipos que no se pudieron mapear
      automáticamente y necesitan revisión manual.

Este script NO modifica data_props.py ni corre el build. Cuando el reporte
salga limpio, cambia el import en prep.py de `data_props` a `data_props_live`
y corre `python3 build.py`.
"""
import os, re, sys, json, math, unicodedata
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from data_zonas import COLONIAS, ALCALDIA_SLUG_BY_NOMBRE, ALCALDIAS

API_BASE = "https://api.easybroker.com/v1"
OUT = ".."  # el sitio real es el directorio padre de _generador
IMG_DIR = os.path.join(OUT, "assets/img/properties")

API_KEY = os.environ.get("EASYBROKER_API_KEY", "").strip()
if not API_KEY:
    sys.exit("Falta EASYBROKER_API_KEY en el entorno. Exporta la key de la cuenta de Gio Filio antes de correr este script.")


# --------------------------------------------------------------- HTTP helper
def eb_get(path, params=None, _retries=12):
    import time
    url = f"{API_BASE}{path}"
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode(params, doseq=True)
    req = Request(url, headers={"X-Authorization": API_KEY, "Accept": "application/json"})
    for attempt in range(1, _retries + 1):
        try:
            with urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except HTTPError as e:
            body = e.read().decode("utf-8", "ignore")
            if e.code in (429, 500, 502, 503, 504) and attempt < _retries:
                wait = min(2 ** attempt, 45)
                print(f"  ! EasyBroker {e.code} (sobrecarga temporal), reintentando en {wait}s ({attempt}/{_retries})...")
                time.sleep(wait)
                continue
            sys.exit(f"EasyBroker respondió {e.code} en {path}: {body[:300]}")
        except OSError as e:
            if attempt == _retries:
                sys.exit(f"Red no disponible tras {_retries} intentos en {path}: {e}")
            wait = min(2 ** attempt, 45)
            print(f"  ! red no disponible ({e}), reintentando en {wait}s ({attempt}/{_retries})...")
            time.sleep(wait)


def eb_list_published():
    page, out = 1, []
    while True:
        data = eb_get("/properties", {
            "page": page, "limit": 50,
            "search[statuses][]": "published",
        })
        out.extend(data.get("content", data.get("properties", [])))
        if not data.get("next_page"):
            break
        page += 1
    return out


def eb_detail(public_id):
    return eb_get(f"/properties/{public_id}")


# --------------------------------------------------------- mapeo de colonia
def _slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


CP_TO_COLONIA = {}
for c in COLONIAS:
    for cp in c.get("cp", []):
        CP_TO_COLONIA[cp] = c


def haversine(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


ALCALDIA_SLUG_BY_SLUGNOMBRE = {_slug(a["nombre"]): a["slug"] for a in ALCALDIAS}
CDMX_ALIASES = {"ciudad de mexico", "cdmx", "distrito federal"}


def match_colonia(location, warnings, public_id):
    cp = (location or {}).get("postal_code") or ""
    if cp in CP_TO_COLONIA:
        return CP_TO_COLONIA[cp], True

    lat, lng = (location or {}).get("latitude"), (location or {}).get("longitude")
    name = (location or {}).get("name") or ""
    partes = [x.strip() for x in name.split(",") if x.strip()]
    colonia_real = partes[0] if partes else ""
    ciudad_real = partes[1] if len(partes) >= 2 else ""
    estado_real = partes[-1] if partes else ""
    es_cdmx = _slug(estado_real) in CDMX_ALIASES or _slug(estado_real).replace("-", "") == "ciudaddemexico"

    if name and es_cdmx and _slug(ciudad_real) in ALCALDIA_SLUG_BY_SLUGNOMBRE:
        # Colonia sin ficha propia en el catálogo, pero dentro de una alcaldía
        # real de CDMX (ej. Iztapalapa) — se publica con su alcaldía real,
        # sin página de colonia dedicada.
        warnings.append(
            f"{public_id}: CP '{cp}' no está en el catálogo — colonia '{colonia_real}' sin página "
            f"propia, se usa su alcaldía real '{ciudad_real}' (sin forzar a otra colonia)."
        )
        return {
            "slug": _slug(f"{colonia_real}-{public_id}") or _slug(public_id),
            "nombre": colonia_real or ciudad_real, "alcaldia": ciudad_real,
            "lat": lat, "lng": lng, "cp": [cp] if cp else [],
            "_sin_pagina": True,
        }, False

    if name and estado_real and not es_cdmx:
        # Propiedad fuera de la Ciudad de México: Gio también vende en el
        # resto del país, se publica con su ubicación real tal cual.
        warnings.append(
            f"{public_id}: fuera de CDMX — se publica con su ubicación real "
            f"({colonia_real}, {ciudad_real}, {estado_real})."
        )
        return {
            "slug": _slug(f"{colonia_real}-{ciudad_real}-{public_id}") or _slug(public_id),
            "nombre": colonia_real or ciudad_real, "alcaldia": ciudad_real or estado_real,
            "estado": estado_real, "lat": lat, "lng": lng, "cp": [cp] if cp else [],
            "_sin_pagina": True, "_fuera_cdmx": True,
        }, False

    if lat is None or lng is None:
        warnings.append(f"{public_id}: sin CP conocido ni coordenadas — revisar colonia manualmente ({location!r})")
        return COLONIAS[0], False
    nearest = min(COLONIAS, key=lambda c: haversine(lat, lng, c["lat"], c["lng"]))
    dist = haversine(lat, lng, nearest["lat"], nearest["lng"])
    warnings.append(
        f"{public_id}: CP '{cp}' no está en el catálogo de colonias y sin location.name utilizable "
        f"— asignado por cercanía a '{nearest['nombre']}' ({dist:.1f} km). Verifica que sea correcto."
    )
    return nearest, False


# ------------------------------------------------------------- mapeo de tipo
TIPO_MAP = {
    "Apartment": "departamento", "Departamento": "departamento",
    "House": "casa", "Casa": "casa",
    "House in condominium": "casa-en-condominio", "Casa en condominio": "casa-en-condominio",
    "Penthouse": "penthouse",
    "Loft": "loft",
    "Land": "terreno", "Terreno": "terreno", "Lot": "terreno",
    "Office": "oficina", "Oficina": "oficina",
    "Commercial premises": "local-comercial", "Local comercial": "local-comercial",
    "Development": "desarrollo", "Desarrollo": "desarrollo",
    "Warehouse": "local-comercial", "Bodega comercial": "local-comercial",
}


def match_tipo(property_type, warnings, public_id):
    slug = TIPO_MAP.get(property_type)
    if slug:
        return slug
    warnings.append(f"{public_id}: property_type '{property_type}' sin mapeo — se dejó como 'departamento', revisa TIPO_MAP en sync_easybroker.py")
    return "departamento"


AMENIDAD_MAP = {
    "seguridad": "seguridad", "security": "seguridad", "vigilancia": "seguridad",
    "elevador": "elevador", "elevator": "elevador",
    "alberca": "alberca", "pool": "alberca",
    "gimnasio": "gimnasio", "gym": "gimnasio",
    "roof garden": "roof-garden", "roof-garden": "roof-garden",
    "salon de eventos": "salon-eventos", "salon social": "salon-eventos",
    "jardin": "jardin", "garden": "jardin",
    "terraza": "terraza", "terrace": "terraza",
    "balcon": "balcon", "balcony": "balcon",
    "bodega": "bodega", "storage": "bodega",
    "cuarto de servicio": "cuarto-servicio",
    "estudio": "home-office", "home office": "home-office",
    "pet friendly": "pet-friendly", "acepta mascotas": "pet-friendly",
    "amueblado": "amueblado", "furnished": "amueblado",
    "accesibilidad": "accesibilidad",
    "estacionamiento de visitas": "estacionamiento-visitas",
    "area de juegos": "area-juegos", "juegos infantiles": "area-juegos",
    "cisterna": "cisterna",
    "planta de emergencia": "planta-emergencia",
    "asador": "asador", "asadores": "asador",
}


def match_amenidades(features):
    out = []
    for f in features or []:
        key = _slug(f.get("name", "")).replace("-", " ")
        slug = AMENIDAD_MAP.get(key)
        if slug and slug not in out:
            out.append(slug)
    return out


# ------------------------------------------------------------------ fotos
def build_property_images(public_id, image_urls):
    from PIL import Image
    import io
    sizes = {"card": 720, "hero": 1440, "thumb": 380}
    os.makedirs(IMG_DIR, exist_ok=True)
    prefix = f"eb-{public_id.lower()}"
    made = []
    for n, url in enumerate(image_urls):
        try:
            with urlopen(url, timeout=30) as r:
                raw = r.read()
        except Exception as e:
            print(f"  ! no se pudo descargar foto {n} de {public_id}: {e}")
            continue
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        entry = {}
        for key, w in sizes.items():
            ratio = min(1, w / im.size[0])
            tgt = im.resize((int(im.size[0] * ratio), int(im.size[1] * ratio)), Image.LANCZOS)
            if key in ("card", "thumb"):
                tw, th = tgt.size
                want = tw * 3 / 4
                if th > want:
                    top = int((th - want) * 0.42)
                    tgt = tgt.crop((0, top, tw, top + int(want)))
            base = f"{prefix}-{n:02d}-{key}"
            tgt.save(os.path.join(IMG_DIR, base + ".jpg"), quality=82, optimize=True, progressive=True)
            tgt.save(os.path.join(IMG_DIR, base + ".webp"), quality=78, method=6)
            entry[key] = f"assets/img/properties/{base}"
        made.append(entry)
    return made


# --------------------------------------------------------------- operacion
OPERACION_MAP = {"sale": "venta", "rental": "renta", "temporary_rental": "renta"}


def main():
    warnings = []
    listed = eb_list_published()
    print(f"EasyBroker: {len(listed)} propiedades publicadas encontradas.")

    props = []
    for row in listed:
        public_id = row["public_id"]
        p = eb_detail(public_id)

        ops = p.get("operations") or []
        op = next((o for o in ops if o["type"] in OPERACION_MAP), None)
        if not op:
            warnings.append(f"{public_id}: sin operación de venta/renta reconocida — se omite")
            continue

        colonia, exact = match_colonia(p.get("location"), warnings, public_id)
        tipo = match_tipo(p.get("property_type"), warnings, public_id)
        images = [img["url"] for img in (p.get("images") or []) if img.get("url")]
        fotos = build_property_images(public_id, images) if images else []
        if not fotos:
            warnings.append(f"{public_id}: sin fotografías — la ficha quedará sin imagen de portada")

        titulo = p.get("title") or f"Propiedad en {colonia['nombre']}"
        slug = _slug(titulo)[:60] or "propiedad"

        props.append(dict(
            id=public_id,
            titulo=titulo,
            titulo_wa=f"la propiedad en {colonia['nombre']}",
            operacion=OPERACION_MAP[op["type"]],
            tipo=tipo,
            colonia=colonia["slug"],
            colonia_nombre_real=colonia["nombre"],
            alcaldia_real=colonia.get("alcaldia") or "",
            estado_real=colonia.get("estado") or "",
            sin_pagina=bool(colonia.get("_sin_pagina")),
            fuera_cdmx=bool(colonia.get("_fuera_cdmx")),
            precio=op.get("amount") or 0,
            moneda=op.get("currency", "MXN"),
            mantenimiento=0,
            calle=(p.get("location") or {}).get("street") or "",
            cp=(p.get("location") or {}).get("postal_code") or "",
            lat=(p.get("location") or {}).get("latitude"),
            lng=(p.get("location") or {}).get("longitude"),
            rec=p.get("bedrooms") or 0,
            ban=p.get("bathrooms") or 0,
            medios=p.get("half_bathrooms") or 0,
            est=p.get("parking_spaces") or 0,
            m2c=p.get("construction_size") or 0,
            m2t=p.get("lot_size") or 0,
            antig=p.get("age") if isinstance(p.get("age"), int) else 0,
            piso=p.get("floor") or "",
            niveles=p.get("floors") or 0,
            estado_inm="excelente",
            amenidades=match_amenidades(p.get("features")),
            badges=["exclusiva"] if p.get("exclusive") else [],
            destacada=bool(p.get("exclusive")),
            exclusiva=bool(p.get("exclusive")),
            publicado=(p.get("published_at") or "")[:10],
            actualizado=(p.get("updated_at") or "")[:10],
            descripcion=p.get("description") or "",
            estado="disponible",
            fotos_real=fotos,
            _slug=slug,
            _colonia_exacta=exact,
        ))
        print(f"  ✓ {public_id} — {titulo[:60]}")

    FIX_TIPO_TERRENO = {"EB-RI6822", "EB-VQ9738"}
    for p in props:
        if p["id"] in FIX_TIPO_TERRENO:
            p["tipo"] = "terreno"

    fuera = [p for p in props if p.get("fuera_cdmx")]
    if fuera:
        print(f"\n{len(fuera)} propiedades fuera de CDMX se publican con su ubicación real:")
        for p in fuera:
            print(f"  - {p['id']}: {p['colonia_nombre_real']}, {p['alcaldia_real']}, {p['estado_real']}")

    write_data_props_live(props)

    print(f"\n{len(props)} propiedades sincronizadas.")
    if warnings:
        print(f"\n⚠ {len(warnings)} avisos que conviene revisar antes de publicar:")
        for w in warnings:
            print(f"  - {w}")
    else:
        print("\nSin avisos — todo se mapeó automáticamente.")
    print("\nSiguiente paso: revisa data_props_live.py, luego cambia el import en")
    print("prep.py de `from data_props import ...` a `from data_props_live import ...`")
    print("y corre: python3 build.py")


def write_data_props_live(props):
    lines = [
        "# -*- coding: utf-8 -*-",
        '"""Gio Filio — Inventario real, sincronizado desde EasyBroker.',
        "",
        "Generado por sync_easybroker.py — no editar a mano, se sobreescribe",
        'en cada sincronización."""',
        "",
        "from data_props import TIPOS, TIPO_LABEL, TIPO_PLURAL, AMENIDADES, AMENIDAD_LABEL, ESTADOS_INMUEBLE",
        "",
        "DATASET_ES_DEMO = False",
        "",
        "PROPIEDADES = [",
    ]
    for p in props:
        clean = {k: v for k, v in p.items() if not k.startswith("_")}
        lines.append("    " + repr(clean) + ",")
    lines.append("]")
    with open("data_props_live.py", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
