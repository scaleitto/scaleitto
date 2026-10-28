import "server-only";

// Meta's Graph API, shared by the Conversions API (pixels) and the WhatsApp Business API (customer messages).
// E2E_PIXEL_URL points it at a local fake server during the automated tests (never set it in production).
export const META_VERSION = "v25.0"; // Meta retires a version about two years after the next one ships: move it forward yearly

export const metaGraph = () => {
  const fake = process.env.E2E_PIXEL_URL;
  return `${fake ? `${fake}/meta` : "https://graph.facebook.com"}/${META_VERSION}`;
};
