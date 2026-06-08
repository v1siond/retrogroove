// Thin wrapper over Culqi.js tokenization.
//
// Real flow: Culqi.js (loaded with the public key) opens its secure form and
// returns a card/Yape token, which we send to the API to create the charge.
//
// For e2e tests, set `window.__CULQI_TEST_TOKEN__` to a stub token so the buy
// flow can run end-to-end without the external script.

declare global {
  interface Window {
    __CULQI_TEST_TOKEN__?: string;
    Culqi?: unknown;
  }
}

export async function getCulqiToken(): Promise<string> {
  if (typeof window !== 'undefined' && window.__CULQI_TEST_TOKEN__) {
    return window.__CULQI_TEST_TOKEN__;
  }

  // Production tokenization is wired here once the Culqi public key is configured
  // (NEXT_PUBLIC_CULQI_PUBLIC_KEY) and the Culqi.js script is loaded.
  throw new Error('Culqi.js no está configurado');
}
