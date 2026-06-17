// Thin wrapper over Culqi.js tokenization.
//
// Real flow: Culqi.js (loaded with the public key) opens its secure form and
// returns a card/Yape token, which we send to the API to create the charge.
//
// For e2e tests, set `window.__CULQI_TEST_TOKEN__` to a stub token so the buy
// flow can run end-to-end without the external script.

interface CulqiInstance {
  publicKey: string;
  token?: { id: string };
  open(opts: { title: string; currency: string; description: string; amount: number }): void;
}

declare global {
  interface Window {
    __CULQI_TEST_TOKEN__?: string;
    Culqi?: unknown;
    culqi?: () => void;
  }
}

export async function getCulqiToken(amount: number = 0): Promise<string> {
  if (typeof window !== 'undefined' && window.__CULQI_TEST_TOKEN__) {
    return window.__CULQI_TEST_TOKEN__;
  }

  const culqi = (window as Window & { Culqi?: CulqiInstance }).Culqi;
  if (!culqi) throw new Error('Culqi.js no está cargado');

  return new Promise((resolve, reject) => {
    (window as Window & { culqi?: () => void }).culqi = () => {
      const token = culqi.token?.id;
      if (token) resolve(token);
      else reject(new Error('Token cancelado'));
    };
    culqi.open({
      title: 'RetroGroove',
      currency: 'PEN',
      description: 'Entradas RetroGroove',
      amount,
    });
  });
}
