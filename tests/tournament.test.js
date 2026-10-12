const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tournament.js');

const MIN = T.MINUTE;

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function at(h, m) {
  const d = new Date(2026, 9, 15);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function setup({ rounds = 2, playoff = true } = {}) {
  const s = T.createState();
  T.addPlayers(s, Array.from({ length: 15 }, (_, i) => `Oyuncu ${i + 1}`));
  T.applyDraw(s, seeded(1));
  s.settings.leagueRounds = rounds;
  s.settings.playoffEnabled = playoff;
  s.matches = T.generateMatches(s.settings);
  s.started = true;
  return s;
}

function play(state, id, home, away, pens) {
  const m = state.matches.find((x) => x.id === id);
  T.startMatch(state, m, 0);
  for (let i = 0; i < home; i++) T.addGoal(m, m.home, 0);
  for (let i = 0; i < away; i++) T.addGoal(m, m.away, 0);
  T.finishMatch(m, pens, 1);
  T.resolveKnockouts(state);
  return m;
}

const order = (s) => T.computeStandings(s).rows.map((r) => r.team);

test('lig fikstürü: her eşleşme devre başına bir kez, kimse üst üste 3 maç oynamaz', () => {
  const league = T.generateMatches({ ...T.DEFAULT_SETTINGS, leagueRounds: 3 }).filter((m) => m.stage === 'league');
  assert.equal(league.length, 9);
  const pairs = {};
  for (const m of league) {
    const key = [m.home, m.away].sort().join();
    pairs[key] = (pairs[key] || 0) + 1;
  }
  assert.deepEqual(pairs, { 'A,B': 3, 'A,C': 3, 'B,C': 3 });
  for (const id of T.TEAM_IDS) {
    let streak = 0;
    let max = 0;
    for (const m of league) {
      streak = m.home === id || m.away === id ? streak + 1 : 0;
      max = Math.max(max, streak);
    }
    assert.ok(max <= 2, `${id} üst üste ${max} maç oynuyor`);
  }
});

test('fikstür: 2 devre + playoff + final = 8 maç', () => {
  const ms = T.generateMatches(T.DEFAULT_SETTINGS);
  assert.deepEqual(ms.map((m) => m.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'PO', 'F']);
});

test('torbalı kura: her takıma her torbadan tam bir oyuncu düşer', () => {
  const s = T.createState();
  T.addPlayers(s, Array.from({ length: 15 }, (_, i) => `P${i}`));
  s.players.forEach((p, i) => {
    p.pot = Math.floor(i / 3) + 1;
  });
  for (let seed = 1; seed < 60; seed++) {
    const teams = T.drawTeams(s.players, seeded(seed));
    for (const id of T.TEAM_IDS) {
      const pots = teams[id].map((pid) => s.players.find((p) => p.id === pid).pot).sort();
      assert.deepEqual(pots, [1, 2, 3, 4, 5]);
    }
  }
});

test('kura: dengesiz oyuncu sayısında takımlar arasında en fazla 1 kişi fark olur', () => {
  const s = T.createState();
  T.addPlayers(s, Array.from({ length: 14 }, (_, i) => `P${i}`));
  s.players.forEach((p, i) => {
    p.pot = i < 4 ? 1 : i < 6 ? 2 : 0;
  });
  for (let seed = 1; seed < 60; seed++) {
    const sizes = Object.values(T.drawTeams(s.players, seeded(seed))).map((t) => t.length).sort();
    assert.deepEqual(sizes, [4, 5, 5]);
  }
});

test('oyuncu ekleme: boş satırları ve tekrar eden isimleri atlar', () => {
  const s = T.createState();
  assert.equal(T.addPlayers(s, ['Ahmet', ' ahmet ', '', 'İsmail', 'ismail']), 2);
});

test('puan durumu: galibiyet 3, beraberlik 1 puan', () => {
  const s = setup();
  play(s, 'L1', 2, 0);
  play(s, 'L2', 1, 1);
  play(s, 'L3', 3, 1);
  const rows = T.computeStandings(s).rows;
  assert.deepEqual(rows.map((r) => [r.team, r.pts, r.gd]), [['A', 4, 2], ['B', 3, 0], ['C', 1, -2]]);
  assert.deepEqual(rows[0].form, ['G', 'B']);
});

test('puan durumu: canlı maç anlık skorla tabloya yansır', () => {
  const s = setup();
  const m = s.matches[0];
  T.startMatch(s, m, 0);
  T.addGoal(m, m.away, 0);
  const rows = T.computeStandings(s).rows;
  assert.equal(rows[0].team, 'B');
  assert.ok(rows[0].live);
  assert.equal(T.computeStandings(s, { includeLive: false }).rows[0].pts, 0);
});

test('eşitlikte puan, averaj ve atılan gol aynıysa ikili maçlar belirler', () => {
  const s = setup();
  play(s, 'L1', 0, 1);
  play(s, 'L2', 0, 1);
  play(s, 'L3', 1, 0);
  play(s, 'L4', 0, 0);
  play(s, 'L5', 1, 0);
  play(s, 'L6', 1, 0);
  const { rows, unresolved } = T.computeStandings(s);
  assert.deepEqual(rows.map((r) => [r.team, r.pts, r.gd, r.gf]), [['B', 7, 1, 2], ['A', 7, 1, 2], ['C', 3, -2, 1]]);
  assert.deepEqual(unresolved, []);
});

test('tüm kriterlerde eşitlik kura ile çözülür; o zamana kadar eleme bekler', () => {
  const s = setup({ rounds: 1 });
  play(s, 'L1', 1, 0);
  play(s, 'L2', 1, 0);
  play(s, 'L3', 1, 0);
  assert.deepEqual(T.computeStandings(s).unresolved, [['A', 'B', 'C']]);
  assert.equal(T.blockingTies(s).length, 1);
  s.lots = { A: 0.9, B: 0.1, C: 0.5 };
  T.resolveKnockouts(s);
  assert.deepEqual(order(s), ['B', 'C', 'A']);
  assert.equal(T.blockingTies(s).length, 0);
  const po = s.matches.find((m) => m.id === 'PO');
  assert.deepEqual([po.home, po.away], ['C', 'A']);
});

test('2. ile 3. arasındaki eşitlik playoff açıkken önemsiz, kapalıyken bekletir', () => {
  const s = setup({ rounds: 1 });
  play(s, 'L1', 1, 0);
  play(s, 'L2', 0, 1);
  play(s, 'L3', 1, 1);
  assert.deepEqual(T.computeStandings(s).unresolved, [['B', 'C']]);
  assert.equal(T.blockingTies(s).length, 0);
  s.settings.playoffEnabled = false;
  assert.equal(T.blockingTies(s).length, 1);
});

test('eleme: playoff lig 2.si - 3.sü, final lig 1.si - playoff galibi (penaltı dahil)', () => {
  const s = setup();
  play(s, 'L1', 2, 0);
  play(s, 'L2', 0, 1);
  play(s, 'L3', 2, 1);
  play(s, 'L4', 0, 1);
  play(s, 'L5', 1, 0);
  play(s, 'L6', 1, 1);
  assert.deepEqual(order(s), ['A', 'B', 'C']);
  const po = s.matches.find((m) => m.id === 'PO');
  const fin = s.matches.find((m) => m.id === 'F');
  assert.deepEqual([po.home, po.away, fin.home, fin.away], ['B', 'C', 'A', null]);
  play(s, 'PO', 2, 2, { home: 3, away: 4 });
  assert.equal(T.winnerOf(po), 'C');
  assert.deepEqual([fin.home, fin.away], ['A', 'C']);
  play(s, 'F', 1, 0);
  assert.equal(T.champion(s), 'A');
});

test('playoff kapalıysa final lig 1.si - 2.si', () => {
  const s = setup({ playoff: false });
  play(s, 'L1', 2, 0);
  play(s, 'L2', 0, 1);
  play(s, 'L3', 2, 1);
  play(s, 'L4', 0, 1);
  play(s, 'L5', 1, 0);
  play(s, 'L6', 1, 1);
  const fin = s.matches.find((m) => m.id === 'F');
  assert.deepEqual([fin.home, fin.away], ['A', 'B']);
  assert.equal(T.activeMatches(s).length, 7);
});

test('saat: duraklatma süreyi dondurur', () => {
  const s = setup();
  const m = s.matches[0];
  T.startMatch(s, m, 0);
  T.toggleClock(m, 1000);
  T.toggleClock(m, 5000);
  assert.equal(T.elapsedMs(m, 6000), 2000);
  assert.equal(T.remainingMs(s, m, 6000), 12 * MIN - 2000);
});

test('zaman planı: varsayılan format 1 sa 52 dk, playoffsuz 1 sa 40 dk', () => {
  const s = setup();
  s.settings.plannedStart = '20:00';
  s.settings.pitchEnd = '21:30';
  const sc = T.schedule(s, at(19, 0));
  assert.equal(sc.start, at(20, 0));
  assert.equal((sc.plannedEnd - sc.start) / MIN, 112);
  assert.equal(sc.overMs / MIN, 22);
  assert.equal(sc.playoffSaving / MIN, 12);
  s.settings.playoffEnabled = false;
  const sc2 = T.schedule(s, at(19, 0));
  assert.equal((sc2.plannedEnd - sc2.start) / MIN, 100);
});

test('zaman planı: gece yarısını geçen saha saati doğru güne düşer', () => {
  const s = setup();
  s.settings.plannedStart = '23:30';
  s.settings.pitchEnd = '01:00';
  const sc = T.schedule(s, at(23, 0));
  assert.equal((sc.pitchEnd - sc.start) / MIN, 90);
});

test('zaman planı: geç başlayan maç gecikmeyi sonraki maçlara taşır', () => {
  const s = setup();
  s.settings.plannedStart = '20:00';
  T.startMatch(s, s.matches[0], at(20, 5));
  const sc = T.schedule(s, at(20, 10));
  assert.equal(sc.delayMs / MIN, 5);
  assert.equal(sc.items[1].estStart, at(20, 19));
});

test('gol krallığı: isimli golleri sayar, isimsizleri ayrıca bildirir', () => {
  const s = setup();
  const m = play(s, 'L1', 2, 1);
  const scorer = s.teams[0].playerIds[0];
  m.goals[0].playerId = scorer;
  m.goals[1].playerId = scorer;
  const { list, anonymous } = T.topScorers(s);
  assert.deepEqual(list.map((x) => [x.playerId, x.goals, x.team]), [[scorer, 2, 'A']]);
  assert.equal(anonymous, 1);
});

test('yedek: bozuk veri reddedilir, eksik ayarlar varsayılanla tamamlanır', () => {
  assert.equal(T.isValidState({ foo: 1 }), false);
  const s = T.migrate({ players: [], teams: [{}, {}, {}], settings: { leagueMin: 9 } });
  assert.equal(s.settings.leagueMin, 9);
  assert.equal(s.settings.finalMin, 15);
});
