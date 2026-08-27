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
  googleMapsKey: "AIzaSyC4QYbTXnHFZ6jj4Ns3y2y3_uwUnn7TNSI",

  /* --- WhatsApp ---------------------------------------------------------- */
  whatsapp: "5215544876074",

  /* --- Analítica ---------------------------------------------------------
     Al declarar estos IDs, agrega los snippets de GTM/GA4 en el <head>.
     Todos los eventos ya se envían a window.dataLayer.                      */
  gtmId: "GTM-PSM7N783",
  ga4Id: "",          // ej. "G-XXXXXXXXXX"
  metaPixelId: "",    // ej. "1234567890"
  googleAdsId: "",    // ej. "AW-XXXXXXXXX"

  /* --- CRM / n8n -----------------------------------------------------------
     Cada lead capturado en el sitio (formularios de contacto, valuación,
     vender, ficha de propiedad) se envía aquí. api/leads.js lo recibe,
     valida y lo reenvía al webhook de n8n (variable de entorno
     N8N_LEADS_WEBHOOK_URL en Vercel) para guardarlo en Google Sheets,
     avisarle a Gio por WhatsApp y mandar un correo de confirmación.        */
  crmEndpoint: "/api/leads",

  debug: false
};

window.gfSendToCRM = async function (lead) {
  await fetch(window.GF_CONFIG.crmEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
};
