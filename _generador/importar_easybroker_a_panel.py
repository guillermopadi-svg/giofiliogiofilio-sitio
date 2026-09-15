# -*- coding: utf-8 -*-
"""Importa/actualiza en `propiedades_manual` (Supabase) el inventario que
sync_easybroker.py acaba de escribir en data_props_live.py -- asi cualquier
asesor puede verlo y editarlo desde /admin/, no solo en el sitio publico.

Regla de bloqueo: si un asesor ya edito una ficha desde el panel
(bloqueado_por_panel = true), esta sincronizacion la deja tal cual -- nunca
pisa un cambio hecho a mano. Solo refresca las que nadie ha tocado, y crea
las que todavia no existen.

Se corre DESPUES de sync_easybroker.py, en el mismo working directory
(_generador/), para poder importar data_props_live.py directamente.

Requiere las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
(las mismas que ya usa fetch_manual_props.py).

Uso:
    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="..."
    python3 sync_easybroker.py
    python3 importar_easybroker_a_panel.py
"""
import os, sys, json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def sb(method, path, body=None):
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, method=method, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else []
    except HTTPError as e:
        body_txt = e.read().decode("utf-8", "ignore")
        sys.exit(f"Supabase respondió {e.code} en {method} {path}: {body_txt[:300]}")


def _entero(v):
    """sync_easybroker.py guarda algunos numeros como float (ej. 535.0 m2 de
    construccion, tal como los da la API de EasyBroker) -- Postgres rechaza
    ese texto para una columna `int` ("invalid input syntax for type
    integer: \"535.0\""), aunque el valor sea un entero exacto. Se redondea
    y castea aqui para que siempre llegue un entero limpio."""
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def campos_desde_eb(p):
    """Mapea el dict de data_props_live.py (mismas llaves que arma
    sync_easybroker.py) a las columnas de propiedades_manual."""
    return dict(
        titulo=p.get("titulo") or "",
        operacion=p.get("operacion") or "venta",
        tipo=p.get("tipo") or "departamento",
        precio=p.get("precio") or 0,
        colonia_slug=p.get("colonia") or "",
        rec=_entero(p.get("rec")),
        ban=_entero(p.get("ban")),
        medios=_entero(p.get("medios")),
        est=_entero(p.get("est")),
        m2c=_entero(p.get("m2c")),
        m2t=_entero(p.get("m2t")),
        descripcion=p.get("descripcion") or "",
        amenidades=p.get("amenidades") or [],
        fotos=[f["card"] for f in (p.get("fotos_real") or []) if f.get("card")],
        destacada=bool(p.get("destacada")),
        estado="disponible",
        moneda=p.get("moneda") or "MXN",
        calle=p.get("calle") or "",
        cp=p.get("cp") or "",
        lat=p.get("lat"),
        lng=p.get("lng"),
        antig=_entero(p.get("antig")),
        piso=p.get("piso") or "",
        niveles=_entero(p.get("niveles")),
        badges=p.get("badges") or [],
    )


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Supabase no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vacíos) — se omite la importación al panel.")
        return

    from data_props_live import PROPIEDADES

    admin_rows = sb("GET", "/rest/v1/perfiles?rol=eq.admin&select=id&limit=1")
    if not admin_rows:
        print("⚠ No hay ningún perfil con rol='admin' todavía — no se puede importar (se necesita un asesor_id valido). Se omite.")
        return
    admin_id = admin_rows[0]["id"]

    creadas, actualizadas, bloqueadas = 0, 0, 0
    for p in PROPIEDADES:
        eb_id = p["id"]
        existentes = sb("GET", f"/rest/v1/propiedades_manual?easybroker_id=eq.{eb_id}&select=id,bloqueado_por_panel")
        campos = campos_desde_eb(p)

        if not existentes:
            campos.update(easybroker_id=eb_id, asesor_id=admin_id, bloqueado_por_panel=False)
            sb("POST", "/rest/v1/propiedades_manual", campos)
            creadas += 1
            continue

        fila = existentes[0]
        if fila.get("bloqueado_por_panel"):
            bloqueadas += 1
            continue

        sb("PATCH", f"/rest/v1/propiedades_manual?id=eq.{fila['id']}", campos)
        actualizadas += 1

    print(f"Panel: {creadas} propiedad(es) nueva(s) importada(s), {actualizadas} actualizada(s), {bloqueadas} respetada(s) por edición manual.")


if __name__ == "__main__":
    main()
