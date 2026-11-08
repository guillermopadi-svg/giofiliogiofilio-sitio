from pathlib import Path
import json,re,html
def apply_real_zone_photos(page):
    records=json.loads(Path(__file__).with_name('zone_photos.json').read_text())
    credits=[]
    for r in records:
        slug=r['slug']
        page=page.replace('../assets/img/zonas/'+slug+'-card.jpg','../'+r['file'])
        author=html.escape(re.sub('<[^>]+>', '',r['artist']))
        credits.append('<li><a href="'+html.escape(r['source'],quote=True)+'" target="_blank" rel="noopener">'+html.escape(slug.replace('-',' ').title())+'</a> — '+author+' · '+html.escape(r['license'])+'</li>')
    return page
