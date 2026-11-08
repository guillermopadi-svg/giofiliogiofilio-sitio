"""Publish inventory only, preserving editorial pages and operational APIs."""
import os, hashlib, json, re
from pathlib import Path
from xml.sax.saxutils import escape
ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT / '_generador')
os.environ['GIO_INVENTORY_ONLY'] = '1'
import prep
prep.PROPIEDADES = [p for p in prep.PROPIEDADES if p['id'] != 'GF-bae806c9']
if not prep.PROPIEDADES or prep.DATASET_ES_DEMO:
    raise RuntimeError('Refusing to publish empty/demo inventory')
if any(not p.get('fotos_real') for p in prep.PROPIEDADES):
    raise RuntimeError('Every property must have actual photos')
protected = {p: hashlib.sha256(p.read_bytes()).hexdigest()
             for folder in ('blog', 'admin', 'alta-propiedad', 'api')
             for p in (ROOT / folder).rglob('*') if p.is_file()}
for name in ('sitemap-blog.xml', 'robots.txt', 'llms.txt'):
    p = ROOT / name
    protected[p] = hashlib.sha256(p.read_bytes()).hexdigest()
import build
for prop in build.PROPS_ALL: build.build_property(prop)
by_id = {p['id']: p for p in build.PROPS_ALL + build.LANDING_PROPS}
card = re.compile(r'<article\b[^>]*\bclass="pcard[^" ]*"[^>]*\bdata-id="([^"]+)"[^>]*>.*?</article>', re.S)
for folder in ('venta', 'renta', 'propiedades', 'zonas'):
    for page in (ROOT / folder).rglob('index.html'):
        relative = page.relative_to(ROOT).as_posix()
        if relative in build.LANDING_PATHS: continue
        original = page.read_text()
        updated = card.sub(lambda m: build.pcard(relative, by_id[m[1]]) if m[1] in by_id else '', original)
        if updated != original: page.write_text(updated)
home = ROOT / 'index.html'
s = home.read_text()
s = card.sub(lambda m: build.pcard('index.html', by_id[m[1]]) if m[1] in by_id else '', s)
home.write_text(s)
urls = [build.canonical(p['url_file']) for p in build.PROPS_ALL]
urls += [build.canonical(p) for p in build.LANDING_PATHS]
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sitemap += ''.join('<url><loc>' + escape(url) + '</loc></url>\n' for url in sorted(set(urls))) + '</urlset>\n'
(ROOT / 'sitemap-propiedades.xml').write_text(sitemap)
fingerprint = hashlib.sha256((ROOT / 'assets/data/gio-data.js').read_bytes()).hexdigest()[:12]
for page in ROOT.rglob('*.html'):
    if page in protected or '_generador' in page.parts or page.relative_to(ROOT).as_posix() in build.LANDING_PATHS: continue
    s = page.read_text()
    updated = re.sub(r'(assets/data/gio-data\.js)(?:\?v=[^"\s]+)?', r'\1?v=' + fingerprint, s)
    if s != updated: page.write_text(updated)
for p, digest in protected.items():
    if hashlib.sha256(p.read_bytes()).hexdigest() != digest:
        raise RuntimeError('Protected content changed: ' + str(p))
catalog = json.loads((ROOT / 'assets/data/propiedades.json').read_text())
ids = [p['id'] for p in catalog['propiedades']]
assert len(ids) == len(set(ids)) == catalog['meta']['total']
missing = []
for p in catalog['propiedades']:
    if not (ROOT / p['url'] / 'index.html').is_file(): missing.append(p['url'])
    image = p['foto_card']
    if not image.startswith('https://') and not (ROOT / image).is_file(): missing.append(image)
if missing: raise RuntimeError('Missing inventory assets: ' + ', '.join(missing))
print(f'Inventory validated: {len(ids)} properties; {len(protected)} editorial/operational files preserved')
