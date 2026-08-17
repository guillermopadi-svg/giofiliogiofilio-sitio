/* ==========================================================================
   Gio Filio — Configuración del sitio
   Edita este archivo para conectar servicios externos. No requiere build.
   ========================================================================== */
window.GF_CONFIG = {

  /* --- Google Maps -------------------------------------------------------
     Pega aquí tu API key para activar el mapa real (Maps JavaScript API).
     Mientras esté vacío, el sitio usa un mapa esquemático de respaldo que
     muestra todos los pines con precio, sin costo ni dependencias.
     Consola: https://console.cloud.google.com/google/maps-apis            */
  googleMapsKey: "",

  /* --- WhatsApp ---------------------------------------------------------- */
  whatsapp: "5215562255840",

  /* --- Analítica ---------------------------------------------------------
     Al declarar estos IDs, agrega los snippets de GTM/GA4 en el <head>.
     Todos los eventos ya se envían a window.dataLayer.                      */
  gtmId: "",          // ej. "GTM-XXXXXXX"
  ga4Id: "",          // ej. "G-XXXXXXXXXX"
  metaPixelId: "",    // ej. "1234567890"
  googleAdsId: "",    // ej. "AW-XXXXXXXXX"

  /* --- CRM ---------------------------------------------------------------
     Define window.gfSendToCRM(lead) para enviar cada lead a HubSpot u otro
     sistema. Ejemplo en README.md § Integración con CRM.                    */
  crmEndpoint: "",

  debug: false
};
