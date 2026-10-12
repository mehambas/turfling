const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tournament.js');
const Views = require('../js/views.js');

const MIN = T.MINUTE;

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function setup() {
  const s = T.createState();
  T.addPlayers(s, Array.from({ length: 15 }, (_, i) => `Oyuncu ${i + 1}`));
  T.applyDraw(s, seeded(1));
  s.matches = T.generateMatches(s.settings);
  s.started = true;
  return s;
}

function goal(m, side, s, minute, now) {
  const g = T.addGoal(m, m[side], now);
  g.ms = minute * MIN;
  g.playerId = s.teams.find((t) => t.id === m[side]).playerIds[0];
  return g;
}

function playFirst(s, now) {
  const m = s.matches[0];
  T.startMatch(s, m, now - 14 * MIN);
  goal(m, 'home', s, 2, now);
  goal(m, 'home', s, 7, now);
  goal(m, 'away', s, 5, now);
  T.finishMatch(m, null, now - 2 * MIN);
  T.resolveKnockouts(s);
  return m;
}

const actionsIn = (html) => new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]));
const playerName = (s, m, side) => s.players.find((p) => p.id === s.teams.find((t) => t.id === m[side]).playerIds[0]).name;

function viewer(state) {
  return Views.create(() => state);
}

test('izleyici: turnuva başlamadan bekleme ekranı, fikstür düğmesi yok', () => {
  const s = T.createState();
  const V = viewer(s);
  const html = V.renderWatch();
  assert.match(html, /Turnuva henüz başlamadı/);
  assert.deepEqual([...actionsIn(html)], []);
  assert.equal(V.renderSheet({}), '');
});

test('izleyici: yayın yoksa ya da link hatalıysa bilgi ekranı', () => {
  const V = viewer(null);
  assert.match(V.renderWatch({ notice: 'connecting' }), /Bağlanıyor…/);
  assert.match(V.renderWatch({ notice: 'notfound' }), /Yayın bulunamadı/);
  assert.match(V.renderWatch({ notice: 'notfound', wide: true }), /class="tv"[\s\S]*Yayın bulunamadı/);
  assert.match(V.renderWatch({ notice: 'empty' }), /Turnuva henüz başlamadı/);
});

test('izleyici telefonda canlı maç: skor, golcüler, süre halkası, sıradaki maç', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  const m = s.matches[1];
  T.startMatch(s, m, now - 3 * MIN);
  goal(m, 'away', s, 1, now);
  const V = viewer(s);
  const html = V.renderWatch({ updating: false });

  assert.match(html, /class="tag-live"/);
  assert.match(html, /2\. maç · Lig 1\. devre/);
  assert.match(html, new RegExp(`${playerName(s, m, 'away')} 2'`));
  assert.match(html, /class="iz-goals">0</);
  assert.match(html, /class="iz-goals">1</);
  assert.match(html, /data-timer-ring/);
  assert.match(html, /data-running="kalan · 12 dk"/);
  assert.match(html, /Sıradaki<br>\d\d:\d\d/);
  assert.doesNotMatch(html, /Güncelleniyor/);
  assert.doesNotMatch(html, /~/);
  assert.deepEqual([...actionsIn(html)], ['sheet-open']);
  assert.match(V.renderWatch({ updating: true }), /Güncelleniyor…/);
});

test('izleyici telefonda: gol olunca bir dakika boyunca o takımın skorunun yanında "Gol" işareti', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  const m = s.matches[1];
  T.startMatch(s, m, now - 5 * MIN);
  goal(m, 'home', s, 2, now);
  const V = viewer(s);
  const rows = () => V.renderWatch().split('class="iz-team"').slice(1);
  assert.deepEqual(rows().map((r) => r.includes('iz-goal-flag')), [false, false]);

  goal(m, 'away', s, 4.5, now);
  assert.deepEqual(rows().map((r) => r.includes('iz-goal-flag')), [false, true]);
  assert.match(rows()[1], /iz-goal-flag[\s\S]*class="iz-goals">1</);

  m.runningSince -= MIN;
  assert.deepEqual(rows().map((r) => r.includes('iz-goal-flag')), [false, false]);
});

test('izleyici telefonda maç arası: tahmini başlama ve son maçın sonucu', () => {
  const s = setup();
  const now = Date.now();
  const first = playFirst(s, now);
  const V = viewer(s);
  const html = V.renderWatch();

  assert.match(html, /Maç arası/);
  assert.match(html, /Sıradaki · 2\. maç/);
  assert.match(html, /Tahmini başlama<\/span><strong>\d\d:\d\d<\/strong><span>12 dakikalık maç/);
  assert.match(html, /Son maç · 1\. maç/);
  assert.match(html, /class="iz-last-score">2 – 1</);
  const order = [`${playerName(s, first, 'home')} 3'`, `${playerName(s, first, 'home')} 8'`, `${playerName(s, first, 'away')} 6'`];
  assert.ok(html.includes(order.join(' · ')), 'goller sırayla, isim ve dakikayla');
  assert.doesNotMatch(html, /~/);
  assert.doesNotMatch(html, /Geri sayım|Değişim:/);
});

test('fikstür ve puan penceresi: puan durumu, gol krallığı, fikstür; değiştiren düğme yok', () => {
  const s = setup();
  const now = Date.now();
  const first = playFirst(s, now);
  T.startMatch(s, s.matches[1], now - MIN);
  const V = viewer(s);

  const closed = V.renderSheet({ scorersOpen: false });
  assert.match(closed, /Puan durumu/);
  assert.match(closed, /1\. finale direkt · 2\. ve 3\. playoff/);
  assert.match(closed, /aria-expanded="false"/);
  assert.match(closed, /<ol class="iz-kings-list" id="iz-kings-list" hidden>/);
  assert.match(closed, new RegExp(`${playerName(s, first, 'home')}</span></span><strong>2 gol`));
  assert.match(closed, /Lig · 1\. devre[\s\S]*Lig · 2\. devre[\s\S]*Eleme/);
  assert.match(closed, /iz-fx-row is-live">\s*<span class="iz-fx-time"><span class="tag-live">Canlı<\/span>/);
  assert.match(closed, /Lig 2\.si/);
  assert.doesNotMatch(closed, /~/);
  assert.deepEqual([...actionsIn(closed)].sort(), ['scorers-toggle', 'sheet-close']);

  const open = V.renderSheet({ scorersOpen: true });
  assert.match(open, /aria-expanded="true"/);
  assert.equal((open.match(/<li[ >]/g) || []).length, 2, 'yalnız gol atanlar listelenir');
});

test('kimse gol atmadıysa gol krallığı açılmaz', () => {
  const s = setup();
  const html = viewer(s).renderSheet({});
  assert.match(html, /Henüz gol yok/);
  assert.deepEqual([...actionsIn(html)], ['sheet-close']);
});

test('geniş ekranda yayın ekranı: yalnız fikstür ve tam ekran düğmeleri', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  T.startMatch(s, s.matches[1], now - MIN);
  const V = viewer(s);
  const html = V.renderWatch({ wide: true, updating: true });
  assert.match(html, /class="tv"/);
  assert.match(html, /Güncelleniyor…/);
  assert.match(html, /Bitiş <strong>\d\d:\d\d<\/strong>/);
  assert.doesNotMatch(html, /~/);
  assert.deepEqual([...actionsIn(html)].sort(), ['screen-fixtures', 'toggle-fullscreen']);
  assert.doesNotMatch(V.renderWatch({ wide: true, updating: false }), /Güncelleniyor/);
});

test('turnuva bitince şampiyon gösterilir', () => {
  const s = setup();
  const now = Date.now();
  for (const m of s.matches) {
    const winner = T.TEAM_IDS.find((id) => id === m.home || id === m.away);
    T.startMatch(s, m, now - 20 * MIN);
    goal(m, m.home === winner ? 'home' : 'away', s, 1, now);
    T.finishMatch(m, null, now - 10 * MIN);
    T.resolveKnockouts(s);
  }
  const V = viewer(s);
  const champ = s.teams.find((t) => t.id === T.champion(s));
  const html = V.renderWatch();
  assert.match(html, /Turnuva bitti/);
  assert.match(html, /Şampiyon/);
  assert.ok(html.includes(champ.name));
});

test('organizatörün cihazı bağlı değilse izleyici uyarılır; kendi bağlantısı yoksa yalnız "Güncelleniyor…"', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  T.startMatch(s, s.matches[1], now - MIN);
  const V = viewer(s);
  const away = /Organizatörün cihazı bağlı değil, skor gecikebilir/;
  assert.match(V.renderWatch({ organizerAway: true }), away);
  assert.match(V.renderWatch({ organizerAway: true, wide: true }), away);
  assert.doesNotMatch(V.renderWatch({ organizerAway: false }), away);
  assert.doesNotMatch(V.renderWatch({ organizerAway: true, updating: true }), away);
  assert.doesNotMatch(viewer(T.createState()).renderWatch({ organizerAway: true }), away);
});
