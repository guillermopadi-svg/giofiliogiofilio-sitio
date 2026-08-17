# -*- coding: utf-8 -*-
"""Gio Filio — Auditoría del sitio generado.
Verifica: enlaces internos, imágenes, exclusividad CDMX, placeholders, accesibilidad básica."""
import os, re, sys, json
from urllib.parse import urlparse, unquote

ROOT = "giofilio-sitio"
errors, warns = [], []

HTMLS = []
for dp, dn, fn in os.walk(ROOT):
    for f in fn:
        if f.endswith(".html"):
            HTMLS.append(os.path.join(dp, f))
HTMLS.sort()

# ------------------------------------------------- ubicaciones prohibidas
FUERA_CDMX = [
    "Interlomas", "Estado de México", "Edomex", "Naucalpan", "Huixquilucan",
    "Atizapán", "Tlalnepantla", "Satélite", "Ciudad Satélite", "Metepec",
    "Toluca", "Cuernavaca", "Monterrey", "Guadalajara", "Querétaro",
    "Puebla", "Cancún", "Tulum", "Mérida", "Playa del Carmen", "Valle de Bravo",
    "San Pedro Garza", "Zapopan", "Tijuana", "León, Guanajuato", "Los Cabos",
    "Bosque Real", "Lomas Verdes", "Ciudad Brisa", "Coacalco", "Ecatepec",
    "Nezahualcóyotl", "Chalco", "Texcoco", "Ixtapaluca", "Cuautitlán",
]
# 16 alcaldías oficiales (referencia)
ALCALDIAS_OK = {"Álvaro Obregón","Azcapotzalco","Benito Juárez","Coyoacán",
 "Cuajimalpa de Morelos","Cuauhtémoc","Gustavo A. Madero","Iztacalco","Iztapalapa",
 "La Magdalena Contreras","Miguel Hidalgo","Milpa Alta","Tláhuac","Tlalpan",
 "Venustiano Carranza","Xochimilco"}

PLACEHOLDERS = ["lorem ipsum", "Lorem Ipsum", "TODO:", "FIXME", "XXXXX", "XXXX-",
                "placeholder text", "texto de ejemplo", "[object Object]",
                ">undefined<", ">NaN<", ">None<", "None</", "{{", "Coming soon"]

# --------------------------------------------------------------- checks
link_re = re.compile(r'(?:href|src|srcset)="([^"]+)"')
def check_file(path):
    rel_dir = os.path.dirname(path)
    with open(path, encoding="utf-8") as f:
        html = f.read()
    page = os.path.relpath(path, ROOT)

    # 1. enlaces / recursos internos
    for m in link_re.finditer(html):
        raw = m.group(1)
        for candidate in [x.strip().split(" ")[0] for x in raw.split(",")]:
            if not candidate: continue
            if candidate.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:", "javascript:")):
                continue
            target = candidate.split("?")[0].split("#")[0]
            if not target: continue
            full = os.path.normpath(os.path.join(rel_dir, unquote(target)))
            if os.path.isdir(full):
                full = os.path.join(full, "index.html")
            if target.endswith("/"):
                full = os.path.normpath(os.path.join(rel_dir, unquote(target), "index.html"))
            if not os.path.exists(full):
                errors.append(f"[404] {page} → {candidate}  (esperado: {full})")

    # 2. ubicaciones fuera de CDMX
    for bad in FUERA_CDMX:
        if re.search(r"\b" + re.escape(bad), html):
            # Excepción: menciones explicativas en términos/blog que aclaran exclusión
            ctx = html[max(0, html.find(bad) - 120): html.find(bad) + 120]
            if "no se publican" in ctx.lower() or "no incluir" in ctx.lower() or "otras entidades" in ctx.lower():
                continue
            errors.append(f"[FUERA-CDMX] {page}: menciona «{bad}»")

    # 3. placeholders
    for ph in PLACEHOLDERS:
        if ph in html:
            errors.append(f"[PLACEHOLDER] {page}: contiene «{ph}»")

    # 4. accesibilidad básica
    for img in re.finditer(r"<img\b[^>]*>", html):
        tag = img.group(0)
        if "alt=" not in tag:
            errors.append(f"[A11Y] {page}: <img> sin alt → {tag[:90]}")
    if "<h1" not in html:
        warns.append(f"[A11Y] {page}: sin <h1>")
    if html.count("<h1") > 1:
        warns.append(f"[A11Y] {page}: {html.count('<h1')} elementos <h1>")
    if 'lang="es-MX"' not in html:
        errors.append(f"[A11Y] {page}: falta lang en <html>")

    # 5. botones/enlaces sin destino real
    for a in re.finditer(r'<a\b[^>]*href="#"[^>]*>', html):
        errors.append(f"[DEAD-LINK] {page}: enlace href=\"#\" → {a.group(0)[:80]}")

    # 6. SEO
    if "<title>" not in html: errors.append(f"[SEO] {page}: sin <title>")
    if 'name="description"' not in html: errors.append(f"[SEO] {page}: sin meta description")
    if 'rel="canonical"' not in html: errors.append(f"[SEO] {page}: sin canonical")
    desc = re.search(r'name="description" content="([^"]*)"', html)
    if desc:
        L = len(desc.group(1))
        if L < 70 or L > 185:
            warns.append(f"[SEO] {page}: description de {L} caracteres")
    t = re.search(r"<title>([^<]*)</title>", html)
    if t and len(t.group(1)) > 75:
        warns.append(f"[SEO] {page}: title de {len(t.group(1))} caracteres")

    # 7. JSON-LD válido
    for s in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            json.loads(s.group(1))
        except Exception as ex:
            errors.append(f"[SCHEMA] {page}: JSON-LD inválido → {ex}")


for h in HTMLS:
    check_file(h)

# ------------------------------------------------ dataset: solo CDMX
sys.path.insert(0, ".")
data = json.load(open("giofilio-sitio/assets/data/propiedades.json", encoding="utf-8"))
for p in data["propiedades"]:
    if p["alcaldia_nombre"] not in ALCALDIAS_OK:
        errors.append(f"[DATA] {p['id']}: alcaldía fuera de CDMX → {p['alcaldia_nombre']}")
    if not (19.0 < p["lat"] < 19.60 and -99.40 < p["lng"] < -98.94):
        errors.append(f"[DATA] {p['id']}: coordenadas fuera del polígono de CDMX → {p['lat']},{p['lng']}")
    for k in ("titulo", "foto_card", "url", "precio", "tipo"):
        if not p.get(k):
            errors.append(f"[DATA] {p['id']}: campo vacío «{k}»")

# ------------------------------------------------ resumen
print("=" * 72)
print(f"Páginas HTML auditadas : {len(HTMLS)}")
print(f"Propiedades en dataset : {len(data['propiedades'])}")
print(f"Errores                : {len(errors)}")
print(f"Advertencias           : {len(warns)}")
print("=" * 72)
if errors:
    print("\nERRORES")
    seen = {}
    for x in errors:
        k = x.split("]")[0] + "]"
        seen.setdefault(k, []).append(x)
    for k, v in seen.items():
        print(f"\n  {k}  ({len(v)})")
        for x in v[:12]:
            print("   ", x)
        if len(v) > 12: print(f"    … y {len(v)-12} más")
if warns:
    print("\nADVERTENCIAS")
    seen = {}
    for x in warns:
        k = x.split("]")[0] + "]"
        seen.setdefault(k, []).append(x)
    for k, v in seen.items():
        print(f"\n  {k}  ({len(v)})")
        for x in v[:8]:
            print("   ", x)
        if len(v) > 8: print(f"    … y {len(v)-8} más")
sys.exit(1 if errors else 0)
