# -*- coding: utf-8 -*-
"""Gio Filio — Normalización del dataset + pipeline de imágenes + data JS."""
import os, json, random, hashlib
from data_zonas import ALCALDIAS, COLONIAS, COLONIA_BY_SLUG, ALCALDIA_SLUG_BY_NOMBRE, MARCA
from data_props import (PROPIEDADES, TIPOS, TIPO_LABEL, TIPO_PLURAL, AMENIDADES,
                        AMENIDAD_LABEL, ESTADOS_INMUEBLE, P_SALA, P_COCINA, P_RECAMARA,
                        P_BANO, P_EXT, P_DET, P_CIUDAD)
from render import slugify

OUT = "giofilio-sitio"
IMG_PROP = "assets/img/properties"
IMG_ZONA = "assets/img/zonas"
IMG_BLOG = "assets/img/blog"

random.seed(20260816)

# ------------------------------------------------------------------ IMÁGENES
def build_images(pool_ids, raw_dir="raw/unsplash"):
    """Genera derivados responsive (jpg + webp) del pool de fotografías."""
    from PIL import Image
    sizes = {"card": 720, "hero": 1440, "thumb": 380}
    os.makedirs(os.path.join(OUT, IMG_PROP), exist_ok=True)
    made = {}
    for i, pid in enumerate(pool_ids):
        src = os.path.join(raw_dir, pid + ".jpg")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGB")
        made[i] = {}
        for key, w in sizes.items():
            ratio = w / im.size[0]
            if ratio > 1:
                ratio = 1
            tgt = im.resize((int(im.size[0] * ratio), int(im.size[1] * ratio)), Image.LANCZOS)
            # recorte 4:3 para tarjetas y miniaturas
            if key in ("card", "thumb"):
                tw, th = tgt.size
                want = tw * 3 / 4
                if th > want:
                    top = int((th - want) * 0.42)
                    tgt = tgt.crop((0, top, tw, top + int(want)))
            base = f"{IMG_PROP}/foto-{i:02d}-{key}"
            tgt.save(os.path.join(OUT, base + ".jpg"), quality=82, optimize=True, progressive=True)
            tgt.save(os.path.join(OUT, base + ".webp"), quality=78, method=6)
            made[i][key] = base
    return made


def build_zone_images(mapping, raw_dir="raw/unsplash", pool_ids=None):
    """mapping: {slug: pool_index}"""
    from PIL import Image
    os.makedirs(os.path.join(OUT, IMG_ZONA), exist_ok=True)
    out = {}
    for slug, idx in mapping.items():
        pid = pool_ids[idx]
        src = os.path.join(raw_dir, pid + ".jpg")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGB")
        for key, w, ar in (("hero", 1600, 16 / 9), ("card", 640, 3 / 4)):
            ratio = min(w / im.size[0], 1)
            tgt = im.resize((int(im.size[0] * ratio), int(im.size[1] * ratio)), Image.LANCZOS)
            tw, th = tgt.size
            want_h = tw / ar
            if th > want_h:
                top = int((th - want_h) * 0.4)
                tgt = tgt.crop((0, top, tw, top + int(want_h)))
            else:
                want_w = th * ar
                left = int((tw - want_w) * 0.5)
                tgt = tgt.crop((left, 0, left + int(want_w), th))
            base = f"{IMG_ZONA}/{slug}-{key}"
            tgt.save(os.path.join(OUT, base + ".jpg"), quality=82, optimize=True, progressive=True)
            tgt.save(os.path.join(OUT, base + ".webp"), quality=78, method=6)
        out[slug] = f"{IMG_ZONA}/{slug}"
    return out


def build_blog_images(mapping, raw_dir="raw/unsplash", pool_ids=None):
    from PIL import Image
    os.makedirs(os.path.join(OUT, IMG_BLOG), exist_ok=True)
    out = {}
    for slug, idx in mapping.items():
        pid = pool_ids[idx]
        src = os.path.join(raw_dir, pid + ".jpg")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGB")
        for key, w, ar in (("hero", 1400, 16 / 8), ("card", 640, 16 / 10)):
            ratio = min(w / im.size[0], 1)
            tgt = im.resize((int(im.size[0] * ratio), int(im.size[1] * ratio)), Image.LANCZOS)
            tw, th = tgt.size
            want_h = tw / ar
            if th > want_h:
                top = int((th - want_h) * 0.38)
                tgt = tgt.crop((0, top, tw, top + int(want_h)))
            base = f"{IMG_BLOG}/{slug}-{key}"
            tgt.save(os.path.join(OUT, base + ".jpg"), quality=82, optimize=True, progressive=True)
            tgt.save(os.path.join(OUT, base + ".webp"), quality=78, method=6)
        out[slug] = f"{IMG_BLOG}/{slug}"
    return out


# ------------------------------------------------------- NORMALIZAR PROPIEDADES
def pick(pool, seed, k=1):
    r = random.Random(seed)
    return r.sample(pool, min(k, len(pool)))


def normalize(images):
    props = []
    for n, raw in enumerate(PROPIEDADES):
        p = dict(raw)
        col = COLONIA_BY_SLUG[p["colonia"]]
        p["colonia_slug"] = col["slug"]
        p["colonia_nombre"] = col["nombre"]
        p["alcaldia_nombre"] = col["alcaldia"]
        p["alcaldia"] = ALCALDIA_SLUG_BY_NOMBRE[col["alcaldia"]]
        p["cp"] = col["cp"][n % len(col["cp"])]
        p["tipo_label"] = TIPO_LABEL[p["tipo"]]

        # coordenadas con dispersión determinista alrededor del centro de la colonia
        h = int(hashlib.md5(p["id"].encode()).hexdigest()[:8], 16)
        p["lat"] = round(col["lat"] + ((h % 1000) / 1000 - 0.5) * 0.016, 6)
        p["lng"] = round(col["lng"] + (((h >> 10) % 1000) / 1000 - 0.5) * 0.020, 6)

        # slug y URL amigable
        base = slugify(f'{p["tipo_label"]} {p["colonia_nombre"]} {p["titulo"].split(" con ")[-1] if " con " in p["titulo"] else ""}')
        base = "-".join(dict.fromkeys(base.split("-")))
        p["slug"] = f'{base}-{p["id"].lower().replace("-", "")}'
        p["url"] = f'propiedad/{p["slug"]}/'
        p["url_file"] = f'propiedad/{p["slug"]}/index.html'

        # fotografías
        es_casa = p["tipo"] in ("casa", "casa-en-condominio")
        es_terreno = p["tipo"] == "terreno"
        es_comercial = p["tipo"] in ("oficina", "local-comercial")
        seed = p["id"]
        if es_terreno:
            gal = pick(P_EXT, seed + "a", 3) + pick(P_DET, seed + "b", 1) + pick(P_SALA, seed + "c", 2)
        elif es_casa:
            gal = pick(P_EXT, seed + "a", 2) + pick(P_SALA, seed + "b", 2) + pick(P_COCINA, seed + "c", 1) + \
                  pick(P_RECAMARA, seed + "d", 1) + pick(P_BANO, seed + "e", 1) + pick(P_DET, seed + "f", 1)
        elif es_comercial:
            gal = pick(P_SALA, seed + "a", 4) + pick(P_DET, seed + "b", 1) + pick(P_BANO, seed + "c", 1)
        else:
            gal = pick(P_SALA, seed + "a", 3) + pick(P_COCINA, seed + "b", 1) + \
                  pick(P_RECAMARA, seed + "c", 1) + pick(P_BANO, seed + "d", 1) + pick(P_DET, seed + "e", 1)
        gal = [g for g in dict.fromkeys(gal) if g in images]
        p["fotos_idx"] = gal
        p["fotos"] = [images[i]["hero"] + ".jpg" for i in gal]
        p["fotos_webp"] = [images[i]["hero"] + ".webp" for i in gal]
        p["fotos_thumb"] = [images[i]["thumb"] + ".jpg" for i in gal]
        p["foto_card"] = images[gal[0]]["card"] + ".jpg"
        p["foto_card_webp"] = images[gal[0]]["card"] + ".webp"

        # texto para WhatsApp
        art = "el" if p["tipo"] in ("departamento", "penthouse", "loft", "terreno", "desarrollo", "local-comercial") else "la"
        p["titulo_wa"] = f'{art} {p["tipo_label"].lower()} en {p["colonia_nombre"]}'

        # badges derivados
        badges = list(p.get("badges", []))
        if p.get("exclusiva") and "exclusiva" not in badges:
            badges.append("exclusiva")
        p["badges"] = badges

        # fechas
        dias = 3 + (h % 220)
        from datetime import date, timedelta
        pub = date(2026, 8, 16) - timedelta(days=dias)
        upd = date(2026, 8, 16) - timedelta(days=max(1, dias // 6))
        p["publicado"] = pub.isoformat()
        p["actualizado"] = upd.isoformat()
        p["estado"] = "disponible"

        # métricas
        m = p["m2c"] or p["m2t"] or 0
        p["precio_m2"] = round(p["precio"] / m) if m else 0
        p["m2_ref"] = m

        # características derivadas (no amenidades)
        car = []
        if p["piso"]:
            car.append(f'Piso {p["piso"]}')
        if p["niveles"]:
            car.append(f'{p["niveles"]} niveles en el inmueble' if p["tipo"] not in ("casa", "casa-en-condominio") else f'{p["niveles"]} niveles')
        car.append("Nueva construcción" if p["antig"] == 0 else f'{p["antig"]} años de antigüedad')
        car.append(dict(ESTADOS_INMUEBLE)[p["estado_inm"]])
        if p["medios"]:
            car.append(f'{p["medios"]} medio baño' + ("s" if p["medios"] > 1 else ""))
        if p["m2t"]:
            car.append(f'{p["m2t"]:,} m² de terreno'.replace(",", ","))
        p["caracteristicas"] = car
        props.append(p)
    return props


# --------------------------------------------------------------- DATA PARA JS
def emit_data_js(props, colonias, alcaldias, path="giofilio-sitio/assets/data/gio-data.js"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    slim = []
    for p in props:
        slim.append({
            "id": p["id"], "titulo": p["titulo"], "titulo_wa": p["titulo_wa"], "url": p["url"],
            "operacion": p["operacion"], "tipo": p["tipo"], "tipo_label": p["tipo_label"],
            "precio": p["precio"], "mantenimiento": p["mantenimiento"],
            "colonia": p["colonia_slug"], "colonia_nombre": p["colonia_nombre"],
            "alcaldia": p["alcaldia"], "alcaldia_nombre": p["alcaldia_nombre"],
            "calle": p["calle"], "cp": p["cp"], "lat": p["lat"], "lng": p["lng"],
            "rec": p["rec"], "ban": p["ban"], "medios": p["medios"], "est": p["est"],
            "m2c": p["m2c"], "m2t": p["m2t"], "antig": p["antig"], "piso": p["piso"],
            "estado_inm": p["estado_inm"], "amenidades": p["amenidades"],
            "badges": p["badges"], "destacada": bool(p.get("destacada")), "exclusiva": bool(p.get("exclusiva")),
            "publicado": p["publicado"], "actualizado": p["actualizado"],
            "foto_card": p["foto_card"], "precio_m2": p["precio_m2"], "estado": p["estado"],
        })
    calles = sorted({(p["calle"], p["colonia_nombre"]) for p in props})
    data = {
        "meta": {"demo": True, "ciudad": "Ciudad de México", "generado": "2026-08-16", "total": len(slim)},
        "propiedades": slim,
        "colonias": [
            {"slug": c["slug"], "nombre": c["nombre"], "alcaldia": c["alcaldia"],
             "alcaldia_slug": ALCALDIA_SLUG_BY_NOMBRE[c["alcaldia"]], "cp": c["cp"],
             "lat": c["lat"], "lng": c["lng"],
             "precio_m2_venta": c["precio_m2_venta"], "precio_m2_renta": c["precio_m2_renta"]}
            for c in colonias
        ],
        "alcaldias": [{"slug": a["slug"], "nombre": a["nombre"], "lat": a["lat"], "lng": a["lng"]} for a in alcaldias],
        "calles": [{"calle": c[0], "colonia": c[1]} for c in calles],
        "desarrollos": [{"id": p["id"], "nombre": p["titulo"]} for p in props if p["tipo"] == "desarrollo"],
        "tipos_label": TIPO_LABEL,
        "tipos_plural": TIPO_PLURAL,
        "amenidades_label": AMENIDAD_LABEL,
        "estados_label": dict(ESTADOS_INMUEBLE),
    }
    js = ("/* Gio Filio — dataset DEMO generado automáticamente. No editar a mano.\n"
          "   Fuente: _build/data_props.py + data_zonas.py  ·  Todas las propiedades son ficticias. */\n"
          "window.GF_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write(js)
    # copia JSON legible para integraciones / import a base de datos
    with open("giofilio-sitio/assets/data/propiedades.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def emit_config_js(path="giofilio-sitio/assets/js/config.js"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f'''/* ==========================================================================
   Gio Filio — Configuración del sitio
   Edita este archivo para conectar servicios externos. No requiere build.
   ========================================================================== */
window.GF_CONFIG = {{

  /* --- Google Maps -------------------------------------------------------
     Pega aquí tu API key para activar el mapa real (Maps JavaScript API).
     Mientras esté vacío, el sitio usa un mapa esquemático de respaldo que
     muestra todos los pines con precio, sin costo ni dependencias.
     Consola: https://console.cloud.google.com/google/maps-apis            */
  googleMapsKey: "",

  /* --- WhatsApp ---------------------------------------------------------- */
  whatsapp: "{MARCA["whatsapp"]}",

  /* --- Analítica ---------------------------------------------------------
     Al declarar estos IDs, agrega los snippets de GTM/GA4 en el <head>.
     Todos los eventos ya se envían a window.dataLayer.                      */
  gtmId: "",          // ej. "GTM-XXXXXXX"
  ga4Id: "",          // ej. "G-XXXXXXXXXX"
  metaPixelId: "",    // ej. "1234567890"
  googleAdsId: "",    // ej. "AW-XXXXXXXXX"

  /* --- CRM ---------------------------------------------------------------
     Define window.gfSendToCRM(lead) para enviar cada lead a HubSpot u otro
     sistema. Ejemplo en README.md § Integración con CRM.                    */
  crmEndpoint: "",

  debug: false
}};
''')
