# -*- coding: utf-8 -*-
"""Artículos de blog ligados a propiedades con landing propia.

Se suman a BLOG en build.py. Formato igual al de data_content.BLOG, con extras:
  · cuerpo: tuplas (h2, texto) o (h2, texto, html_extra)  — html_extra va debajo del texto
  · img_base: imagen propia (sin extensión); el generador espera -hero.* y -card.*
  · faqs: [(pregunta, respuesta)] → bloque de preguntas + FAQPage
  · landing_id: id de la landing que se destaca al final del artículo
"""

_TABLA_COMPARA = """<div class="table-scroll"><table class="cmp-table">
<caption class="sr-only">Comparación entre comprar y rentar una oficina</caption>
<thead><tr><th scope="col">Criterio</th><th scope="col">Comprar</th><th scope="col">Rentar</th></tr></thead>
<tbody>
<tr><th scope="row">Desembolso inicial</th><td>Alto: enganche o pago completo, más gastos de escrituración</td><td>Menor: depósito y primeras rentas</td></tr>
<tr><th scope="row">Flexibilidad</th><td>Baja. Para mudarte tienes que vender o rentar el espacio</td><td>Mayor. Depende del plazo y de las cláusulas de salida del contrato</td></tr>
<tr><th scope="row">Adecuaciones</th><td>Más control sobre obra y distribución</td><td>Sujetas a lo que autorice el arrendador</td></tr>
<tr><th scope="row">Costo recurrente</th><td>Mantenimiento, predial y seguros</td><td>Renta mensual y, según el contrato, mantenimiento</td></tr>
<tr><th scope="row">Patrimonio</th><td>Construyes patrimonio y puedes rentar el espacio a terceros</td><td>No genera patrimonio</td></tr>
<tr><th scope="row">Tratamiento fiscal</th><td>Cambia según tu régimen y tu estructura</td><td>Cambia según tu régimen y tu estructura</td></tr>
</tbody></table></div>"""

_CHECKLIST = """<ul>
<li><b>Superficie:</b> pregunta cuántos metros son rentables y cuántos son útiles.</li>
<li><b>Cajones de estacionamiento:</b> divide los metros entre los cajones incluidos y compáralos con tu plantilla.</li>
<li><b>Elevadores:</b> cuántos llegan al piso y cómo funcionan en hora pico.</li>
<li><b>Acceso de tu equipo:</b> vialidades de llegada, transporte y tiempos reales desde donde vive tu gente.</li>
<li><b>Qué incluye la entrega:</b> privados, salas, baños, comedor, site y acabados que ya existen.</li>
<li><b>Cuotas:</b> mantenimiento, servicios y cualquier cargo que no esté en el precio.</li>
<li><b>Requisitos legales:</b> uso de suelo y protección civil del inmueble.</li>
<li><b>Contrato:</b> plazo, incrementos, penalizaciones y condiciones de salida.</li>
</ul>"""

_TABLA_EJEMPLO = """<div class="table-scroll"><table class="cmp-table">
<caption class="sr-only">Datos confirmados de Espacio Santa Fe Piso 18</caption>
<thead><tr><th scope="col">Dato</th><th scope="col">Espacio Santa Fe — Piso 18</th></tr></thead>
<tbody>
<tr><th scope="row">Ubicación</th><td>Carretera México–Toluca 5420, El Yaqui, Cuajimalpa</td></tr>
<tr><th scope="row">Superficie</th><td>1,099.44 m²</td></tr>
<tr><th scope="row">Estacionamientos</th><td>36 cajones incluidos</td></tr>
<tr><th scope="row">Distribución</th><td>18 privados (3 con baño propio), sala de juntas, sala de capacitación, comedor y cuarto para site</td></tr>
<tr><th scope="row">Edificio</th><td>Clase A+, certificación LEED Gold, 8 elevadores con acceso al piso</td></tr>
<tr><th scope="row">Operación</th><td>Venta y renta</td></tr>
<tr><th scope="row">Precio</th><td>A consultar</td></tr>
</tbody></table></div>"""

ARTICULOS = [
    dict(
        slug="oficinas-en-santa-fe-comprar-o-rentar",
        categoria="Zonas de CDMX",
        titulo="Oficinas en Santa Fe: comprar o rentar y qué revisar antes de decidir",
        resumen=("Comparo comprar y rentar una oficina en Santa Fe, explico qué significan Clase A+ y LEED Gold "
                 "y dejo una lista para revisar antes de firmar. Con un ejemplo real."),
        lectura=6, fecha="2026-09-25",
        img_base="assets/img/blog/oficinas-en-santa-fe-comprar-o-rentar",
        landing_id="GF-ESF-P18",
        cuerpo=[
            ("Por qué muchas empresas buscan en Santa Fe",
             "Santa Fe concentra corporativos, hoteles, centros comerciales y universidades en el poniente de la ciudad. "
             "Para una empresa, la ventaja práctica es la conexión: se llega por la Carretera México–Toluca, por Vasco de "
             "Quiroga y por Vista Hermosa, y la zona queda junto a la salida poniente de la ciudad.\n"
             "También hay un costo. Los tiempos de traslado en hora pico pesan, así que conviene medir el trayecto real de "
             "tu equipo antes de enamorarte del edificio."),
            ("Comprar o rentar una oficina: la comparación rápida",
             "No hay una respuesta única. La decisión depende de cuánto capital quieres inmovilizar, cuánto tiempo piensas "
             "quedarte y cuánto control necesitas sobre el espacio. Esta tabla resume las diferencias principales.",
             _TABLA_COMPARA),
            ("Cómo decidir sin complicarte",
             "Si tu plan a cinco años o más es estable y el espacio ya está acondicionado para tu operación, comprar suele "
             "tener sentido. Si tu equipo puede crecer, cambiar de sede o depender de un contrato con vigencia limitada, "
             "rentar te da margen.\n"
             "El tratamiento fiscal cambia según tu régimen y tu estructura. Antes de decidir, platícalo con tu contador y "
             "pídele que compare ambos escenarios con tus números."),
            ("Qué significan Clase A+ y LEED Gold",
             "No existe una norma oficial única para clasificar oficinas. Clase A+ es un término de mercado: los corredores "
             "lo usan para edificios de primer nivel por ubicación, especificaciones y servicios. Pide siempre el detalle "
             "de lo que incluye ese edificio en concreto.\n"
             "LEED es una certificación internacional de edificios sustentables. Tiene cuatro niveles: Certified, Silver, "
             "Gold y Platinum. Gold es el tercero. Suele relacionarse con menor consumo de energía y agua, aunque el ahorro "
             "real depende de cómo opere el edificio."),
            ("Qué revisar antes de firmar o escriturar",
             "Esta lista te ahorra sorpresas. Llévala a la visita y anota las respuestas por escrito.",
             _CHECKLIST),
            ("Un ejemplo real: Espacio Santa Fe Piso 18",
             "Para aterrizar los criterios, uso una oficina que sí tengo disponible. Ocupa el piso 18 completo, ya está "
             "acondicionada y ofrece 36 cajones para 1,099.44 m², es decir, un cajón por cada 30 m² aproximadamente. "
             "Estos son los datos confirmados.",
             _TABLA_EJEMPLO),
            ("Cómo te acompaño en la decisión",
             "Te muestro el espacio, reviso contigo la lista anterior y pido a los propietarios las condiciones de venta y "
             "de renta para que compares con cifras reales. Si tu empresa todavía no sabe si comprar o rentar, empezamos "
             "por ahí, sin compromiso."),
        ],
        faqs=[
            ("¿Conviene comprar o rentar una oficina en Santa Fe?",
             "Depende de tu horizonte y de tu capital. Comprar funciona mejor si planeas quedarte varios años y el espacio "
             "ya se adapta a tu operación. Rentar conviene si necesitas flexibilidad. Compara ambos escenarios con tu contador."),
            ("¿Qué es la certificación LEED Gold?",
             "Es el tercer nivel de cuatro de la certificación LEED para edificios sustentables, después de Certified y Silver. "
             "Reconoce el diseño y la operación del edificio en temas como energía, agua y materiales."),
            ("¿Cuántos estacionamientos necesita una oficina?",
             "Cambia según el uso y el reglamento aplicable. Una referencia es dividir los metros entre los cajones incluidos: "
             "en Espacio Santa Fe Piso 18 salen unos 30 m² por cajón. Confirma la cantidad con tu plantilla real."),
            ("¿Espacio Santa Fe Piso 18 está en venta o en renta?",
             "Está disponible en las dos modalidades. El precio se comparte de forma directa, escribe a Gio para recibirlo."),
        ],
    ),
]
