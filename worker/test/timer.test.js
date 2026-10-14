import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { timerAlerts, timerNotice } from '../src/timer.js';
import { sampleState } from './helpers.js';

const MIN = 60 * 1000;

const match = (extra = {}) => ({
  id: 'L1',
  stage: 'league',
  home: 'A',
  away: 'B',
  status: 'live',
  goals: [],
  durationMin: 12,
  elapsedMs: 0,
  runningSince: 1000,
  ...extra,
});
const state = (...matches) => sampleState({ settings: { leagueMin: 12, finalMin: 15 }, matches });

describe('süre uyarıları', () => {
  test('çalışan maç: son dakika ve bitiş, sunucu saatine çevrilmiş', () => {
    const { match: id, alerts } = timerAlerts(state(match({ elapsedMs: 2 * MIN })), 500);
    assert.equal(id, 'L1');
    assert.deepEqual(alerts, [
      { kind: 'last', at: 1500 + 9 * MIN, match: 'L1', key: 'L1:12:last' },
      { kind: 'end', at: 1500 + 10 * MIN, match: 'L1', key: 'L1:12:end' },
    ]);
  });

  test('süresi değişen maçta anahtar da değişir', () => {
    const { alerts } = timerAlerts(state(match({ durationMin: 13 })), 0);
    assert.deepEqual(
      alerts.map((a) => [a.key, a.at]),
      [
        ['L1:13:last', 1000 + 12 * MIN],
        ['L1:13:end', 1000 + 13 * MIN],
      ],
    );
  });

  test('süresi yazılmamış maçta aşamanın süresi geçerli', () => {
    const { alerts } = timerAlerts(state(match({ stage: 'final', durationMin: null })), 0);
    assert.equal(alerts[1].at, 1000 + 15 * MIN);
  });

  test('1 dakikalık maçta yalnız bitiş', () => {
    const { alerts } = timerAlerts(state(match({ durationMin: 1 })), 0);
    assert.deepEqual(
      alerts.map((a) => a.kind),
      ['end'],
    );
  });

  test('duraklatılmış maçta uyarı yok, maç yine de bilinir', () => {
    assert.deepEqual(timerAlerts(state(match({ runningSince: null })), 0), { match: 'L1', alerts: [] });
  });

  test('canlı maç yoksa ya da veri bozuksa uyarı yok', () => {
    const none = { match: null, alerts: [] };
    assert.deepEqual(timerAlerts(state(match({ status: 'done' })), 0), none);
    assert.deepEqual(timerAlerts(null, 0), none);
    assert.deepEqual(timerAlerts({ matches: 'x' }, 0), none);
    assert.deepEqual(timerAlerts(state(match({ durationMin: 'on iki' })), 0).alerts, []);
    assert.deepEqual(timerAlerts(state(match()), undefined).alerts, []);
  });
});

describe('süre uyarısı metni', () => {
  const goals = [
    { id: 'g1', team: 'A' },
    { id: 'g2', team: 'B' },
    { id: 'g3', team: 'A' },
  ];

  test('son dakika ve bitiş: o anki skorla, aynı maçın uyarısı bir öncekinin yerine', () => {
    const s = state(match({ goals }));
    assert.deepEqual(timerNotice(s, { kind: 'last', match: 'L1' }), { title: 'Son 1 dakika', body: 'Kırmızılar 2–1 Maviler', tag: 'sure-L1' });
    assert.equal(timerNotice(s, { kind: 'end', match: 'L1' }).title, 'Süre doldu');
  });

  test('maç bitmiş ya da silinmişse gönderilmez', () => {
    assert.equal(timerNotice(state(match({ status: 'done' })), { kind: 'end', match: 'L1' }), null);
    assert.equal(timerNotice(state(), { kind: 'end', match: 'L1' }), null);
    assert.equal(timerNotice(null, { kind: 'end', match: 'L1' }), null);
  });
});
