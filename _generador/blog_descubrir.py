# -*- coding: utf-8 -*-
"""Descubre los artículos del blog que ya existen como página en blog/<slug>/.

Los publica el workflow de n8n (página ya construida, con su propia imagen). El
generador no los reconstruye, pero sí debe listarlos en el índice, el Home, las
categorías y el sitemap; si no, desaparecen en cuanto se regenera el sitio.

Lee de cada página: título, resumen, categoría, minutos de lectura, fecha e imagen.
Una página sin esos datos se omite y se avisa por consola (no rompe el build).
"""
import html as _html
import os
import re


def _first(pat, text, flags=0):
    m = re.search(pat, text, flags)
    return _html.unescape(m.group(1).strip()) if m else ""


def descubrir(blog_dir, slugs_conocidos):
    """Devuelve dicts compatibles con BLOG_EXTRA para cada slug no registrado."""
    out = []
    if not os.path.isdir(blog_dir):
        return out
    for slug in sorted(os.listdir(blog_dir)):
        if slug in slugs_conocidos or slug == "categoria":
            continue
        ruta = os.path.join(blog_dir, slug, "index.html")
        if not os.path.isfile(ruta):
            continue
        with open(ruta, encoding="utf-8") as f:
            h = f.read()
        titulo = _first(r'<h1[^>]*>(.*?)</h1>', h, re.S)
        resumen = _first(r'<meta name="description" content="([^"]*)"', h)
        categoria = _first(r'<span class="cat">(.*?)</span>', h)
        lectura = _first(r'(\d+)\s*min', _first(r'<div class="post-meta"[^>]*>(.*?)</div>', h, re.S))
        fecha = (_first(r'"datePublished":"(\d{4}-\d{2}-\d{2})"', h)
                 or _first(r'<span>(\d{4}-\d{2}-\d{2})</span>', h))
        imagen = _first(r'<meta property="og:image" content="([^"]*)"', h)
        if not (titulo and resumen and categoria and fecha):
            print(f"   ! blog/{slug}: faltan datos (título/resumen/categoría/fecha); se omite del índice")
            continue
        out.append(dict(slug=slug, categoria=categoria, titulo=titulo, resumen=resumen,
                        lectura=int(lectura or 3), fecha=fecha, card_img=imagen))
    return out
