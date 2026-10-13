import { fileURLToPath } from 'node:url';
import { unstable_startWorker } from 'wrangler';
import { b64url } from '../src/push.js';

const config = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

// Yerel .dev.vars testleri etkilemesin; buradaki değerler onun önüne geçer.
export async function startWorker({ presenceMs, vars = {} } = {}) {
  const plain = (value) => ({ type: 'plain_text', value: String(value) });
  const bindings = Object.fromEntries(Object.entries({ PRESENCE_MS: presenceMs, VAPID_KEY: '', ...vars }).filter(([, v]) => v != null).map(([k, v]) => [k, plain(v)]));
  const worker = await unstable_startWorker({
    config,
    bindings,
    dev: { server: { port: 0 }, inspector: false, persist: false, logLevel: 'none', watch: false },
  });
  const base = String(await worker.url).replace(/\/$/, '');
  return { base, dispose: () => worker.dispose() };
}

export const sampleState = (extra = {}) => ({
  version: 1,
  name: 'Test',
  players: [{ id: 'p1', name: 'Ali' }],
  teams: [
    { id: 'A', name: 'Kırmızılar', color: 'red', playerIds: ['p1'] },
    { id: 'B', name: 'Maviler', color: 'blue', playerIds: [] },
    { id: 'C', name: 'Sarılar', color: 'yellow', playerIds: [] },
  ],
  settings: {},
  started: true,
  matches: [],
  lots: {},
  ...extra,
});

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

export async function waitFor(check, label = 'koşul', timeout = 4000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Zaman aşımı: ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

export async function newVapidSecret() {
  const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const { x, y, d } = await crypto.subtle.exportKey('jwk', privateKey);
  return JSON.stringify({ x, y, d });
}

// Tarayıcının yaptığı gibi bir abonelik anahtarı üretir ve gelen push'u çözer.
export async function pushClient() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const hkdf = async (salt, ikm, info, length) => {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
  };
  const text = new TextEncoder();
  return {
    keys: { p256dh: b64url.encode(p256dh), auth: b64url.encode(auth) },
    async decrypt(body) {
      const salt = body.slice(0, 16);
      const idLength = body[20];
      const asPublic = body.slice(21, 21 + idLength);
      const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, pair.privateKey, 256));
      const info = new Uint8Array([...text.encode('WebPush: info\0'), ...p256dh, ...asPublic]);
      const ikm = await hkdf(auth, shared, info, 32);
      const cek = await hkdf(salt, ikm, text.encode('Content-Encoding: aes128gcm\0'), 16);
      const nonce = await hkdf(salt, ikm, text.encode('Content-Encoding: nonce\0'), 12);
      const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, body.slice(21 + idLength)));
      return new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2)));
    },
  };
}
