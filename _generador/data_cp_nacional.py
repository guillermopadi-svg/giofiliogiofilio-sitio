# -*- coding: utf-8 -*-
"""Gio Filio — CP -> colonia/municipio/estado de TODO México (fuente: SEPOMEX/
Correos de México, Catálogo Nacional de Códigos Postales, ~159 mil renglones).

Alimenta exclusivamente `assets/data/cp-colonias.js` (window.GF_CP_COLONIAS),
que usa el formulario público /alta-propiedad/ (assets/js/alta.js) para
sugerir colonia+alcaldía/municipio en cuanto el propietario escribe su CP.
Antes ese catálogo solo cubria Ciudad de México (armado a mano desde
data_colonias_todas.py) -- un propietario en Cuernavaca, Tulum, etc. no
recibia ninguna sugerencia y tenia que escribir todo a mano (el formulario
ya degradaba bien a texto libre, pero sin ayuda).

A proposito NO toca data_colonias_todas.py / colonias.json / el <select> de
colonia del panel de asesores (admin/index.html #f_colonia): ese catalogo
sigue siendo solo CDMX porque esta ligado al ruteo real del sitio
(propiedades/{colonia_slug}/) -- meter aqui las ~150 mil colonias del pais
en un <select> con <optgroup> lo haria enorme y lento sin necesidad, y una
propiedad fuera de CDMX ya tiene sus propios campos de texto libre
(colonia_nombre_real/alcaldia_real/estado_real) para ese caso.

Regenerar tras una actualizacion del catalogo de SEPOMEX
(https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx,
Estado="Todos", Formato=TXT -> descomprimir, quitar las primeras 2 lineas
--aviso legal y encabezado-- y guardar como _generador/raw/sepomex_nacional.csv):

    python3 data_cp_nacional.py
"""
import json
import os
from collections import defaultdict

_RAW = os.path.join(os.path.dirname(__file__), "raw", "sepomex_nacional.csv")
_OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "data", "cp-colonias.js")


def construir():
    # cp -> lista de (colonia, municipio, estado), sin duplicados exactos --
    # un mismo CP puede repetir la colonia si SEPOMEX trae mas de un tipo de
    # asentamiento (Colonia/Fraccionamiento/Unidad...) con el mismo nombre.
    por_cp = defaultdict(list)
    vistos = defaultdict(set)
    with open(_RAW, encoding="utf-8") as f:
        for linea in f:
            partes = linea.rstrip("\n").split("|")
            if len(partes) < 5:
                continue
            cp, colonia, _tipo, municipio, estado = partes[0], partes[1].strip(), partes[2], partes[3].strip(), partes[4].strip()
            if not cp or not colonia:
                continue
            clave = (colonia, municipio, estado)
            if clave in vistos[cp]:
                continue
            vistos[cp].add(clave)
            por_cp[cp].append(clave)
    return por_cp


def emitir(por_cp):
    # Mismo shape que ya consumia alta.js ({colonia, alcaldia}) -- "alcaldia"
    # se rellena con el municipio real fuera de CDMX (Cuernavaca, Tulum...);
    # el campo del formulario se llama "Alcaldía" pero acepta el texto tal
    # cual, y ya no es una etiqueta exclusiva de CDMX en la practica. Se
    # agrega "estado" (nuevo) para poder distinguir dos municipios
    # homonimos de estados distintos si hace falta mas adelante.
    data = {
        cp: [{"colonia": colonia, "alcaldia": municipio, "estado": estado} for colonia, municipio, estado in entradas]
        for cp, entradas in sorted(por_cp.items())
    }
    contenido = (
        "/* Generado desde _generador/data_cp_nacional.py (fuente: Catalogo "
        "Nacional de Codigos Postales, SEPOMEX) -- CP -> [{colonia, alcaldia, estado}], "
        "todo el pais. No editar a mano. */\n"
        "window.GF_CP_COLONIAS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    with open(_OUT, "w", encoding="utf-8") as f:
        f.write(contenido)
    return len(data)


if __name__ == "__main__":
    mapa = construir()
    total_cps = emitir(mapa)
    print(f"cp-colonias.js: {total_cps} códigos postales, {sum(len(v) for v in mapa.values())} colonias (todo México).")
