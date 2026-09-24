# -*- coding: utf-8 -*-
"""Gio Filio — Propiedades con landing individual.

Cada registro de LANDINGS genera:
  · una página propia en  propiedades/{slug}/
  · la tarjeta en el home (sección "Propiedades destacadas") si featured=True
  · la tarjeta en el buscador /propiedades/ (vía assets/data/gio-data.js)
  · la entrada en el sitemap

Para agregar otra propiedad: copia el registro, cambia los datos y sube sus
imágenes a assets/img/propiedades/{slug}/. No hay que tocar plantillas.
Las imágenes se referencian SIN extensión: el generador espera que existan
{nombre}.jpg/.webp, {nombre}-card.* y {nombre}-thumb.*  (el plano solo .jpg/.webp).

Nunca inventar datos: si no hay precio, priceOnRequest=True.
El modelo está pensado para migrar después a un CMS o API sin cambiar la plantilla.
"""

_IMG = "assets/img/propiedades/espacio-santa-fe-piso-18/"

LANDINGS = [
    {
        "id": "GF-ESF-P18",
        "slug": "oficina-espacio-santa-fe-piso-18",
        "title": "Espacio Santa Fe — Piso 18",
        "subtitle": "Oficina corporativa Clase A+ en Santa Fe",
        "propertyType": "oficina",          # clave de data_props.TIPOS
        "operation": "venta-renta",         # venta | renta | venta-renta
        "featured": True,
        "status": "disponible",             # disponible | publicado | oculto (oculto no se genera)
        "price": None,
        "currency": "MXN",
        "priceOnRequest": True,
        "address": "Carretera México–Toluca 5420",
        "neighborhood": "El Yaqui",
        "neighborhoodSlug": "santa-fe",     # colonia curada del sitio (data_zonas)
        "borough": "Cuajimalpa de Morelos",
        "boroughSlug": "cuajimalpa-de-morelos",
        "city": "Ciudad de México",
        "state": "Ciudad de México",
        "postalCode": "05320",
        # Coordenadas del pin oficial de Google Maps del inmueble.
        "latitude": 19.3629937,
        "longitude": -99.2813264,
        "mapsUrl": "https://maps.app.goo.gl/UDDjS5EpSJn63K547",
        "surface": 1099.44,
        "parkingSpaces": 36,
        "floor": 18,
        "privateOffices": 18,
        "privateOfficesWithBathroom": 3,
        "meetingRooms": 1,
        "trainingRooms": 1,
        "elevators": 8,
        "bathrooms": "Baños privados para hombres y mujeres, más baños en áreas comunes",
        "certification": "LEED Gold",
        "buildingClass": "Clase A+",
        "seoTitle": "Oficina en Venta y Renta en Santa Fe | 1,099 m² | Gio Filio",
        "seoDescription": ("Oficina corporativa acondicionada de 1,099.44 m² en Santa Fe, CDMX. "
                           "Piso 18, 36 estacionamientos, 18 privados y certificación LEED Gold. "
                           "Agenda una visita con Gio Filio."),
        "whatsappMessage": ("Hola Gio, me interesa la oficina Espacio Santa Fe Piso 18 de 1,099.44 m². "
                            "Quisiera recibir más información."),
        "intro": "Un piso completo, ya acondicionado, en el corazón corporativo de Santa Fe.",
        "description": [
            "Espacio Santa Fe Piso 18 es una oficina corporativa acondicionada de 1,099.44 m² en un edificio "
            "Clase A+ con certificación LEED Gold. Ocupa un piso completo, con la distribución ya resuelta y "
            "vistas panorámicas de la ciudad.",
            "La planta combina 18 privados, tres de ellos con baño propio, una sala de juntas, una sala de "
            "capacitación, comedor propio y un cuarto habilitado para site. Tu equipo cuenta con baños privados "
            "para hombres y mujeres, además de los baños de las áreas comunes.",
            "El edificio da acceso al piso mediante 8 elevadores y la renta o compra incluye 36 cajones de "
            "estacionamiento. Se ofrece en venta y en renta.",
            "El precio se comparte de forma directa. Escríbeme o agenda una visita y te doy las condiciones "
            "actualizadas para tu empresa.",
        ],
        "features": [
            "Oficina corporativa acondicionada",
            "Edificio Clase A+ con certificación LEED Gold",
            "Piso 18 con vistas panorámicas",
            "18 privados, 3 de ellos con baño propio",
            "1 sala de juntas y 1 sala de capacitación",
            "Comedor propio",
            "Cuarto habilitado para site",
            "Baños privados para hombres y mujeres",
            "Baños en áreas comunes",
            "8 elevadores con acceso al piso",
            "36 cajones de estacionamiento incluidos",
        ],
        "distribution": [
            ("users", "18 privados"),
            ("bath", "3 privados con baño propio"),
            ("meet", "1 sala de juntas"),
            ("train", "1 sala de capacitación"),
            ("dining", "Comedor propio"),
            ("site", "Cuarto habilitado para site"),
            ("bath", "Baños privados hombres y mujeres"),
        ],
        "accessibility": [
            "Acceso desde Vasco de Quiroga",
            "Acceso desde Vista Hermosa",
            "Acceso desde la Carretera México–Toluca",
        ],
        "heroImage": _IMG + "01-vista-panoramica-piso-18",
        # Slides del hero: (imagen, texto alterno, etiqueta, texto del botón, destino)
        # El botón secundario del hero cambia con cada slide.
        "heroSlides": [
            (_IMG + "01-vista-panoramica-piso-18", "Vista panorámica de la ciudad desde el piso 18 de Espacio Santa Fe", "Vista panorámica", "Ver galería", "#galeria"),
            (_IMG + "02-torre-espacio-santa-fe", "Torre Espacio Santa Fe, edificio corporativo Clase A+ en Santa Fe, CDMX", "Edificio Clase A+", "Ver ubicación", "#ubicacion"),
            (_IMG + "03-planta-abierta-privados-vidrio", "Planta de oficina con privados de cristal en Espacio Santa Fe Piso 18", "Planta con privados de cristal", "Ver distribución", "#distribucion"),
            (_IMG + "07-privado-vista", "Privado con ventanales y vista a la ciudad en Santa Fe", "Privados con vista", "Agendar visita", "#agendar"),
        ],
        # (base sin extensión, texto alternativo)
        "gallery": [
            (_IMG + "01-vista-panoramica-piso-18", "Vista panorámica de la ciudad desde el piso 18 de Espacio Santa Fe"),
            (_IMG + "02-torre-espacio-santa-fe", "Torre Espacio Santa Fe, edificio corporativo Clase A+ en Santa Fe, CDMX"),
            (_IMG + "03-planta-abierta-privados-vidrio", "Planta de oficina con privados de cristal en Espacio Santa Fe Piso 18"),
            (_IMG + "04-planta-abierta-nucleo", "Planta abierta de la oficina corporativa en Santa Fe"),
            (_IMG + "05-privados-vidrio-pasillo", "Pasillo de privados con cristal templado en oficina de Santa Fe"),
            (_IMG + "06-pasillo-privados", "Circulación principal con privados de cristal, Espacio Santa Fe Piso 18"),
            (_IMG + "07-privado-vista", "Privado con ventanales y vista a la ciudad en Santa Fe"),
            (_IMG + "08-comedor-area-servicio", "Área de servicio y cocineta de la oficina en Espacio Santa Fe"),
            (_IMG + "09-privado-alfombra-vista", "Privado alfombrado con ventanal panorámico en Santa Fe"),
            (_IMG + "10-sala-capacitacion", "Sala amplia de trabajo o capacitación en oficina de Santa Fe"),
        ],
        "floorPlans": [
            (_IMG + "plano-piso-18", "Plano arquitectónico del piso 18 de Espacio Santa Fe con privados, sala de capacitación, comedor, baños y site"),
        ],
        "publicado": "2026-09-24",
        "actualizado": "2026-09-24",
    },
]
