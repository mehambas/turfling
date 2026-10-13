import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { goalNotices } from '../src/goals.js';
import { b64url, encrypt, publicKeyOf, toSubscription, vapidAuthorization, vapidKeys } from '../src/push.js';
import { newVapidSecret, sampleState } from './helpers.js';

const join = (s) => s.replace(/\s+/g, '');

// RFC 8291, Bölüm 5 ve Ek A.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPublic: join('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: join('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  header: join('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8'),
  cipher: join('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ'),
};

async function rfcServerKeys() {
  const raw = b64url.decode(RFC.asPublic);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url.encode(raw.slice(1, 33)), y: b64url.encode(raw.slice(33)) };
  return {
    publicKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await crypto.subtle.importKey('jwk', { ...jwk, d: RFC.asPrivate }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  };
}

describe('şifreleme', () => {
  test("RFC 8291'deki örnekle aynı sonucu verir", async () => {
    const body = await encrypt(RFC.plaintext, { p256dh: RFC.uaPublic, auth: RFC.auth }, { salt: b64url.decode(RFC.salt), serverKeys: await rfcServerKeys() });
    assert.equal(b64url.encode(body.slice(0, 86)), RFC.header);
    assert.equal(b64url.encode(body.slice(86)), RFC.cipher);
  });
});

describe('VAPID', () => {
  test('imza açık anahtarla doğrulanır; hedef, süre ve iletişim adresi doğru', async () => {
    const secret = await newVapidSecret();
    const now = Date.UTC(2026, 9, 13, 12);
    const header = await vapidAuthorization('https://web.push.apple.com/QGuQ', await vapidKeys(secret), 'https://hali-saha.example', now);
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    assert.equal(k, publicKeyOf(secret));

    const [head, claims, sig] = jwt.split('.');
    assert.deepEqual(JSON.parse(new TextDecoder().decode(b64url.decode(head))), { typ: 'JWT', alg: 'ES256' });
    assert.deepEqual(JSON.parse(new TextDecoder().decode(b64url.decode(claims))), {
      aud: 'https://web.push.apple.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'https://hali-saha.example',
    });
    const pub = await crypto.subtle.importKey('raw', b64url.decode(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64url.decode(sig), new TextEncoder().encode(`${head}.${claims}`)));
  });
});

describe('abonelik', () => {
  const keys = { p256dh: RFC.uaPublic, auth: RFC.auth };

  test('bilinen push servisleri kabul edilir, fazlalık alanlar atılır', () => {
    for (const endpoint of [
      'https://web.push.apple.com/QGuQyavXut',
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
      'https://wns2-par02p.notify.windows.com/w/?token=x',
    ]) {
      assert.deepEqual(toSubscription({ endpoint, expirationTime: null, keys: { ...keys, extra: 1 } }), { endpoint, keys }, endpoint);
    }
  });

  test('başka adresler, düz http ve bozuk anahtarlar reddedilir', () => {
    const bad = [
      { endpoint: 'https://example.com/push', keys },
      { endpoint: 'https://push.apple.com.evil.example/x', keys },
      { endpoint: 'http://web.push.apple.com/x', keys },
      { endpoint: 'nicht-url', keys },
      { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: RFC.uaPublic } },
      { endpoint: 'https://web.push.apple.com/x', keys: { ...keys, p256dh: RFC.auth } },
      { endpoint: 'https://web.push.apple.com/x', keys: { ...keys, auth: RFC.uaPublic } },
      { endpoint: 'https://web.push.apple.com/x', keys: { ...keys, auth: '%%%' } },
      null,
    ];
    for (const body of bad) assert.equal(toSubscription(body), null, JSON.stringify(body));
  });

  test('test sunucusunun adresi yalnız açıkça izin verilirse geçer', () => {
    const body = { endpoint: 'http://127.0.0.1:4321/sub/1', keys };
    assert.equal(toSubscription(body), null);
    assert.deepEqual(toSubscription(body, 'http://127.0.0.1:4321'), body);
  });
});

describe('gol bildirimleri', () => {
  const players = [
    { id: 'p1', name: 'Ali' },
    { id: 'p2', name: 'Veli' },
  ];
  const state = (goals, extra = {}) =>
    sampleState({ players, matches: [{ id: 'm1', home: 'A', away: 'B', status: 'live', goals, ...extra }] });
  const g1 = { id: 'g1', team: 'A', playerId: 'p1' };
  const g2 = { id: 'g2', team: 'B', playerId: null };

  test('yeni gol: golcü, takım ve o anki skor', () => {
    assert.deepEqual(goalNotices(state([]), state([g1])), [{ title: 'Gol! Kırmızılar', body: 'Ali · Kırmızılar 1–0 Maviler' }]);
    assert.deepEqual(goalNotices(state([g1]), state([g1, g2])), [{ title: 'Gol! Maviler', body: 'Kırmızılar 1–1 Maviler' }]);
  });

  test('kendi kalesine gol: oyuncunun yanında belirtilir', () => {
    const own = { id: 'g3', team: 'A', playerId: 'p2', ownGoal: true };
    assert.deepEqual(goalNotices(state([]), state([own])), [{ title: 'Gol! Kırmızılar', body: 'Veli (kendi kalesine) · Kırmızılar 1–0 Maviler' }]);
  });

  test('aynı anda gelen iki gol sırayla, ara skorlarıyla bildirilir', () => {
    assert.deepEqual(
      goalNotices(state([]), state([g1, g2])).map((n) => n.body),
      ['Ali · Kırmızılar 1–0 Maviler', 'Kırmızılar 1–1 Maviler'],
    );
  });

  test('yayının ilk hâli, bilinen goller ve canlı olmayan maçlar bildirilmez', () => {
    assert.deepEqual(goalNotices(null, state([g1])), []);
    assert.deepEqual(goalNotices(state([g1]), state([g1])), []);
    assert.deepEqual(goalNotices(state([g1]), state([{ ...g1, playerId: 'p2' }])), []);
    assert.deepEqual(goalNotices(state([], { status: 'done' }), state([g1], { status: 'done' })), []);
  });

  test('eksik ya da bozuk veride çökmez', () => {
    const broken = sampleState({ matches: [null, { status: 'live', goals: [null, { id: 'x', team: 'Z' }] }, { status: 'live' }] });
    assert.deepEqual(goalNotices(sampleState(), broken), []);
  });
});
