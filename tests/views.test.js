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

function dateIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

test('izleyici başlamadan önce: kurallar hep açık, telefonda ve TV ekranında', () => {
  const s = T.createState();
  s.settings.leagueMin = 10;
  const V = viewer(s);
  const phone = V.renderWatch();
  assert.match(phone, /<section class="iz-rules is-open" aria-labelledby="iz-rules-h"><h2 class="iz-rules-head" id="iz-rules-h">/);
  assert.match(phone, /Herkes herkesle iki kez oynar/);
  assert.match(phone, /Lig<\/span>\s*<span class="iz-step-min">10<small>dk/);
  assert.doesNotMatch(phone, /inert/);

  const tv = V.renderWatch({ wide: true });
  assert.match(tv, /<section class="tv-rules"[\s\S]*iz-step-name">Lig<[\s\S]*iz-step-name">Playoff<[\s\S]*iz-step-name">Final/);
  assert.match(tv, /Galibiyet 3, beraberlik 1, mağlubiyet 0 puan · Playoff ve finalde beraberlikte penaltı/);
  assert.deepEqual([...actionsIn(tv)], ['toggle-fullscreen']);
});

test('başlangıç yazısı: tarih ve saat; bugün/yarın kısaltılır, geçmiş tarih yok sayılır', () => {
  const now = new Date(2026, 9, 13, 12, 0).getTime();
  const text = (plannedDate, plannedStart = '') => Views.startText({ plannedDate, plannedStart }, now);
  assert.equal(text('2026-10-18', '20:00'), 'Başlangıç: 18 Ekim Pazar, 20:00');
  assert.equal(text('2026-10-18'), 'Başlangıç: 18 Ekim Pazar');
  assert.equal(text('2026-10-13', '21:30'), 'Başlangıç: bugün 21:30');
  assert.equal(text('2026-10-14', '20:00'), 'Başlangıç: yarın 20:00');
  assert.equal(text('2027-01-04', '20:00'), 'Başlangıç: 4 Ocak 2027 Pazartesi, 20:00');
  assert.equal(text('2026-10-12', '20:00'), 'Başlangıç: 20:00');
  assert.equal(text('', '20:00'), 'Başlangıç: 20:00');
  assert.equal(text(''), '');
});

test('izleyici başlamadan önce: tarih ve saat girildiyse "henüz başlamadı" yerine başlangıç gösterilir', () => {
  const s = T.createState();
  s.settings.plannedDate = dateIn(1);
  s.settings.plannedStart = '20:00';
  const V = viewer(s);
  for (const html of [V.renderWatch(), V.renderWatch({ wide: true })]) {
    assert.match(html, /Başlangıç: yarın 20:00/);
    assert.doesNotMatch(html, /henüz başlamadı/);
  }
});

test('ilk maç başka gündeyse tahmini başlamada tarih de yazar; ilk maç oynanınca yalnız saat', () => {
  const s = setup();
  s.settings.plannedDate = dateIn(1);
  s.settings.plannedStart = '20:00';
  const V = viewer(s);
  assert.match(V.renderWatch(), /<span>Tahmini başlama<\/span><span class="iz-eta-day">yarın<\/span><strong>20:00<\/strong>/);
  assert.match(V.renderWatch({ wide: true }), /Tahmini başlama yarın 20:00/);

  s.settings.plannedDate = dateIn(0);
  assert.doesNotMatch(V.renderWatch(), /iz-eta-day/);

  s.settings.plannedDate = dateIn(1);
  playFirst(s, Date.now());
  assert.doesNotMatch(V.renderWatch(), /iz-eta-day/);
  assert.doesNotMatch(V.renderWatch({ wide: true }), /yarın/);
});

test('ana sayfada takımlar ve oyuncuları; sekmelerde takım sayfasını açar, başlamadan önce yalnız liste', () => {
  const s = setup();
  const V = viewer(s);
  const names = (t) => t.playerIds.map((id) => s.players.find((p) => p.id === id).name).join(', ');
  const html = V.renderWatch({ links: true });
  for (const t of s.teams) {
    assert.match(html, new RegExp(`data-action="team" data-team="${t.id}"[^>]*>[\\s\\S]*?${t.name}<\\/span><span class="iz-tl-players">${names(t)}<`));
  }
  assert.doesNotMatch(V.renderWatch(), /data-action="team"/);

  const pre = T.createState();
  T.addPlayers(pre, ['Emre', 'Can', 'Ali']);
  T.applyDraw(pre, seeded(1));
  const preHtml = viewer(pre).renderWatch();
  assert.match(preHtml, /Takımlar<\/h2>[\s\S]*iz-tl-players[\s\S]*Nasıl oynanıyor\?/);
  assert.doesNotMatch(preHtml, /data-action="team"/);

  assert.doesNotMatch(viewer(T.createState()).renderWatch(), /Takımlar/);
});

test('geniş ekranda takımlar: bekleme ekranında üç kutu, fikstür penceresinde kart', () => {
  const pre = T.createState();
  T.addPlayers(pre, ['Emre', 'Can', 'Ali', 'Mert']);
  T.applyDraw(pre, seeded(1));
  const names = (s, t) => t.playerIds.map((id) => s.players.find((p) => p.id === id).name).join(', ');
  const tv = viewer(pre).renderWatch({ wide: true });
  assert.match(tv, /tv-sub">[^<]*<\/span>\s*<\/div>\s*<section class="tv-teams"[\s\S]*<section class="tv-rules"/);
  for (const t of pre.teams) assert.match(tv, new RegExp(`${t.name}</span><span class="tv-team-players">${names(pre, t)}<`));
  assert.deepEqual([...actionsIn(tv)], ['toggle-fullscreen']);
  assert.doesNotMatch(viewer(T.createState()).renderWatch({ wide: true }), /tv-teams/);

  const s = setup();
  const sheet = viewer(s).renderSheet({});
  assert.match(sheet, /Puan durumu[\s\S]*id="h-roster">Takımlar<[\s\S]*Gol kral/);
  for (const t of s.teams) assert.match(sheet, new RegExp(`${t.name}</span></span></div><span class="iz-roster-players">${names(s, t)}<`));
});

test('kural metni ayarlara göre: devre sayısı, playoff, süreler', () => {
  const base = T.createState().settings;
  const def = Views.rulesText(base);
  assert.equal(def.summary, 'Lig › Playoff › Final');
  assert.deepEqual(
    def.steps.map((x) => `${x.name} ${x.min} ${x.who}`),
    ['Lig 12 Herkes herkesle iki kez oynar', 'Playoff 10 Lig 2.si – 3.sü', 'Final 15 Lig 1.si – playoff\u00a0galibi'],
  );
  assert.equal(def.meta, '2 devre, 6 maç · her maçta bir takım dinlenir');
  assert.equal(def.draw, 'Ligde öyle kalır; playoff ve finalde penaltı.');

  const one = Views.rulesText({ ...base, leagueRounds: 1, playoffEnabled: false, finalMin: 20 });
  assert.equal(one.summary, 'Lig › Final');
  assert.equal(one.meta, '3 maç · her maçta bir takım dinlenir');
  assert.doesNotMatch(one.meta, /devre/);
  assert.equal(one.steps[0].who, 'Herkes herkesle bir kez oynar');
  assert.deepEqual([one.steps[1].min, one.steps[1].who], [20, 'Lig 1.si – 2.si']);
  assert.equal(one.draw, 'Ligde öyle kalır; finalde penaltı.');
  assert.match(one.tvLine, /· Finalde beraberlikte penaltı$/);

  const three = Views.rulesText({ ...base, leagueRounds: 3 });
  assert.equal(three.steps[0].who, 'Herkes herkesle üç kez oynar');
  assert.equal(three.meta, '3 devre, 9 maç · her maçta bir takım dinlenir');
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
  assert.deepEqual([...actionsIn(html)], ['team']);
  assert.equal((html.match(/data-action="team" data-team="/g) || []).length, 2, 'iki skor satırı takım sayfasını açar');
  assert.match(V.renderWatch({ updating: true }), /Güncelleniyor…/);
});

test('izleyici telefonda: yeni gol işaretliyse o takımın skorunun yanında "Gol" etiketi', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  const m = s.matches[1];
  T.startMatch(s, m, now - 5 * MIN);
  goal(m, 'home', s, 2, now);
  const fresh = goal(m, 'away', s, 4, now);
  const V = viewer(s);
  const rows = (flags) => V.renderWatch({ flags }).split('class="iz-team"').slice(1);
  assert.deepEqual(rows(undefined).map((r) => r.includes('iz-goal-flag')), [false, false]);
  assert.deepEqual(rows(new Set([fresh.id])).map((r) => r.includes('iz-goal-flag')), [false, true]);
  assert.match(rows(new Set([fresh.id]))[1], /iz-goal-flag[\s\S]*class="iz-goals">1</);
  assert.deepEqual(rows(new Set(['silinmis'])).map((r) => r.includes('iz-goal-flag')), [false, false]);
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
  assert.deepEqual([...closed.matchAll(/class="iz-fx-title">([^<]+)</g)].map((m) => m[1]), ['Lig · 1. devre', 'Lig · 2. devre', 'Playoff', 'Final']);
  assert.match(closed, /<section class="iz-rules is-light">\s*<button class="iz-rules-btn" data-action="rules-toggle" aria-expanded="false"/);
  assert.match(closed, /id="iz-rules-tv" inert/);
  assert.match(closed, /iz-fx-row is-live">\s*<span class="iz-fx-time"><span class="tag-live">Canlı<\/span>/);
  assert.match(closed, /Lig 2\.si/);
  assert.doesNotMatch(closed, /~/);
  assert.deepEqual([...actionsIn(closed)].sort(), ['rules-toggle', 'scorers-toggle', 'sheet-close']);

  const open = V.renderSheet({ scorersOpen: true });
  assert.match(open, /aria-expanded="true"/);
  const kings = open.match(/<ol class="iz-kings-list"[^>]*>([\s\S]*?)<\/ol>/)[1];
  assert.equal((kings.match(/<li[ >]/g) || []).length, 2, 'yalnız gol atanlar listelenir');

  const rules = V.renderSheet({ rulesOpen: true });
  assert.match(rules, /<section class="iz-rules is-open is-light">/);
  assert.doesNotMatch(rules, /inert/);
});

test('kimse gol atmadıysa gol krallığı açılmaz', () => {
  const s = setup();
  const html = viewer(s).renderSheet({});
  assert.match(html, /Henüz gol yok/);
  assert.deepEqual([...actionsIn(html)], ['sheet-close', 'rules-toggle']);
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

test('organizatörün cihazı bağlı değilse izleyici uyarılır (ilk maç başladıktan sonra); kendi bağlantısı yoksa yalnız "Güncelleniyor…"', () => {
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
  assert.doesNotMatch(viewer(setup()).renderWatch({ organizerAway: true }), away);
  assert.doesNotMatch(viewer(setup()).renderWatch({ organizerAway: true, wide: true }), away);
});

test('alt sekmeler: Maç, Fikstür, Puan; seçili olan işaretli', () => {
  const html = viewer(setup()).renderTabBar('puan');
  assert.deepEqual([...html.matchAll(/data-tab="(\w+)" aria-selected="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`), ['mac:false', 'fikstur:false', 'puan:true']);
  assert.match(html, /iz-tab-dot/);
});

test('Fikstür sekmesi: gruplar kart, takım adları takım sayfasını, canlı skor Maç sekmesini açar', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  T.startMatch(s, s.matches[1], now - MIN);
  const html = viewer(s).renderFixturePage();
  assert.match(html, /<h1 class="iz-large">Fikstür<\/h1>/);
  assert.match(html, /\d+ maç · tahmini bitiş \d\d:\d\d/);
  assert.deepEqual([...html.matchAll(/<h2 class="iz-card-h">([^<]+)</g)].map((m) => m[1]), ['Lig · 1. devre', 'Lig · 2. devre', 'Playoff', 'Final']);
  assert.match(html, /<div class="iz-stack"><section class="iz-rules">\s*<button class="iz-rules-btn" data-action="rules-toggle" aria-expanded="false"/);
  assert.match(html, /<span class="iz-rules-lead">Lig › Playoff › Final/);
  assert.match(html, /id="iz-rules-body" inert/);
  assert.match(viewer(s).renderFixturePage({ rulesOpen: true }), /<section class="iz-rules is-open">[\s\S]*aria-expanded="true"/);
  assert.match(html, /<button class="iz-fx-score" data-action="tab" data-tab="mac"/);
  assert.match(html, /data-action="team" data-team="/);
  assert.match(html, /Lig 1\.si/, 'belli olmayan takım düğme değil, yer tutucu');
  assert.doesNotMatch(html, /~/);
});

test('tek devre, playoff kapalı: fikstürde "Lig" ve "Final", kutuda "Lig › Final"', () => {
  const s = T.createState();
  T.addPlayers(s, Array.from({ length: 15 }, (_, i) => `Oyuncu ${i + 1}`));
  T.applyDraw(s, seeded(1));
  Object.assign(s.settings, { leagueRounds: 1, playoffEnabled: false });
  s.matches = T.generateMatches(s.settings);
  s.started = true;
  const html = viewer(s).renderFixturePage();
  assert.deepEqual([...html.matchAll(/<h2 class="iz-card-h">([^<]+)</g)].map((m) => m[1]), ['Lig', 'Final']);
  assert.match(html, /<span class="iz-rules-lead">Lig › Final/);
  assert.match(html, /3 maç · her maçta bir takım dinlenir/);
});

test('Puan sekmesi: satırlar takım sayfasını açar, gol krallığı takım adıyla açık liste', () => {
  const s = setup();
  playFirst(s, Date.now());
  const html = viewer(s).renderStandingsPage();
  assert.equal((html.match(/class="iz-st-row" data-action="team"/g) || []).length, 3);
  assert.match(html, /1\. finale direkt · 2\. ve 3\. playoff/);
  const homeTeam = s.teams.find((t) => t.id === s.matches[0].home);
  assert.match(html, new RegExp(`${playerName(s, s.matches[0], 'home')}<small>${homeTeam.name}</small></span><strong>2<`));
  assert.doesNotMatch(html, /scorers-toggle/);
});

test('takım sayfası: sıra ve puan, gol atmayanlar dahil oyuncular, maçlar G/B/M ile, sıradaki maç', () => {
  const s = setup();
  const now = Date.now();
  const first = playFirst(s, now);
  const winner = s.teams.find((t) => t.id === first.home);
  const html = viewer(s).renderTeamPage(winner.id);
  assert.match(html, new RegExp(`<h1>${winner.name}</h1>`));
  assert.match(html, /<b>1\.<\/b><span>Lig sırası<\/span><\/div><div><b>3<\/b><span>Puan<\/span>/);
  assert.equal((html.match(/class="iz-pl-name"/g) || []).length, winner.playerIds.length);
  assert.match(html, /Gol kralı/);
  assert.match(html, /<b class="is-zero">0<\/b>/);
  assert.match(html, /<span class="iz-tm-score">2–1<\/span><span class="iz-res is-g"/);
  assert.match(html, /Eleme maçları lig bitince belli olur/);
  assert.match(html, /Sıradaki maç · tahmini başlama/);
  assert.equal(viewer(s).renderTeamPage('yok'), '');
});

test('takım sayfası: takım sahadaysa canlı skor ve "Maça git"', () => {
  const s = setup();
  const now = Date.now();
  playFirst(s, now);
  const m = s.matches[1];
  T.startMatch(s, m, now - MIN);
  const html = viewer(s).renderTeamPage(m.home);
  assert.match(html, /Şu an sahada · 2\. maç/);
  assert.match(html, /data-action="tab" data-tab="mac">Maça git/);
  assert.match(html, /<li class="is-live">/);
});

