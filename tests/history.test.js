const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tournament.js');
const H = require('../js/history.js');

function setup() {
  const s = T.createState();
  T.addPlayers(s, ['Ali', 'Veli', 'Can', 'Cem', 'Efe', 'Ege']);
  s.teams.forEach((t, i) => { t.playerIds = s.players.slice(i * 2, i * 2 + 2).map((p) => p.id); });
  s.settings = { ...s.settings, leagueRounds: 1, playoffEnabled: false, finalEnabled: false };
  s.matches = T.generateMatches(s.settings);
  s.started = true;
  return s;
}
function complete(s) {
  for (const m of T.activeMatches(s)) {
    T.startMatch(s, m, 1000);
    const winner = m.home === 'A' || m.away !== 'A' && m.home === 'B' ? m.home : m.away;
    const g = T.addGoal(m, winner, 2000);
    T.assignScorer(s, m, g, s.teams.find((t) => t.id === winner).playerIds[0]);
    T.finishMatch(m, null, 3000);
  }
  return s;
}

test('eski yedek kimlikleri ve golleri korur, kadrolar yalnız bir kez sabitlenir', () => {
  const old = complete(setup());
  delete old.id; delete old.playerPool; delete old.archives; old.version = 1;
  old.matches.forEach((m) => delete m.lineups);
  const raw = JSON.stringify(old), next = T.migrate(old);
  assert.equal(JSON.stringify(old), raw);
  assert.deepEqual(next.players, old.players);
  assert.deepEqual(next.matches[0].goals, old.matches[0].goals);
  assert.equal(next.playerPool.length, 6);
  assert.equal(next.id, T.migrate(old).id);
  assert.equal(next.matches[0].lineupsInferred, true);
  const before = structuredClone(next.matches[0].lineups);
  T.movePlayer(next, next.players[0].id, 'C');
  assert.deepEqual(T.migrate(next).matches[0].lineups, before);
});

test('arşivleme tekrarlanabilir, mevcut turnuva iki kez sayılmaz; yeni turnuva boş kadroyla başlar', () => {
  const s = complete(setup());
  assert.equal(T.archiveTournament(s, 10), true);
  assert.equal(T.archiveTournament(s, 20), true);
  assert.equal(s.archives.length, 1);
  assert.equal(s.archives[0].archivedAt, 10);
  assert.equal(T.historyStats(s).matches, 3);
  const next = T.nextTournament(s);
  assert.notEqual(next.id, s.id);
  assert.equal(next.players.length, 0);
  assert.ok(next.teams.every((t) => !t.playerIds.length));
  assert.equal(next.playerPool.length, 6);
  assert.equal(T.historyStats(next).matches, 3);
  assert.equal(T.selectPlayer(next, s.players[0].id), true);
  assert.equal(next.players[0].id, s.players[0].id);
  next.players[0].name = 'Ali yeni';
  T.syncPool(next);
  assert.equal(next.archives[0].players[0].name, 'Ali');
  assert.equal(T.historyStats(next).players.find((p) => p.id === s.players[0].id).name, 'Ali yeni');
});

test('bitmemiş turnuva yeni turnuvayla ezilemez', () => {
  const s = setup();
  assert.equal(T.nextTournament(s), null);
  assert.equal(T.archiveTournament(s), false);
  assert.equal(s.archives.length, 0);
});

test('katılmayan ve yeni oyuncuların toplamları ayrıdır; katılımcı çıkarmak havuzu silmez', () => {
  const s = complete(setup()), absent = s.players[0].id;
  const next = T.nextTournament(s);
  T.addPlayers(next, ['Yeni kişi']);
  assert.equal(T.removePlayer(next, next.players[0].id), true);
  const stats = T.historyStats(next);
  assert.equal(stats.players.find((p) => p.id === absent).played, 2);
  assert.equal(stats.players.find((p) => p.name === 'Yeni kişi').played, 0);
  assert.equal(next.playerPool.length, 7);
  assert.equal(T.removePlayer(s, absent), false);
});

test('maç kadrosundaki istisna yalnız o maçın katılım ve eşleşmelerini etkiler', () => {
  const s = setup(), m = s.matches[0];
  const absent = s.players[0].id, guest = s.players[4].id;
  T.startMatch(s, m, 0);
  assert.equal(T.setLineup(s, m, absent, ''), true);
  assert.equal(T.setLineup(s, m, guest, 'A'), true);
  T.finishMatch(m, null, 100);
  const stats = T.historyStats(s);
  assert.equal(stats.players.find((p) => p.id === absent).played, 0);
  assert.equal(stats.players.find((p) => p.id === guest).played, 1);
  assert.equal(s.teams[2].playerIds.includes(guest), true);
  assert.equal(stats.pairs.find((r) => r.ids.includes(guest) && r.ids.includes(s.players[1].id)).together, 1);
  T.startMatch(s, s.matches[1], 200);
  assert.equal(s.matches[1].lineups.C.includes(guest), true);
});

test('bilinmeyen, kendi kalesine, penaltı ve oynanmamış maçlar ayrı sayılır', () => {
  const s = setup(), m = s.matches[0];
  T.startMatch(s, m, 0);
  T.assignScorer(s, m, T.addGoal(m, 'A', 10), s.players[2].id, true);
  T.addGoal(m, 'B', 20);
  T.finishMatch(m, { home: 5, away: 4 }, 100);
  T.addGoal(s.matches[1], 'C', 0); // oynanmayan maçın hatalı golü sayılmaz
  const stats = T.historyStats(s);
  assert.equal(stats.goals, 2);
  assert.equal(stats.unknownGoals, 1);
  assert.equal(stats.matches, 1);
  assert.equal(stats.players.find((p) => p.id === s.players[2].id).ownGoals, 1);
  assert.equal(stats.players.find((p) => p.id === s.players[2].id).goals, 0);
  assert.equal(stats.players[0].drawn, 1);
  assert.equal(stats.players[0].won, 0);
  assert.equal(stats.players[0].penaltyWins, 1);
});

test('gol sahibi seçimi misafirin katılımını kaydeder ve çelişkili taraf değişimini reddeder', () => {
  const s = setup(), m = s.matches[0], guest = s.players[4].id;
  T.startMatch(s, m, 0);
  const g = T.addGoal(m, 'A', 1);
  assert.equal(T.assignScorer(s, m, g, guest), true);
  assert.ok(m.lineups.A.includes(guest));
  assert.equal(T.setLineup(s, m, guest, ''), false);
  const second = T.addGoal(m, 'B', 2);
  assert.equal(T.assignScorer(s, m, second, guest), false);
  assert.equal(second.playerId, null);
  assert.ok(m.lineups.A.includes(guest));
});

test('arşivde golcü düzeltmesi toplamlara yansır, takım adı başka turnuvayla birleşmez', () => {
  const s = complete(setup()), next = T.nextTournament(s);
  const archive = next.archives[0], m = archive.matches[0], id = archive.players[1].id;
  assert.equal(T.assignScorer(archive, m, m.goals[0], id), true);
  assert.equal(T.historyStats(next).players.find((p) => p.id === id).goals, 1);
  assert.equal(T.historyStats(next).goals, 3);
});

test('geçmişli kura torbaları korur ve tekrarları azaltır', () => {
  const s = complete(setup());
  s.players.forEach((p, i) => { p.pot = i % 2 + 1; });
  const next = T.nextTournament(s);
  next.playerPool.forEach((p) => T.selectPlayer(next, p.id));
  let seed = 1;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const result = T.balancedDraw(next, rng);
  for (const ids of Object.values(result)) {
    assert.deepEqual(ids.map((id) => next.players.find((p) => p.id === id).pot).sort(), [1, 2]);
    assert.ok(!s.teams.some((t) => ids.every((id) => t.playerIds.includes(id))));
  }
});

test('kaleciler, torba dengesi içinde dağıtılır', () => {
  const s = setup();
  s.players.slice(0, 3).forEach((p) => { p.goalkeeper = true; p.pot = 1; });
  s.players.slice(3).forEach((p) => { p.pot = 2; });
  T.applyDraw(s);
  for (const t of s.teams) assert.equal(t.playerIds.filter((id) => s.players.find((p) => p.id === id).goalkeeper).length, 1);
});

test('geçmiş ekranları kullanıcı metnini kaçırır ve eski kadro varsayımını gösterir', () => {
  const s = complete(setup()); s.players[0].name = '<img src=x onerror=alert(1)>'; T.syncPool(s);
  T.archiveTournament(s);
  const html = H.render(s, {});
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(H.render(s, { historyPlayer: s.players[0].id }).includes('Kimlerle oynadı?'));
  assert.ok(H.render(s, { historyTournament: s.id }).includes('O günkü takımlar'));
});

test('aynı isimde iki farklı oyuncu ayrı kimlikle izlenir', () => {
  const s = T.createState();
  T.addPlayers(s, ['Ali']);
  T.addPlayers(s, ['Ali'], { allowDuplicate: true });
  assert.equal(s.players.length, 2);
  assert.notEqual(s.players[0].id, s.players[1].id);
  assert.equal(T.isValidState(s), true);
});

test('bozuk arşiv ve iki tarafta aynı oyuncu içeren kadro reddedilir', () => {
  const s = setup();
  assert.equal(T.isValidState({ ...s, archives: [{}] }), false);
  assert.equal(T.isValidState({ ...s, playerPool: null }), true);
  T.startMatch(s, s.matches[0], 0);
  s.matches[0].lineups.B.push(s.matches[0].lineups.A[0]);
  assert.equal(T.isValidState(s), false);
});

test('skor düzeltmesi oynanmış eleme eşleşmesini bozamaz; penaltı sonucu eksik bırakılamaz', () => {
  const s = setup();
  s.settings.finalEnabled = true; s.settings.playoffEnabled = true;
  for (const m of T.activeMatches(s)) {
    T.resolveKnockouts(s);
    T.startMatch(s, m, 100);
    const winner = m.home === 'A' || m.away !== 'A' && m.home === 'B' ? m.home : m.away;
    T.addGoal(m, winner, 200);
    T.finishMatch(m, null, 300);
  }
  assert.equal(T.resultError(s), null);
  const trial = structuredClone(s);
  trial.matches[0].goals[0].team = 'B';
  assert.match(T.resultError(trial), /eşleşmesini değiştiriyor/);
  const final = s.matches.find((m) => m.stage === 'final');
  final.goals = [];
  assert.match(T.resultError(s), /penaltı sonucunu/);
  final.pens = { home: 3, away: null };
  assert.match(T.resultError(s), /penaltı sonucunu/);
  final.pens = { home: 3, away: 2 };
  assert.equal(T.resultError(s), null);
});

test('katılımcı çıkarılması bekleyen maç istisnasından da çıkarır', () => {
  const s = setup(), m = s.matches[0], id = s.players[0].id;
  T.setLineup(s, m, id, 'A');
  T.removePlayer(s, id);
  T.startMatch(s, m, 0);
  assert.ok(!Object.values(m.lineups).flat().includes(id));
});

test('mükerrer oyuncu birleştirme eski golleri ve maçları tek kimlikte toplar', () => {
  const first = complete(setup()), targetId = first.players[0].id;
  const next = T.nextTournament(first);
  T.addPlayers(next, ['Ali ikinci kayıt']);
  const sourceId = next.players[0].id;
  const before = JSON.stringify(next);
  const result = T.mergePlayers(next, sourceId, targetId);
  assert.ok(result.state);
  assert.equal(JSON.stringify(next), before);
  assert.equal(result.state.playerPool.length, 6);
  assert.equal(result.state.players[0].id, targetId);
  assert.equal(result.state.players[0].name, 'Ali');
  assert.equal(T.historyStats(result.state).players.find((p) => p.id === targetId).goals, 2);
  assert.equal(T.isValidState(result.state), true);
});

test('rakip oyuncular birleştirilemez, aynı takımda mükerrer katılım bir kez sayılır', () => {
  const s = complete(setup());
  const before = JSON.stringify(s);
  assert.ok(T.mergePlayers(s, s.players[0].id, s.players[2].id).error);
  assert.equal(JSON.stringify(s), before);
  const result = T.mergePlayers(s, s.players[1].id, s.players[0].id);
  assert.equal(result.state.teams[0].playerIds.length, 1);
  assert.equal(T.historyStats(result.state).players.find((p) => p.id === s.players[0].id).played, 2);
  assert.equal(T.isValidState(result.state), true);
});
