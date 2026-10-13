// Gol bildirimleri için VAPID anahtarı: node vapid-key.js | npx wrangler secret put VAPID_KEY
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const { x, y, d } = await crypto.subtle.exportKey('jwk', privateKey);
console.log(JSON.stringify({ x, y, d }));
