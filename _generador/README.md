# Generador del sitio

Scripts que producen `giofilio-sitio/`. Requieren Python 3.10+ y Pillow.

```bash
pip install pillow
python3 build.py     # genera las 135 páginas
python3 audit.py     # auditoría de calidad (0 errores esperados)
python3 shots.py     # pruebas E2E + capturas (requiere playwright)
```

- `data_zonas.py`   — 16 alcaldías y 19 colonias con contenido editorial
- `data_props.py`   — 36 propiedades DEMO, todas en CDMX
- `data_content.py` — blog, testimonios, proceso de asesoría, FAQs
- `render.py`       — layout, header, footer, metadata, schema.org, iconos
- `parts.py`        — filtros, bloque de resultados, formularios, tarjeta de Gio
- `prep.py`         — pipeline de imágenes, normalización, dataset JS/JSON
- `build.py`        — definición de rutas y páginas
- `audit.py`        — enlaces, imágenes, exclusividad CDMX, SEO, accesibilidad
- `shots.py`        — pruebas funcionales de extremo a extremo

Las fotografías de origen (`raw/unsplash/`) no se incluyen; `build.py` las
regenera solo si están presentes. Los assets ya procesados viven en
`../assets/img/`.
