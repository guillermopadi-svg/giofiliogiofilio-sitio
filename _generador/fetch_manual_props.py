# -*- coding: utf-8 -*-
"""Trae las propiedades cargadas a mano por los asesores (panel /admin/,
tabla `propiedades_manual` en Supabase) y genera data_props_manual.py con
el mismo esquema que usa data_props_live.py (EasyBroker), para que build.py
las combine sin distinguir el origen.

Requiere las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
(nunca la anon key aquí — este script necesita saltarse RLS para leer todo).

Uso:
    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="..."
    python3 fetch_manual_props.py
"""
import os, sys, json
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from data_colonias_todas import COLONIA_TODAS_BY_SLUG

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

TIPO_VALIDOS = {
    "departamento", "casa", "casa-en-condominio", "penthouse", "loft",
    "terreno", "oficina", "local-comercial", "desarrollo",
}


def sb_get(path, params=None):
    url = f"{SUPABASE_URL}{path}"
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode(params)
    req = Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        sys.exit(f"Supabase respondió {e.code} en {path}: {body[:300]}")


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        # Todavía no hay proyecto de Supabase conectado — no es un error,
        # el sitio sigue funcionando solo con el inventario de EasyBroker.
        write_data_props_manual([])
        print("Supabase no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vacíos) — "
              "data_props_manual.py se deja vacío.")
        return

    rows = sb_get("/rest/v1/propiedades_manual", {
        "estado": "eq.disponible",
        "select": "*",
    })
    print(f"Supabase: {len(rows)} propiedades disponibles en propiedades_manual.")

    props, warnings = [], []
    for row in rows:
        colonia = COLONIA_TODAS_BY_SLUG.get(row.get("colonia_slug"))
        if not colonia:
            warnings.append(f"{row['id']}: colonia_slug '{row.get('colonia_slug')}' no existe en el catálogo — se omite")
            continue

        tipo = row.get("tipo") if row.get("tipo") in TIPO_VALIDOS else "departamento"
        if row.get("tipo") not in TIPO_VALIDOS:
            warnings.append(f"{row['id']}: tipo '{row.get('tipo')}' desconocido — se usó 'departamento'")

        # Formatos que ningún navegador (fuera de Safari) ni WhatsApp/redes
        # sociales pueden mostrar al compartir el link — el panel ya
        # convierte HEIC a JPG solo (o avisa) antes de subir, pero esto es
        # el respaldo del lado del servidor por si algo se cuela de todas
        # formas (ej. una fila vieja de antes de ese fix).
        FORMATOS_WEB = (".jpg", ".jpeg", ".png", ".webp", ".gif")
        fotos = [u for u in (row.get("fotos") or []) if u.lower().split("?")[0].endswith(FORMATOS_WEB)]
        if not fotos:
            # Sin al menos una foto válida, build.py no tiene de dónde sacar
            # la imagen de portada/galería/schema.org de la ficha — se omite
            # hasta que el asesor suba una en un formato compatible.
            hay_invalidas = bool(row.get("fotos"))
            motivo = "las fotos están en un formato no compatible (¿HEIC?)" if hay_invalidas else "sin fotos"
            warnings.append(f"{row['id']}: {motivo} — se omite hasta que se suba una foto válida (jpg/png/webp)")
            continue
        fotos_real = [{"card": u, "hero": u, "thumb": u} for u in fotos]

        fecha = (row.get("actualizado_en") or row.get("creado_en") or "")[:10] or date.today().isoformat()

        props.append(dict(
            id=f"GF-{row['id'][:8]}",
            titulo=row.get("titulo") or f"Propiedad en {colonia['nombre']}",
            titulo_wa=f"la propiedad en {colonia['nombre']}",
            operacion=row.get("operacion") or "venta",
            tipo=tipo,
            colonia=colonia["slug"],
            colonia_nombre_real=colonia["nombre"],
            alcaldia_real=colonia["alcaldia_nombre"],
            estado_real="",
            sin_pagina=not colonia["tiene_pagina"],
            fuera_cdmx=False,
            precio=row.get("precio") or 0,
            moneda="MXN",
            mantenimiento=0,
            calle="",
            cp="",
            lat=colonia.get("lat"),
            lng=colonia.get("lng"),
            rec=row.get("rec") or 0,
            ban=row.get("ban") or 0,
            medios=row.get("medios") or 0,
            est=row.get("est") or 0,
            m2c=row.get("m2c") or 0,
            m2t=row.get("m2t") or 0,
            antig=0,
            piso="",
            niveles=0,
            estado_inm="excelente",
            amenidades=[a for a in (row.get("amenidades") or [])],
            badges=[],
            destacada=bool(row.get("destacada")),
            exclusiva=True,
            publicado=fecha,
            actualizado=fecha,
            descripcion=row.get("descripcion") or "",
            estado="disponible",
            fotos_real=fotos_real,
        ))

    write_data_props_manual(props)
    print(f"{len(props)} propiedades manuales sincronizadas.")
    if warnings:
        print(f"\n⚠ {len(warnings)} avisos:")
        for w in warnings:
            print(f"  - {w}")


def write_data_props_manual(props):
    lines = [
        "# -*- coding: utf-8 -*-",
        '"""Gio Filio — Propiedades cargadas a mano por asesores (panel /admin/).',
        "",
        "Generado por fetch_manual_props.py desde la tabla `propiedades_manual`",
        'en Supabase — no editar a mano, se sobreescribe en cada sincronización."""',
        "",
        "PROPIEDADES = [",
    ]
    for p in props:
        lines.append("    " + repr(p) + ",")
    lines.append("]")
    with open("data_props_manual.py", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
