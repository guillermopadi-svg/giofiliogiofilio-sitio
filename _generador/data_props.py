# -*- coding: utf-8 -*-
"""Gio Filio — Dataset DEMO de propiedades.

⚠️  TODAS las propiedades de este archivo son FICTICIAS y existen únicamente
para demostrar el funcionamiento del sitio. No representan inventario real.
Todas las ubicaciones pertenecen exclusivamente a la Ciudad de México.
"""

DATASET_ES_DEMO = True

TIPOS = [
    ("departamento", "Departamento", "Departamentos"),
    ("casa", "Casa", "Casas"),
    ("casa-en-condominio", "Casa en condominio", "Casas en condominio"),
    ("penthouse", "Penthouse", "Penthouses"),
    ("loft", "Loft", "Lofts"),
    ("terreno", "Terreno", "Terrenos"),
    ("oficina", "Oficina", "Oficinas"),
    ("local-comercial", "Local comercial", "Locales comerciales"),
    ("desarrollo", "Desarrollo", "Desarrollos"),
]
TIPO_LABEL = {t[0]: t[1] for t in TIPOS}
TIPO_PLURAL = {t[0]: t[2] for t in TIPOS}

AMENIDADES = [
    ("seguridad", "Seguridad 24/7"), ("elevador", "Elevador"), ("alberca", "Alberca"),
    ("gimnasio", "Gimnasio"), ("roof-garden", "Roof garden"), ("salon-eventos", "Salón de eventos"),
    ("jardin", "Jardín"), ("terraza", "Terraza"), ("balcon", "Balcón"),
    ("bodega", "Bodega"), ("cuarto-servicio", "Cuarto de servicio"), ("home-office", "Home office"),
    ("pet-friendly", "Pet friendly"), ("amueblado", "Amueblado"), ("accesibilidad", "Accesibilidad"),
    ("estacionamiento-visitas", "Estacionamiento de visitas"), ("area-juegos", "Área de juegos"),
    ("cisterna", "Cisterna"), ("planta-emergencia", "Planta de emergencia"), ("asador", "Área de asadores"),
]
AMENIDAD_LABEL = dict(AMENIDADES)

ESTADOS_INMUEBLE = [
    ("nuevo", "Nuevo"), ("excelente", "Excelente estado"),
    ("remodelado", "Remodelado"), ("por-remodelar", "Para remodelar"),
]

# Índices dentro del pool de fotografías descargadas (ver assets/img/properties)
P_SALA = [0, 2, 3, 4, 9, 12, 15, 17, 18, 19, 21, 31, 32, 33, 34, 35, 36, 44, 46, 48, 50, 51, 63, 64]
P_COCINA = [5, 6, 37, 65]
P_RECAMARA = [20, 39, 45, 47]
P_BANO = [1, 41, 43]
P_EXT = [7, 8, 11, 13, 14, 16, 22, 23, 24, 27, 40, 42, 54, 55, 62]
P_DET = [10, 38]
P_CIUDAD = [57, 60, 56, 58]

# ---------------------------------------------------------------------------
# Campos por propiedad:
#  id, titulo, operacion, tipo, colonia, precio, mantenimiento, calle,
#  rec, ban, medios, est, m2c, m2t, antig, piso, niveles, estado_inm,
#  amenidades, badges, destacada, exclusiva, descripcion
# ---------------------------------------------------------------------------

PROPIEDADES = [
# ======================================= POLANCO (Miguel Hidalgo)
dict(id="GF-1024", titulo="Departamento en Polanco con terraza y vista a Chapultepec",
     operacion="venta", tipo="departamento", colonia="polanco", precio=12_900_000, mantenimiento=9_800,
     calle="Aristóteles", rec=3, ban=3, medios=1, est=2, m2c=185, m2t=0, antig=12, piso=8, niveles=14,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","gimnasio","roof-garden","terraza","bodega","cuarto-servicio","salon-eventos","estacionamiento-visitas","pet-friendly"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Este departamento tiene algo que casi no se encuentra en Polanco: una terraza de verdad. Diez metros lineales orientados al poniente, con vista abierta hacia la Primera Sección de Chapultepec y suficiente profundidad para poner una mesa de ocho sin que se sienta apretado.\n\nEl interior está resuelto con criterio. La sala y el comedor comparten un solo espacio de doble altura parcial, con piso de duela de ingeniería y ventanales de piso a techo que dejan entrar luz durante toda la tarde. La cocina es integral, con isla central y salida independiente al área de servicio.\n\nLas tres recámaras son en suite. La principal ocupa toda el ala norte, con vestidor y baño con doble lavabo. El edificio tiene conserjería, gimnasio, salón de eventos y roof garden con asadores. La ubicación permite caminar a Masaryk, a Polanquito y al Parque Lincoln."),

dict(id="GF-1031", titulo="Penthouse en Polanco V con roof privado",
     operacion="venta", tipo="penthouse", colonia="polanco", precio=27_500_000, mantenimiento=16_500,
     calle="Julio Verne", rec=3, ban=3, medios=1, est=3, m2c=310, m2t=0, antig=5, piso=16, niveles=16,
     estado_inm="nuevo",
     amenidades=["seguridad","elevador","gimnasio","alberca","roof-garden","terraza","salon-eventos","bodega","cuarto-servicio","home-office","estacionamiento-visitas","planta-emergencia"],
     badges=["nueva","exclusiva"], destacada=True, exclusiva=True,
     descripcion="Un penthouse de dos niveles con roof garden de uso exclusivo, en uno de los edificios más discretos de Polanco V. La planta principal reúne sala, comedor y cocina en un solo volumen de 95 m² con triple orientación.\n\nEl nivel superior está dedicado por completo a la recámara principal: vestidor caminable, baño con tina exenta y una terraza privada que da directo al roof. Arriba hay 70 m² adicionales con jardinera perimetral, asador y espacio para hidromasaje.\n\nEl edificio se entregó hace cinco años y mantiene un nivel de conservación impecable. Tres cajones de estacionamiento continuos, bodega de 8 m² y acceso controlado con doble filtro. Es una propiedad para quien busca formato de casa sin renunciar a la verticalidad de Polanco."),

dict(id="GF-1042", titulo="Departamento amueblado en renta en Polanco",
     operacion="renta", tipo="departamento", colonia="polanco", precio=68_000, mantenimiento=0,
     calle="Emilio Castelar", rec=2, ban=2, medios=1, est=2, m2c=140, m2t=0, antig=8, piso=5, niveles=11,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","gimnasio","amueblado","balcon","bodega","pet-friendly","roof-garden","estacionamiento-visitas"],
     badges=[], destacada=True, exclusiva=False,
     descripcion="Frente al Parque Lincoln, completamente amueblado y listo para entrar. Es la opción que suelo recomendar a quien llega a la ciudad por un proyecto de uno o dos años y no quiere invertir tiempo en montar una casa.\n\nEl mobiliario es contemporáneo y neutro, en tonos arena y madera clara. Sala con sofá de tres plazas, comedor para seis, cocina equipada con línea blanca completa y ambas recámaras con clósets vestidor.\n\nEl balcón de la sala da al camellón arbolado de Castelar, que es de las vistas más tranquilas de Polanco. Incluye dos cajones de estacionamiento, bodega y acceso al gimnasio y roof garden del edificio. Renta mínima de doce meses, mantenimiento incluido."),

dict(id="GF-1055", titulo="Departamento de gran formato en Polanco III",
     operacion="venta", tipo="departamento", colonia="polanco", precio=18_400_000, mantenimiento=12_200,
     calle="Horacio", rec=4, ban=4, medios=1, est=3, m2c=265, m2t=0, antig=18, piso=4, niveles=9,
     estado_inm="remodelado",
     amenidades=["seguridad","elevador","terraza","bodega","cuarto-servicio","home-office","salon-eventos","estacionamiento-visitas","cisterna"],
     badges=["oportunidad"], destacada=False, exclusiva=False,
     descripcion="Los departamentos de 265 m² en Polanco casi siempre son de edificios de los ochenta y noventa, con plantas generosas que ya no se construyen. Este es uno de ellos, y fue remodelado en su totalidad hace tres años.\n\nSe abrieron los muros entre sala, comedor y estancia para generar un área social continua de casi 80 m². La cocina se rehízo completa con carpintería a medida y cubiertas de cuarzo. Los baños se cambiaron los cuatro.\n\nConserva lo que hace valiosos a estos edificios: cuatro recámaras reales, cuarto de servicio con baño completo, área de lavado independiente y tres cajones de estacionamiento. El edificio es de baja densidad, con dos departamentos por nivel."),

# ======================================= LOMAS DE CHAPULTEPEC
dict(id="GF-1068", titulo="Casa en Lomas de Chapultepec con jardín maduro",
     operacion="venta", tipo="casa", colonia="lomas-de-chapultepec", precio=42_000_000, mantenimiento=0,
     calle="Monte Líbano", rec=4, ban=4, medios=2, est=4, m2c=520, m2t=880, antig=28, piso=0, niveles=2,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","terraza","alberca","bodega","cuarto-servicio","home-office","cisterna","asador","estacionamiento-visitas"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Una casa de dos niveles sobre un terreno de 880 m² en la parte alta de Monte Líbano. El jardín es lo primero que llama la atención: jacarandas y fresnos de treinta años que dan sombra real a la terraza posterior.\n\nLa planta baja se organiza alrededor de un vestíbulo de doble altura. Sala con chimenea, comedor para doce, estudio con biblioteca empotrada y cocina con antecomedor y salida al jardín. Todo el nivel abre hacia el exterior con puertas corredizas de piso a techo.\n\nArriba están las cuatro recámaras, todas en suite. La principal tiene sala de estar, vestidor doble y terraza privada. Hay además un área de servicio independiente con dos cuartos y baño, y cochera techada para cuatro autos."),

dict(id="GF-1073", titulo="Casa para remodelar en Lomas de Chapultepec",
     operacion="venta", tipo="casa", colonia="lomas-de-chapultepec", precio=28_500_000, mantenimiento=0,
     calle="Sierra Vertientes", rec=5, ban=4, medios=1, est=3, m2c=430, m2t=1050, antig=46, piso=0, niveles=2,
     estado_inm="por-remodelar",
     amenidades=["jardin","bodega","cuarto-servicio","cisterna","asador"],
     badges=["oportunidad"], destacada=False, exclusiva=False,
     descripcion="Hablemos con claridad: esta casa necesita una intervención completa. Está en su estado original de los años ochenta y lleva cuatro años desocupada. Lo que se compra aquí es el terreno y la ubicación.\n\nSon 1,050 m² planos en una de las calles más tranquilas de Lomas, con frente de 24 metros y uso de suelo habitacional unifamiliar. La estructura está sana y el estudio estructural preliminar está disponible para revisión.\n\nHay dos caminos razonables: una remodelación integral respetando la estructura existente, o demolición y obra nueva. He acompañado ambos escenarios con clientes en la zona y puedo compartir números reales de costo por metro cuadrado antes de que decidas."),

dict(id="GF-1081", titulo="Casa en renta en Lomas de Chapultepec con alberca",
     operacion="renta", tipo="casa", colonia="lomas-de-chapultepec", precio=145_000, mantenimiento=0,
     calle="Prado Norte", rec=4, ban=4, medios=1, est=4, m2c=480, m2t=760, antig=15, piso=0, niveles=2,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","alberca","terraza","bodega","cuarto-servicio","home-office","asador","cisterna","planta-emergencia"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Casa completamente equipada en Prado Norte, disponible para renta a partir del próximo mes. Es una de las pocas propiedades de la zona que se renta con alberca climatizada en operación.\n\nEl área social ocupa todo el frente de la planta baja y se comunica con la terraza cubierta y el jardín. La cocina es de línea alemana, con isla y desayunador. Hay un estudio independiente con entrada propia que funciona muy bien como oficina en casa.\n\nCuatro recámaras en suite en la planta alta, área de servicio con dos habitaciones, lavandería equipada y cochera techada para cuatro autos con dos lugares adicionales descubiertos. Se renta sin muebles, con cocina y línea blanca incluidas."),

# ======================================= ANZURES / ESCANDÓN / BOSQUES
dict(id="GF-1096", titulo="Departamento remodelado en Anzures",
     operacion="venta", tipo="departamento", colonia="anzures", precio=7_450_000, mantenimiento=4_600,
     calle="Leibnitz", rec=3, ban=2, medios=0, est=2, m2c=145, m2t=0, antig=32, piso=3, niveles=8,
     estado_inm="remodelado",
     amenidades=["seguridad","elevador","balcon","bodega","cuarto-servicio","home-office","pet-friendly"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Anzures es la respuesta lógica para quien quiere ubicación de Miguel Hidalgo sin pagar precio de Polanco. Este departamento está a doce minutos caminando de Masaryk y cuesta la mitad por metro cuadrado.\n\nLa remodelación se hizo el año pasado y respetó lo bueno del edificio original: alturas de 2.85 m, ventanas amplias y una distribución con circulaciones claras. Se cambiaron pisos, instalaciones hidráulicas y eléctricas, cocina y ambos baños.\n\nTres recámaras con clóset, balcón corrido al frente y un cuarto de servicio que hoy funciona como estudio. Dos cajones de estacionamiento en el mismo edificio. El condominio tiene 16 departamentos y una administración ordenada, con fondo de reserva vigente."),

dict(id="GF-1104", titulo="Departamento nuevo en Escandón con roof garden",
     operacion="venta", tipo="departamento", colonia="escandon", precio=5_980_000, mantenimiento=3_200,
     calle="José Martí", rec=2, ban=2, medios=1, est=1, m2c=98, m2t=0, antig=0, piso=4, niveles=6,
     estado_inm="nuevo",
     amenidades=["seguridad","elevador","roof-garden","terraza","gimnasio","bodega","home-office","pet-friendly","estacionamiento-visitas","asador"],
     badges=["nueva","preventa"], destacada=True, exclusiva=False,
     descripcion="Obra nueva con entrega en el primer trimestre del próximo año. Escandón lleva una década transformándose y este es el tipo de proyecto que explica por qué: escala media, buenos acabados y precio por metro cuadrado todavía por debajo de Condesa.\n\nLa planta es eficiente. Sala-comedor de 32 m² con salida a terraza, cocina integral abierta con barra, dos recámaras con clóset y un medio baño para visitas que casi nunca aparece en departamentos de este tamaño.\n\nEl edificio tiene solo 18 unidades, gimnasio equipado y un roof garden con asadores y área de estar. Un cajón de estacionamiento y bodega incluidos. Quedan cuatro unidades disponibles con precio de preventa; el ajuste al cerrar obra suele ser del 8 al 12 por ciento."),

dict(id="GF-1112", titulo="Casa en Bosques de las Lomas con vista a barranca",
     operacion="venta", tipo="casa", colonia="bosques-de-las-lomas", precio=34_800_000, mantenimiento=0,
     calle="Bosque de Duraznos", rec=4, ban=4, medios=1, est=4, m2c=560, m2t=640, antig=20, piso=0, niveles=3,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","terraza","bodega","cuarto-servicio","home-office","cisterna","asador","planta-emergencia","estacionamiento-visitas"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="La topografía de Bosques es su mejor activo y esta casa la aprovecha bien. Está construida en tres niveles escalonados sobre la barranca, de manera que cada planta tiene salida a exterior y vista al arbolado.\n\nEl nivel de acceso aloja sala, comedor y una terraza cubierta de 40 m² que se usa todo el año por el clima de la zona. El nivel intermedio tiene la cocina, el antecomedor, un family room y el estudio. El inferior está dedicado a las recámaras, todas con vista a la vegetación.\n\nEl mantenimiento estructural está al día y el sistema de captación pluvial funciona. Cochera techada para cuatro autos y acceso rápido a Palmas, Santa Fe y Periférico."),

# ======================================= ROMA NORTE / ROMA SUR / CONDESA / HIPÓDROMO / JUÁREZ
dict(id="GF-1125", titulo="Departamento en Roma Norte en edificio restaurado",
     operacion="venta", tipo="departamento", colonia="roma-norte", precio=8_650_000, mantenimiento=3_900,
     calle="Colima", rec=2, ban=2, medios=0, est=1, m2c=118, m2t=0, antig=94, piso=2, niveles=4,
     estado_inm="remodelado",
     amenidades=["elevador","balcon","home-office","pet-friendly","bodega"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Un edificio de 1932 restaurado hace dos años con criterio patrimonial. Se conservaron los pisos de duela original, la herrería de los balcones, los plafones con moldura y las puertas de doble hoja. Se renovaron por completo instalaciones, cocina y baños.\n\nEl departamento ocupa el frente del segundo nivel, con tres balcones sobre Colima y alturas de 3.4 metros. La sala y el comedor están separados por un arco original, sin muros ciegos, así que el espacio se lee continuo pero conserva la lógica de la planta antigua.\n\nDos recámaras amplias, ambas con ventana a la calle. Un cajón de estacionamiento en el mismo edificio, algo poco frecuente en construcciones de esta época en Roma Norte. Estás a dos cuadras de Álvaro Obregón y del Mercado Medellín."),

dict(id="GF-1133", titulo="Loft en Roma Norte con doble altura",
     operacion="renta", tipo="loft", colonia="roma-norte", precio=34_500, mantenimiento=0,
     calle="Córdoba", rec=1, ban=1, medios=1, est=1, m2c=82, m2t=0, antig=15, piso=5, niveles=5,
     estado_inm="excelente",
     amenidades=["elevador","roof-garden","terraza","amueblado","home-office","pet-friendly","seguridad"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Último nivel con doble altura de 5.2 metros y ventanal completo al poniente. Es el tipo de espacio que funciona muy bien para una persona o una pareja que trabaja desde casa y valora la luz por encima del número de cuartos.\n\nLa planta baja tiene sala, comedor, cocina abierta y medio baño. El tapanco aloja la recámara y el baño completo, con una barandal de cristal que mantiene la sensación de amplitud.\n\nSe renta amueblado, con mobiliario de diseño mexicano contemporáneo. Incluye acceso al roof garden del edificio, que tiene vista despejada hacia el poniente y es de los mejores lugares para ver el atardecer en la colonia. Un cajón de estacionamiento. Acepta mascotas."),

dict(id="GF-1147", titulo="Departamento de inversión en Roma Sur",
     operacion="venta", tipo="departamento", colonia="roma-sur", precio=4_850_000, mantenimiento=2_400,
     calle="Zacatecas", rec=2, ban=1, medios=1, est=1, m2c=88, m2t=0, antig=42, piso=3, niveles=5,
     estado_inm="excelente",
     amenidades=["elevador","balcon","home-office","pet-friendly"],
     badges=["oportunidad"], destacada=True, exclusiva=False,
     descripcion="Este es un ejercicio de inversión antes que una compra emocional, y los números lo respaldan. A 55,100 pesos por metro cuadrado está entre 18 y 22 por ciento por debajo de un departamento equivalente en Roma Norte, a siete cuadras de distancia.\n\nLa renta comparable en la zona para dos recámaras en buen estado va de 21,000 a 24,000 pesos mensuales. Con precio de lista y mantenimiento actual, eso proyecta un rendimiento bruto anual cercano al 5.4 por ciento, sin considerar plusvalía.\n\nEl departamento está en buen estado y no requiere obra para rentarse. Piso de duela, cocina funcional, balcón a la calle y buena iluminación matutina. Puedo compartirte el análisis completo con comparables de los últimos doce meses."),

dict(id="GF-1158", titulo="Departamento art déco en Condesa frente al Parque México",
     operacion="venta", tipo="departamento", colonia="condesa", precio=11_200_000, mantenimiento=5_100,
     calle="Ámsterdam", rec=3, ban=2, medios=1, est=1, m2c=152, m2t=0, antig=88, piso=4, niveles=5,
     estado_inm="remodelado",
     amenidades=["elevador","balcon","terraza","home-office","pet-friendly","bodega"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Frente al Parque México, en uno de los edificios art déco mejor conservados de Ámsterdam. La vista desde la sala es directa al arbolado del parque, sin construcciones de por medio.\n\nLa remodelación conservó el carácter del edificio: duela original restaurada, herrería de balcones, ventanas de guillotina y los detalles de yesería en los plafones. Las instalaciones se cambiaron por completo y la cocina se rehízo con carpintería a medida.\n\nTres recámaras, la principal con vestidor y baño propio. Terraza posterior de 14 m² con jardinera. Un cajón de estacionamiento. Vivir aquí significa no usar el auto entre semana: tienes el parque enfrente y todo Condesa a pie."),

dict(id="GF-1166", titulo="Departamento en renta en Condesa con terraza",
     operacion="renta", tipo="departamento", colonia="condesa", precio=42_000, mantenimiento=0,
     calle="Michoacán", rec=2, ban=2, medios=0, est=1, m2c=105, m2t=0, antig=22, piso=3, niveles=4,
     estado_inm="excelente",
     amenidades=["elevador","terraza","balcon","pet-friendly","home-office","seguridad"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Sobre Michoacán, a una cuadra de Parque España. Tiene una terraza de 18 m² orientada al oriente, protegida del ruido de la calle porque da al interior de la manzana.\n\nEl departamento está en muy buen estado y no necesita nada. Sala-comedor con salida a la terraza, cocina integral cerrada con área de lavado, dos recámaras con clóset y dos baños completos.\n\nEs una de las pocas opciones de Condesa que acepta mascotas sin restricción de tamaño y que incluye cajón de estacionamiento en el precio. Contrato mínimo de doce meses. Disponible de inmediato."),

dict(id="GF-1174", titulo="Departamento en Hipódromo Condesa con vista al parque",
     operacion="venta", tipo="departamento", colonia="hipodromo-condesa", precio=9_750_000, mantenimiento=4_400,
     calle="Ámsterdam", rec=2, ban=2, medios=1, est=1, m2c=126, m2t=0, antig=79, piso=5, niveles=6,
     estado_inm="excelente",
     amenidades=["elevador","balcon","terraza","home-office","pet-friendly","bodega","roof-garden"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Quinto nivel sobre el trazado ovalado de Ámsterdam, con la ventaja de estar por encima de la copa de los árboles: la vista es despejada y la luz entra sin obstrucción durante todo el día.\n\nEl edificio es funcionalista de 1946 y conserva su vestíbulo original con piso de mosaico y elevador de época en operación. El departamento fue actualizado sin perder carácter: se mantuvieron las proporciones de la planta y se modernizaron cocina, baños e instalaciones.\n\nDos recámaras, estudio independiente, terraza posterior y acceso al roof garden común. Un cajón de estacionamiento y bodega. Hipódromo tiene la ventaja de la vida de Condesa con calles sin tráfico de paso."),

dict(id="GF-1189", titulo="Departamento nuevo en Juárez sobre corredor Reforma",
     operacion="venta", tipo="departamento", colonia="juarez", precio=7_900_000, mantenimiento=5_600,
     calle="Havre", rec=2, ban=2, medios=1, est=1, m2c=112, m2t=0, antig=1, piso=11, niveles=22,
     estado_inm="nuevo",
     amenidades=["seguridad","elevador","gimnasio","roof-garden","alberca","salon-eventos","terraza","bodega","home-office","pet-friendly","estacionamiento-visitas","planta-emergencia","accesibilidad"],
     badges=["nueva"], destacada=True, exclusiva=False,
     descripcion="Torre entregada el año pasado, a media cuadra de Reforma y a cinco minutos caminando del Ángel. La ubicación resuelve movilidad de manera excepcional: Metrobús en la esquina, Metro Insurgentes a ocho minutos y acceso directo a cualquier punto de la ciudad.\n\nEl departamento está en el nivel 11 con orientación sur, lo que da luz constante y vista hacia Roma y Condesa. Sala-comedor continuo, cocina integral con isla, dos recámaras en suite y un medio baño.\n\nLas amenidades del edificio son completas: alberca semiolímpica techada, gimnasio, salón de eventos, terraza con asadores y seguridad las 24 horas. Incluye cajón de estacionamiento y bodega. El edificio cumple con criterios de accesibilidad universal en áreas comunes."),

dict(id="GF-1195", titulo="Oficina en Juárez sobre Paseo de la Reforma",
     operacion="renta", tipo="oficina", colonia="juarez", precio=58_000, mantenimiento=0,
     calle="Paseo de la Reforma", rec=0, ban=2, medios=0, est=3, m2c=180, m2t=0, antig=9, piso=14, niveles=28,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","accesibilidad","planta-emergencia","estacionamiento-visitas","home-office"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Piso 14 de una torre corporativa sobre Reforma, con 180 m² en planta libre y fachada continua de cristal hacia el sur. La vista abarca desde el Ángel hasta la Torre Latinoamericana.\n\nEl espacio se entrega acondicionado: piso técnico elevado, iluminación LED regulable, aire acondicionado por zonas y cableado estructurado. Hay dos privados construidos que pueden conservarse o retirarse, y una sala de juntas para diez personas.\n\nIncluye tres cajones de estacionamiento y acceso a las áreas comunes del edificio: lobby con recepción, control de acceso biométrico, planta de emergencia y elevadores con acceso restringido por piso. Contrato mínimo de 24 meses."),

# ======================================= DEL VALLE / NARVARTE / NÁPOLES / PORTALES / MIXCOAC
dict(id="GF-1208", titulo="Departamento familiar en Del Valle Centro",
     operacion="venta", tipo="departamento", colonia="del-valle", precio=7_200_000, mantenimiento=3_800,
     calle="Providencia", rec=3, ban=2, medios=1, est=2, m2c=142, m2t=0, antig=16, piso=6, niveles=9,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","balcon","bodega","cuarto-servicio","home-office","pet-friendly","salon-eventos","estacionamiento-visitas"],
     badges=[], destacada=True, exclusiva=False,
     descripcion="Del Valle Centro es la zona a la que más clientes vuelven después de comparar toda la ciudad, y este departamento explica por qué. Tres recámaras reales, dos cajones de estacionamiento, cuarto de servicio y una ubicación que resuelve escuela, mercado y hospital en un radio de diez minutos.\n\nLa distribución separa claramente el área social de la privada. Sala y comedor al frente con balcón corrido, cocina con antecomedor y área de lavado, y las tres recámaras hacia el interior, en la parte silenciosa del edificio.\n\nEl condominio tiene 27 unidades, administración profesional y fondo de reserva sano. Salón de eventos, área de juegos infantiles y estacionamiento de visitas. A cuatro cuadras del Parque Tlacoquemécatl."),

dict(id="GF-1224", titulo="Departamento amplio en Narvarte con tres recámaras",
     operacion="venta", tipo="departamento", colonia="narvarte", precio=5_400_000, mantenimiento=2_600,
     calle="Torres Adalid", rec=3, ban=2, medios=0, est=1, m2c=128, m2t=0, antig=38, piso=4, niveles=6,
     estado_inm="excelente",
     amenidades=["elevador","balcon","bodega","cuarto-servicio","home-office","pet-friendly"],
     badges=["oportunidad"], destacada=True, exclusiva=False,
     descripcion="Narvarte tiene el mejor precio por metro cuadrado entre las colonias céntricas consolidadas de la ciudad, y este departamento lo demuestra: 128 m² con tres recámaras y cuarto de servicio a 42,200 pesos por metro cuadrado.\n\nEn Roma Norte, el mismo espacio costaría cerca de nueve millones. Aquí estás a doce minutos en Metrobús de Insurgentes y a cinco del Parque Delta.\n\nLa arquitectura de los sesenta de Narvarte tiene ventajas concretas: ventanas grandes, alturas de 2.75 m y distribuciones sin desperdicio de circulación. Este edificio está bien mantenido, con fachada recién intervenida y elevador renovado. Un cajón de estacionamiento."),

dict(id="GF-1237", titulo="Departamento en renta en Narvarte cerca del Parque Delta",
     operacion="renta", tipo="departamento", colonia="narvarte", precio=19_800, mantenimiento=0,
     calle="Diagonal San Antonio", rec=2, ban=1, medios=1, est=1, m2c=86, m2t=0, antig=30, piso=3, niveles=5,
     estado_inm="excelente",
     amenidades=["elevador","balcon","pet-friendly","home-office"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="A tres cuadras del Parque Delta y a siete minutos caminando del Metro Etiopía. Es de las rentas más equilibradas que tengo en Benito Juárez: precio de Narvarte con conectividad de zona centro.\n\nOchenta y seis metros con dos recámaras, sala-comedor con balcón, cocina integral y área de lavado independiente. El baño completo se remodeló el año pasado y hay un medio baño para visitas.\n\nEl edificio es tranquilo, de cinco niveles, con elevador y portero. Acepta mascotas pequeñas y medianas. Incluye un cajón de estacionamiento. Contrato mínimo de doce meses con aval o póliza jurídica."),

dict(id="GF-1245", titulo="Departamento en Nápoles junto al Parque Hundido",
     operacion="venta", tipo="departamento", colonia="napoles", precio=6_900_000, mantenimiento=3_400,
     calle="Pennsylvania", rec=2, ban=2, medios=1, est=2, m2c=110, m2t=0, antig=7, piso=7, niveles=12,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","gimnasio","roof-garden","terraza","bodega","home-office","pet-friendly","salon-eventos","estacionamiento-visitas"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="A dos cuadras del Parque Hundido, en un edificio de siete años con amenidades completas y muy buen mantenimiento.\n\nEl departamento está en el séptimo nivel con orientación poniente, lo que le da luz de tarde y vista hacia el arbolado del parque. Sala-comedor continuo con salida a terraza, cocina integral con barra desayunador y dos recámaras en suite.\n\nEl edificio tiene gimnasio, roof garden con asadores, salón de eventos y seguridad 24 horas. Incluye dos cajones de estacionamiento y bodega. Nápoles resuelve muy bien la vida de quien trabaja en el corredor de Insurgentes o en el World Trade Center."),

dict(id="GF-1253", titulo="Departamento de entrada en Portales",
     operacion="venta", tipo="departamento", colonia="portales", precio=3_450_000, mantenimiento=1_900,
     calle="Cumbres de Maltrata", rec=2, ban=1, medios=0, est=1, m2c=76, m2t=0, antig=12, piso=2, niveles=4,
     estado_inm="excelente",
     amenidades=["elevador","balcon","bodega","pet-friendly","seguridad"],
     badges=["oportunidad"], destacada=True, exclusiva=False,
     descripcion="Si estás comprando tu primer departamento y quieres quedarte en Benito Juárez, Portales es probablemente la mejor puerta de entrada que existe hoy en la ciudad.\n\nSetenta y seis metros con dos recámaras, en un edificio de doce años que está bien conservado. Sala-comedor con balcón, cocina integral, baño completo remodelado y área de lavado dentro del departamento.\n\nEstás a seis minutos caminando del Metro Portales y a diez del mercado, que sigue siendo uno de los mejores de la ciudad. Incluye cajón de estacionamiento y bodega. Con un enganche del 20 por ciento, la mensualidad de crédito queda por debajo de lo que cuesta rentar algo equivalente en Del Valle."),

dict(id="GF-1261", titulo="Departamento nuevo en Insurgentes Mixcoac",
     operacion="venta", tipo="departamento", colonia="insurgentes-mixcoac", precio=6_300_000, mantenimiento=3_100,
     calle="Extremadura", rec=2, ban=2, medios=0, est=1, m2c=94, m2t=0, antig=0, piso=9, niveles=15,
     estado_inm="nuevo",
     amenidades=["seguridad","elevador","gimnasio","roof-garden","terraza","salon-eventos","bodega","home-office","pet-friendly","accesibilidad","estacionamiento-visitas"],
     badges=["nueva","entrega-inmediata"], destacada=False, exclusiva=False,
     descripcion="Entrega inmediata en una torre recién terminada sobre Extremadura, a cuatro minutos caminando del Metro Mixcoac.\n\nLa conectividad de esta esquina es difícil de igualar: cruce de las Líneas 7 y 12 del Metro, Metrobús sobre Insurgentes y acceso directo a Periférico. Para inversión de renta, la presencia universitaria de la zona mantiene una demanda constante todo el año.\n\nEl departamento tiene 94 m² con dos recámaras en suite, sala-comedor con salida a terraza y cocina integral equipada. El edificio ofrece gimnasio, roof garden, salón de eventos, seguridad 24/7 y áreas comunes accesibles. Incluye cajón de estacionamiento y bodega."),

dict(id="GF-1274", titulo="Local comercial en Insurgentes Mixcoac a pie de avenida",
     operacion="renta", tipo="local-comercial", colonia="insurgentes-mixcoac", precio=48_000, mantenimiento=0,
     calle="Insurgentes Sur", rec=0, ban=2, medios=0, est=2, m2c=140, m2t=0, antig=14, piso=0, niveles=1,
     estado_inm="excelente",
     amenidades=["seguridad","accesibilidad","estacionamiento-visitas","cisterna"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Local a pie de calle sobre Insurgentes Sur, con 12 metros de frente y escaparate continuo. El aforo peatonal de esta cuadra es de los más altos del corredor por la cercanía con la estación de Metrobús y con Plaza Mixcoac.\n\nSon 140 m² en planta libre con altura de 4.2 metros, lo que permite entrepiso si el giro lo requiere. Incluye dos baños, uno de ellos accesible, y un área de bodega al fondo con acceso independiente.\n\nUso de suelo comercial vigente para giros de servicios, alimentos y comercio al menudeo. Dos cajones de estacionamiento asignados. Se entrega en obra gris terminada; la adecuación corre por cuenta del arrendatario con posibilidad de negociar meses de gracia."),

# ======================================= SANTA FE (Cuajimalpa)
dict(id="GF-1288", titulo="Departamento en Santa Fe con amenidades completas",
     operacion="venta", tipo="departamento", colonia="santa-fe", precio=8_400_000, mantenimiento=6_800,
     calle="Vasco de Quiroga", rec=3, ban=3, medios=1, est=2, m2c=165, m2t=0, antig=6, piso=18, niveles=32,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","alberca","gimnasio","salon-eventos","roof-garden","terraza","bodega","cuarto-servicio","home-office","area-juegos","estacionamiento-visitas","planta-emergencia","accesibilidad"],
     badges=[], destacada=True, exclusiva=False,
     descripcion="Piso 18 con vista abierta hacia el poniente y hacia el Parque La Mexicana. En días despejados se alcanza a ver la sierra de las Cruces.\n\nSanta Fe funciona con una lógica de conjunto: la torre resuelve seguridad, amenidades y servicios, y el departamento se dedica a ser casa. Este tiene 165 m² con tres recámaras en suite, sala-comedor con salida a terraza, cocina integral con isla y cuarto de servicio con baño.\n\nLas amenidades del conjunto incluyen alberca techada, gimnasio, salón de eventos, área de juegos infantiles, terraza con asadores y seguridad perimetral 24/7. Dos cajones de estacionamiento continuos y bodega. A siete minutos de Centro Santa Fe y del corredor corporativo."),

dict(id="GF-1296", titulo="Departamento en renta en Santa Fe con vista al parque",
     operacion="renta", tipo="departamento", colonia="santa-fe", precio=38_000, mantenimiento=0,
     calle="Antonio Dovalí Jaime", rec=2, ban=2, medios=1, est=2, m2c=118, m2t=0, antig=4, piso=22, niveles=30,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","alberca","gimnasio","salon-eventos","terraza","bodega","amueblado","home-office","pet-friendly","estacionamiento-visitas","planta-emergencia"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Vista directa al Parque La Mexicana desde el piso 22. Es de las rentas mejor resueltas que tengo en el poniente para alguien que trabaja en el corredor corporativo de Santa Fe.\n\nEl departamento se renta semiamueblado: cocina totalmente equipada con línea blanca, clósets vestidor, cortinas y persianas instaladas. El resto del mobiliario puede negociarse con el propietario.\n\nDos recámaras en suite, sala-comedor con salida a terraza y un medio baño. Incluye dos cajones de estacionamiento, bodega y acceso completo a las amenidades de la torre: alberca, gimnasio, salón de eventos y seguridad 24 horas. Acepta mascotas con depósito adicional."),

# ======================================= SAN ÁNGEL / PEDREGAL / COYOACÁN
dict(id="GF-1305", titulo="Casa colonial en San Ángel con jardín",
     operacion="venta", tipo="casa", colonia="san-angel", precio=24_500_000, mantenimiento=0,
     calle="Frontera", rec=4, ban=4, medios=1, est=3, m2c=390, m2t=520, antig=68, piso=0, niveles=2,
     estado_inm="remodelado",
     amenidades=["jardin","terraza","bodega","cuarto-servicio","home-office","cisterna","asador","seguridad"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Una casa de mediados del siglo pasado sobre una calle empedrada de San Ángel, a cuatro cuadras de la Plaza San Jacinto. Tiene muros de piedra volcánica, techos de viguería y un patio central con fuente que organiza toda la planta baja.\n\nLa remodelación se hizo hace seis años respetando el carácter original. Se conservaron pisos de barro, herrería y carpintería de madera; se renovaron instalaciones, cocina y baños con criterio contemporáneo pero materiales compatibles.\n\nCuatro recámaras en la planta alta, todas con vista al jardín o al patio. Estudio independiente con chimenea, cuarto de servicio con baño y cochera techada para tres autos. La propiedad está catalogada, lo que implica reglas específicas para intervenciones futuras que puedo explicarte con detalle."),

dict(id="GF-1313", titulo="Casa de autor en Jardines del Pedregal",
     operacion="venta", tipo="casa", colonia="pedregal", precio=48_000_000, mantenimiento=0,
     calle="Fuego", rec=5, ban=5, medios=2, est=5, m2c=680, m2t=1_450, antig=9, piso=0, niveles=2,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","alberca","terraza","bodega","cuarto-servicio","home-office","cisterna","asador","planta-emergencia","estacionamiento-visitas","gimnasio"],
     badges=["exclusiva"], destacada=True, exclusiva=True,
     descripcion="Obra de autor construida hace nueve años sobre 1,450 m² de roca volcánica, respetando la topografía original del terreno en lugar de aplanarla. Los muros de piedra del Pedregal se integraron al proyecto y funcionan como límite del jardín.\n\nLa casa se organiza en dos volúmenes conectados por un puente acristalado. El primero aloja el área social: sala de doble altura con muro de piedra volcánica, comedor para catorce y cocina con isla y despensa. El segundo contiene las cinco recámaras, todas en suite y con vista al jardín.\n\nHay además gimnasio, bodega, cava, cuarto de servicio con dos habitaciones y cochera techada para cinco autos. Alberca climatizada con área de asoleadero y sistema de captación pluvial. Es una propiedad de inventario muy limitado en la zona."),

dict(id="GF-1327", titulo="Casa en Coyoacán con jardín en calle arbolada",
     operacion="venta", tipo="casa", colonia="coyoacan", precio=13_800_000, mantenimiento=0,
     calle="Francisco Sosa", rec=4, ban=3, medios=1, est=2, m2c=310, m2t=420, antig=52, piso=0, niveles=2,
     estado_inm="excelente",
     amenidades=["jardin","terraza","bodega","cuarto-servicio","home-office","cisterna","asador","pet-friendly"],
     badges=[], destacada=True, exclusiva=False,
     descripcion="Sobre una de las calles más caminadas de Coyoacán, a ocho minutos del Jardín Centenario y a cinco de los Viveros. Es una casa de los años setenta, bien mantenida, con jardín posterior de 130 m² y un fresno grande que da sombra a la terraza.\n\nLa planta baja tiene sala con chimenea, comedor, cocina con antecomedor y un estudio que se puede usar como quinta recámara. Todo el nivel se comunica con el jardín a través de puertas corredizas.\n\nArriba están las cuatro recámaras, la principal con vestidor y baño propio. Hay cuarto de servicio con baño completo y cochera techada para dos autos. Coyoacán es de las pocas zonas de la ciudad donde todavía se compra casa con jardín sin salirse del área central."),

dict(id="GF-1334", titulo="Casa en condominio en Coyoacán con seguridad privada",
     operacion="renta", tipo="casa-en-condominio", colonia="coyoacan", precio=52_000, mantenimiento=0,
     calle="Miguel Ángel de Quevedo", rec=3, ban=3, medios=1, est=2, m2c=240, m2t=180, antig=11, piso=0, niveles=3,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","terraza","roof-garden","bodega","cuarto-servicio","home-office","pet-friendly","estacionamiento-visitas","asador"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Casa en condominio horizontal de solo seis unidades, con caseta de vigilancia y acceso controlado. Es una buena opción para familias que quieren formato de casa con la seguridad de un condominio.\n\nTres niveles bien aprovechados. Planta baja con sala, comedor, cocina integral y jardín privado de 60 m². Nivel intermedio con tres recámaras, la principal en suite con vestidor. Nivel superior con family room, medio baño y roof garden con asador.\n\nIncluye cuarto de servicio con baño, bodega y dos cajones de estacionamiento techados dentro del condominio. Acepta mascotas. A siete minutos del Metro Viveros y de Insurgentes."),

# ======================================= INVERSIÓN / DESARROLLOS
dict(id="GF-1348", titulo="Desarrollo en preventa en Escandón — 24 unidades",
     operacion="venta", tipo="desarrollo", colonia="escandon", precio=4_650_000, mantenimiento=2_800,
     calle="Prosperidad", rec=2, ban=2, medios=0, est=1, m2c=78, m2t=0, antig=0, piso=0, niveles=7,
     estado_inm="nuevo",
     amenidades=["seguridad","elevador","roof-garden","gimnasio","terraza","bodega","home-office","pet-friendly","estacionamiento-visitas","asador","accesibilidad"],
     badges=["preventa","nueva"], destacada=True, exclusiva=True,
     descripcion="Desarrollo de 24 unidades en Escandón, con inicio de obra este trimestre y entrega proyectada a 20 meses. Tengo asignación directa de unidades con el desarrollador, lo que permite acceder al primer nivel de precio de preventa.\n\nLas tipologías van de 62 a 98 m², de una y dos recámaras. Todas incluyen cocina integral, clósets, un cajón de estacionamiento y bodega. Las unidades de los niveles 6 y 7 tienen terraza privada.\n\nEl edificio contempla gimnasio, roof garden con asadores, coworking y acceso controlado. En preventa, el diferencial histórico en esta zona entre precio de lanzamiento y precio de entrega ha estado entre 12 y 18 por ciento. Puedo compartirte el esquema de pagos y el análisis de comparables de la zona antes de que decidas."),

dict(id="GF-1356", titulo="Departamento de inversión en Roma Norte con renta vigente",
     operacion="venta", tipo="departamento", colonia="roma-norte", precio=6_400_000, mantenimiento=3_100,
     calle="Tabasco", rec=1, ban=1, medios=1, est=1, m2c=72, m2t=0, antig=6, piso=6, niveles=8,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","roof-garden","gimnasio","balcon","bodega","home-office","pet-friendly","amueblado"],
     badges=["oportunidad"], destacada=True, exclusiva=False,
     descripcion="Se vende con inquilino y contrato vigente hasta mayo del próximo año, a 29,500 pesos mensuales. Para un inversionista que quiere flujo desde el día uno, esto elimina el periodo de colocación.\n\nSetenta y dos metros de una recámara, en un edificio de seis años con gimnasio y roof garden. La unidad está amueblada y el mobiliario se incluye en la operación, lo que sostiene el nivel de renta actual.\n\nCon precio de lista, mantenimiento y predial considerados, el rendimiento neto proyectado ronda el 4.3 por ciento anual, más la plusvalía de Roma Norte. Los estudios de una recámara son el producto más líquido de la colonia: la vacancia promedio en los últimos dos años ha estado por debajo de tres semanas."),

dict(id="GF-1362", titulo="Terreno con uso de suelo habitacional en Coyoacán",
     operacion="venta", tipo="terreno", colonia="coyoacan", precio=9_600_000, mantenimiento=0,
     calle="Melchor Ocampo", rec=0, ban=0, medios=0, est=0, m2c=0, m2t=480, antig=0, piso=0, niveles=0,
     estado_inm="por-remodelar",
     amenidades=["cisterna"],
     badges=["oportunidad"], destacada=False, exclusiva=False,
     descripcion="Terreno de 480 m² con frente de 16 metros, en una calle interior de Coyoacán a diez minutos caminando del Jardín Centenario. Actualmente hay una construcción antigua sin valor comercial que se entrega demolida.\n\nEl uso de suelo vigente es habitacional con posibilidad de hasta tres niveles y dos viviendas, según el certificado único de zonificación que está disponible para revisión. El terreno es plano, con topografía regular y todos los servicios a pie de calle.\n\nEs una oportunidad poco común: los terrenos disponibles en el centro de Coyoacán son escasos y rara vez superan los 300 m². Puedo conectarte con despachos que han desarrollado proyectos similares en la zona si quieres evaluar números de obra."),

dict(id="GF-1371", titulo="Departamento con home office en Del Valle Norte",
     operacion="venta", tipo="departamento", colonia="del-valle", precio=5_850_000, mantenimiento=3_200,
     calle="Adolfo Prieto", rec=2, ban=2, medios=0, est=1, m2c=104, m2t=0, antig=10, piso=5, niveles=8,
     estado_inm="excelente",
     amenidades=["seguridad","elevador","balcon","home-office","bodega","pet-friendly","roof-garden","estacionamiento-visitas"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Diseñado con un estudio independiente de 11 m² con ventana propia, que es exactamente lo que buscan quienes trabajan desde casa y no quieren improvisar un escritorio en la recámara.\n\nEl resto de la planta es eficiente: sala-comedor con balcón, cocina integral abierta con barra, dos recámaras con clóset y dos baños completos. Piso de porcelanato en área social y duela en recámaras.\n\nEl edificio tiene diez años, roof garden común, seguridad 24 horas y estacionamiento de visitas. Incluye un cajón y bodega. Del Valle Norte te deja a siete minutos del Metrobús sobre Insurgentes y a diez del Parque Hundido."),

dict(id="GF-1394", titulo="Casa en condominio en San Ángel con roof garden",
     operacion="venta", tipo="casa-en-condominio", colonia="san-angel", precio=16_900_000, mantenimiento=4_500,
     calle="Altavista", rec=3, ban=3, medios=1, est=2, m2c=280, m2t=160, antig=8, piso=0, niveles=3,
     estado_inm="excelente",
     amenidades=["seguridad","jardin","terraza","roof-garden","bodega","cuarto-servicio","home-office","asador","estacionamiento-visitas","pet-friendly","cisterna"],
     badges=[], destacada=False, exclusiva=False,
     descripcion="Casa en condominio de ocho unidades sobre Altavista, con caseta de vigilancia y acceso controlado. Combina la privacidad de una casa con la seguridad y el mantenimiento compartido de un condominio.\n\nTres niveles. Planta baja con sala de doble altura, comedor, cocina integral con isla y patio-jardín privado. Nivel intermedio con tres recámaras en suite, la principal con vestidor y terraza. Nivel superior con family room y roof garden con asador y vista al arbolado de San Ángel.\n\nIncluye cuarto de servicio con baño, bodega y dos cajones de estacionamiento techados. El Bazar del Sábado y la oferta gastronómica de Avenida de la Paz están a ocho minutos caminando."),
]
