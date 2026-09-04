# -*- coding: utf-8 -*-
"""Gio Filio — Catálogo completo y estandarizado de colonias de Ciudad de
México (fuente: SEPOMEX/Correos de México, ~1500 asentamientos), cruzado con
las 19 colonias que ya tienen página propia en data_zonas.COLONIAS.

Existe para que el panel de asesores (/admin/) nunca deje escribir el nombre
de una colonia a mano — todas seleccionan de este mismo catálogo, así nunca
hay "Anáhuac 1" / "Anahuac I" / "anahuac uno" como la misma colonia con tres
nombres distintos. Las que ya tienen página dedicada la usan (mismo slug);
el resto se publica ligada a la página de su alcaldía real (ver
fetch_manual_props.py), igual que ya hace sync_easybroker.py con el
inventario de EasyBroker que cae fuera del catálogo curado.

Se regenera desde _generador/raw/sepomex_cdmx.csv — no editar a mano.
"""
import os, re, unicodedata
from collections import defaultdict

from data_zonas import COLONIAS, ALCALDIA_SLUG_BY_NOMBRE, ALCALDIAS

_RAW = os.path.join(os.path.dirname(__file__), "raw", "sepomex_cdmx.csv")
_ALCALDIA_NOMBRE_BY_SLUG = {a["slug"]: a["nombre"] for a in ALCALDIAS}
_ALCALDIA_LATLNG_BY_SLUG = {a["slug"]: (a["lat"], a["lng"]) for a in ALCALDIAS}


def _slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def _cargar():
    # Las 19 colonias curadas ganan siempre sobre lo que traiga SEPOMEX para
    # sus mismos CPs — varias son nombres coloquiales que SEPOMEX subdivide
    # en secciones oficiales (ej. "Polanco" = I a V Sección, "Narvarte" =
    # Oriente/Poniente/Piedad/Vértiz) y no hay forma de cruzarlas por nombre
    # de forma confiable. Se agregan primero con su propio slug/CP, y esos
    # CPs quedan "reservados" para que SEPOMEX no genere un duplicado.
    catalogo = []
    slugs_usados = set()
    cps_reservados = set()
    for c in COLONIAS:
        catalogo.append(dict(
            slug=c["slug"], nombre=c["nombre"], alcaldia_slug=ALCALDIA_SLUG_BY_NOMBRE[c["alcaldia"]],
            alcaldia_nombre=c["alcaldia"], cp=list(c["cp"]), tiene_pagina=True,
            lat=c["lat"], lng=c["lng"],
        ))
        slugs_usados.add(c["slug"])
        cps_reservados.update(c["cp"])

    # (nombre_colonia, alcaldia_slug) -> set de CPs, para el resto del catálogo
    grupos = defaultdict(set)
    with open(_RAW, encoding="utf-8") as f:
        for linea in f:
            partes = linea.rstrip("\n").split("|")
            if len(partes) < 4:
                continue
            cp, colonia, _tipo, municipio = partes[0], partes[1].strip(), partes[2], partes[3]
            if cp in cps_reservados:
                continue
            alc_slug = ALCALDIA_SLUG_BY_NOMBRE.get(municipio) or ALCALDIA_SLUG_BY_NOMBRE.get(
                municipio.replace("La ", "")
            )
            if not alc_slug or not colonia:
                continue
            grupos[(colonia, alc_slug)].add(cp)

    for (nombre, alc_slug), cps in sorted(grupos.items()):
        slug = _slugify(nombre)
        if slug in slugs_usados:
            slug = f"{slug}-{alc_slug}"
        slugs_usados.add(slug)
        # sin coordenadas propias por colonia en SEPOMEX: se usa el centro
        # de su alcaldía como aproximación razonable para el mapa.
        lat, lng = _ALCALDIA_LATLNG_BY_SLUG.get(alc_slug, (None, None))
        catalogo.append(dict(
            slug=slug, nombre=nombre, alcaldia_slug=alc_slug,
            alcaldia_nombre=_ALCALDIA_NOMBRE_BY_SLUG.get(alc_slug, ""),
            cp=sorted(cps), tiene_pagina=False, lat=lat, lng=lng,
        ))
    return catalogo


COLONIAS_TODAS = _cargar()
COLONIA_TODAS_BY_SLUG = {c["slug"]: c for c in COLONIAS_TODAS}
