// Web Push: içerik RFC 8291'e göre şifrelenir, sunucu kendini VAPID (RFC 8292) ile tanıtır.
const text = new TextEncoder();

// Abonelik adresine sunucu istek atar; yalnız bilinen push servislerine izin verilir.
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
const RECORD_SIZE = 4096;

export const b64url = {
  encode: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode(value) {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  },
};

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function tryDecode(value) {
  try {
    return b64url.decode(value);
  } catch {
    return null;
  }
}

export function toSubscription(body, extraOrigin) {
  const endpoint = body?.endpoint;
  const keys = body?.keys;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const known = url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname));
  if (!known && !(extraOrigin && url.origin === extraOrigin)) return null;
  const p256dh = tryDecode(keys.p256dh);
  const auth = tryDecode(keys.auth);
  if (p256dh?.length !== 65 || p256dh[0] !== 4 || auth?.length !== 16) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function publicKeyOf(secret) {
  const { x, y } = JSON.parse(secret);
  return b64url.encode(concat([4], b64url.decode(x), b64url.decode(y)));
}

export async function vapidKeys(secret) {
  const { x, y, d } = JSON.parse(secret);
  const privateKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { privateKey, publicKey: publicKeyOf(secret) };
}

export async function vapidAuthorization(endpoint, vapid, subject, now = Date.now()) {
  const part = (obj) => b64url.encode(text.encode(JSON.stringify(obj)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.privateKey, text.encode(unsigned));
  return `vapid t=${unsigned}.${b64url.encode(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

export async function encrypt(payload, keys, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys = null } = {}) {
  const uaPublic = b64url.decode(keys.p256dh);
  const own = serverKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', own.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, own.privateKey, 256));

  const ikm = await hkdf(b64url.decode(keys.auth), shared, concat(text.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, text.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, text.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(text.encode(payload), [2])));

  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

// Gol bildirimi birkaç dakika sonra artık haber değildir; telefon o sürede çevrimdışıysa hiç gelmesin.
export async function sendPush(subscription, payload, vapid, { subject, ttl = 300 }) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuthorization(subscription.endpoint, vapid, subject),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(ttl),
      urgency: 'high',
    },
    body: await encrypt(payload, subscription.keys),
  });
  await res.body?.cancel();
  return res.status;
}
