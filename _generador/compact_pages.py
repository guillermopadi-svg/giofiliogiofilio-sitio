"""Compact layouts shared by previews and future static builds."""
import re

def sections(html):
    return re.findall(r'<section\b[^>]*>.*?</section>', html, re.S)


def real_home_photos(html):
    photos = '''<div class="hero-media" data-hero-carousel>
      <picture class="is-active"><img src="assets/img/hero/cdmx-reforma-real.jpg" alt="Paseo de la Reforma y el Bosque de Chapultepec, fotografía de ProtoplasmaKid" fetchpriority="high" width="1280" height="960"></picture>
      <picture><img src="assets/img/hero/cdmx-chapultepec-real.jpg" alt="Fotografía de Jonathan Salvador del horizonte de Reforma y Chapultepec" loading="lazy" width="1280" height="720"></picture>
      <picture><img src="assets/img/brand/sidebar-angel-cdmx.webp" alt="Ángel de la Independencia en Paseo de la Reforma, Ciudad de México" loading="lazy" width="1480" height="1480" style="object-position:center top"></picture>

    </div>'''
    html = re.sub(r'<div class="hero-media" data-hero-carousel>.*?</div>', lambda m: photos, html, count=1, flags=re.S)
    if 'class="photo-credits"' not in html:
        credits = '''<details class="photo-credits"><summary>Créditos de las fotografías de portada</summary><p><a href="https://commons.wikimedia.org/wiki/File:Vista_a%C3%A9rea_del_Paseo_de_la_Reforma_desde_el_Castillo_de_Chapultepec.jpg">Reforma desde Chapultepec</a> de ProtoplasmaKid, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. <a href="https://commons.wikimedia.org/wiki/File:Mexico_City_Reforma_skyline.jpg">Mexico City Reforma skyline</a> de Jonathan Salvador, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Imágenes de Wikimedia Commons, ajustadas al encuadre mediante CSS.</p></details>'''
        html = html.replace('</footer>', credits+'</footer>', 1) if '<footer class="site-footer">' not in html else html[:html.index('<footer class="site-footer">')]+html[html.index('<footer class="site-footer">'):].replace('</footer>', credits+'</footer>',1)
    return html

def home_properties(props):
    # Direct panel entries have GF IDs; imports retain their EasyBroker IDs.
    recent = sorted(props, key=lambda p: p.get('publicado', ''), reverse=True)
    return sorted(recent, key=lambda p: not (p.get('origen') == 'panel' or p.get('landing') or p['id'].startswith('GF-')))[:8]

def combine_home_carousel(html):
    if 'id="home-stories"' in html:
        return html
    testimonials = next((sec for sec in sections(html) if 'id="testimonios"' in sec), None)
    blog = next((sec for sec in sections(html) if 'Blog y guías' in sec), None)
    if not testimonials or not blog:
        return html
    cards = re.findall(r'<figure class="testimonial">.*?</figure>', testimonials, re.S)
    posts = re.findall(r'<a class="post-card".*?</a>', blog, re.S)
    cards = [c.replace('class="testimonial"', 'class="testimonial story-card" data-story-kind="clientes"') for c in cards]
    posts = [c.replace('class="post-card"', 'class="post-card story-card" data-story-kind="blog"') for c in posts]
    hub = '''<section class="section" id="home-stories"><div class="wrap">
      <div class="stories-head"><div><p class="eyebrow">Con Gio Filio</p><h2>Historias y guías para tu próxima propiedad</h2></div>
      <a class="link-arrow" href="blog/">Ver el blog →</a></div>
      <div class="stories-controls"><div class="stories-categories" role="group" aria-label="Contenido del carrusel"><button type="button" data-stories-category="clientes" aria-pressed="true">Clientes</button><button type="button" data-stories-category="blog" aria-pressed="false">Blog y guías</button></div><div class="stories-arrows"><button type="button" class="stories-autoplay" aria-label="Pausar carrusel automático" aria-pressed="false">Pausar</button><button type="button" data-stories-direction="-1" aria-label="Contenido anterior">←</button><button type="button" data-stories-direction="1" aria-label="Contenido siguiente">→</button></div></div>
      <div class="stories-track" tabindex="0" role="region" aria-roledescription="carrusel" aria-label="Testimonios y artículos">'''+''.join(cards+posts)+'''</div>
    </div></section>'''
    html = html.replace(testimonials, hub).replace(blog, '')
    return html.replace('</body>', '<script src="assets/js/home-stories.js?v=1"></script>\n</body>')

def compact_page(path, html):
    if path == "terminos-y-condiciones/index.html" and "creditos-fotografias/" not in html:
        html = html.replace("</main>", '<p class="wrap"><a href="../creditos-fotografias/">Atribución de fotografías y licencias</a></p></main>')
    if path == "zonas/index.html":
        from real_zone_photos import apply_real_zone_photos
        return apply_real_zone_photos(html)
    if path == "index.html":
        for slug in ("polanco", "roma-norte", "condesa"):
            html = html.replace("assets/img/zonas-home/"+slug+"-card.jpg", "assets/img/zonas-reales/"+slug+".jpg")
    if path == "index.html" and "home-gallery.js" not in html:
        html = html.replace("</body>", '<script src="assets/js/home-gallery.js?v=1" defer></script></body>')
    targets = ('index.html','contacto/index.html','invertir/index.html','propiedades/index.html','valuacion/index.html','vender/index.html')
    if path not in targets or 'compact-pages.css' in html:
        return html
    prefix = '' if path == 'index.html' else '../'
    html = html.replace('</head>', f'<link rel="stylesheet" href="{prefix}assets/css/compact-pages.css?v=3">\n</head>')
    html = html.replace('<body ', '<body data-compact="'+path.split('/')[0]+'" ', 1)
    if path in ('valuacion/index.html','vender/index.html'):
        html = re.sub(r'<p[^>]*>Tu propiedad\s*·\s*Su siguiente paso</p>', '', html, flags=re.I)
        html = html.replace('Conoce su valor. Da el siguiente paso.', '¿Cuánto vale tu propiedad?')
        html = html.replace('Estima el valor de tu propiedad en CDMX y solicita venderla, en un mismo lugar.', 'Obtén una estimación y, si quieres vender, recibe asesoría de Gio Filio.')
    elif path == 'index.html':
        html = html.replace('<p class="eyebrow">Selección de Gio</p>', '')
        html = html.replace('Explora estas propiedades', 'Propiedades')
        for sec in sections(html):
            if 'id="destacadas"' in sec:
                html = html.replace(sec, re.sub(r'<span class="badge badge--destacada">Destacada</span>', '<span class="badge badge--venta">Venta y renta</span>', sec))

        html = re.sub(r'<section[^>]*id="objetivos-home".*?</section>', '', html, flags=re.S)
        html = html.replace('Lo que dicen quienes ya encontraron su espacio', 'La experiencia de nuestros clientes')
        sale_banner = '''<section class="section" id="vender-home">
  <div class="wrap">
    <div class="home-sale-banner">
      <div class="home-sale-copy">
        <p class="eyebrow">Para propietarios</p>
        <h2>Vende tu propiedad con Gio Filio</h2>
        <p>Te acompañamos desde la valoración hasta el cierre de la venta.</p>
      </div>
      <a class="btn home-sale-action" href="vender/">Quiero vender <span aria-hidden="true">→</span></a>
    </div>
  </div>
</section>'''
        html = re.sub(r'<section[^>]*id="vender-home".*?</section>', lambda m: sale_banner, html, flags=re.S)
        # Blog and testimonials retain every card in compact, swipeable rows.
        for sec in sections(html):
            if 'Blog y guías' in sec:
                html = html.replace(sec, sec.replace('<section class="section">', '<section class="section" id="blog-home">',1))
    elif path == 'contacto/index.html':
        faq = next(s for s in sections(html) if 'Preguntas frecuentes' in s)
        accordion = re.search(r'<div class="accordion".*</div>\s*</div></section>', faq, re.S).group(0).rsplit('</div></section>',1)[0]
        html = html.replace(faq, '')
        marker = '      </div>\n      <div>\n        <div class="gio-card"'
        html = html.replace(marker, '<details class="compact-details contact-faq"><summary>Preguntas frecuentes</summary>'+accordion+'</details>\n'+marker,1)
        html = html.replace('Hablemos de tu próximo espacio','¿En qué podemos ayudarte?')
    elif path == 'invertir/index.html':
        ss = sections(html)
        card = re.search(r'<aside class="gio-card".*?</aside>',ss[-1],re.S).group(0)
        card = card.replace('data-source="sitio_web"','data-source="pagina_invertir"').replace('data-form-name="contacto_lateral"','data-form-name="inversion"')
        card = card.replace('Cuéntame qué buscas','Cuéntanos tu plan de inversión')
        card = re.sub(r'placeholder="[^"]*"(?=></textarea>)', 'placeholder="¿Qué presupuesto, zona y objetivo tienes en mente?"', card)
        card = card.replace('<textarea ', '<textarea rows="3" ').replace('Cuéntame qué buscas y cómo te gustaría vivir.', '¿Qué presupuesto, zona y objetivo tienes en mente?')
        info = ''
        for sec, title in zip(ss[1:4], ['Cómo te acompañamos','Comparar rendimientos por colonia','Preguntas frecuentes']):
            inner = re.sub(r'^<section[^>]*>\s*<div[^>]*>|</div>\s*</section>$','',sec, flags=re.S)
            inner = re.sub(r'<p class="eyebrow">.*?</p>|<h2\b[^>]*>.*?</h2>','',inner,flags=re.S)
            info += '<details class="compact-details"><summary>'+title+'</summary>'+inner+'</details>'
        main = '''<nav class="breadcrumb wrap" aria-label="Ruta de navegación"><a href="../">Inicio</a> / Invertir</nav><section class="section"><div class="wrap investment-layout"><div><p class="eyebrow">Inversión inmobiliaria</p><h1>Encuentra una inversión que se ajuste a ti</h1><p class="lead">Compara zonas y oportunidades según tu presupuesto y el rendimiento que buscas, con el acompañamiento de Gio Filio.</p><a class="link-arrow" href="../valuacion/">Estimar el valor de una propiedad →</a><div class="investment-info">'''+info+'''</div></div><div>'''+card+'''</div></div></section>'''
        html = re.sub(r'(<main id="main">).*?(</main>)',lambda m:m[1]+main+m[2],html,flags=re.S)
    elif path == 'propiedades/index.html':
        html = html.replace('gio.js?v=3', 'gio.js?v=4')
        aside = re.search(r'<aside[^>]*class="filters-desktop".*?</aside>',html,re.S).group(0)
        select = lambda key: re.search(r'<select data-f-select="'+key+r'".*?</select>',aside,re.S).group(0)
        op = re.search(r'<div class="seg[^>]*data-f-seg="operacion".*?</div>',aside,re.S).group(0)
        prices = re.findall(r'<input[^>]*data-f-input="precio(?:Min|Max)"[^>]*>',aside)
        types = re.search(r'<select data-f-select="tipo".*?</select>',html,re.S).group(0)
        bar = '<div class="property-top-filters" aria-label="Filtros principales">'+op+'<label>Tipo de inmueble'+types+'</label><label>Colonia'+select('colonia')+'</label><label>Precio (MXN)<span class="field-pair">'+''.join(prices)+'</span></label><button class="btn btn--ghost" data-open-drawer="filtersDrawer">Más filtros</button></div>'
        html = html.replace(aside,'')
        html = html.replace('<section id="resultados">','<section id="resultados">'+bar)
        html = html.replace('grid-template-columns:238px 1fr','grid-template-columns:1fr')
        html = html.replace('Propiedades en Ciudad de México</h1>', 'Encuentra tu propiedad</h1>')
        html = html.replace('Explora el inventario completo. Usa los filtros para acotar por colonia, tipo, precio o características, y guarda tus favoritas para compararlas después.', 'Filtra tu búsqueda y guarda tus favoritas para compararlas.')
    if path == 'index.html':
        for sec in sections(html):
            if any('id="'+key+'"' in sec for key in ('destacadas','testimonios','blog-home')):
                updated = re.sub(r'<div class="(card-grid|grid grid-3)"', r'<div tabindex="0" role="region" aria-label="Contenido deslizable" class="\1"',sec,count=1)
                html = html.replace(sec, updated)
    if path == 'index.html':
        html = real_home_photos(combine_home_carousel(html))
    return html
