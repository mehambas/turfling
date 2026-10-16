(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tournament = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TEAM_IDS = ['A', 'B', 'C'];
  // Bu sırayla her takım iki maç oynayıp bir maç dinlenir; kimse üst üste üç maç oynamaz.
  const LEAGUE_CYCLE = [['A', 'B'], ['C', 'A'], ['B', 'C']];
  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * MINUTE;

  const DEFAULT_SETTINGS = {
    leagueRounds: 2,
    leagueMin: 12,
    playoffEnabled: true,
    finalEnabled: true,
    playoffMin: 10,
    finalMin: 15,
    changeMin: 2,
    breakMin: 3,
    plannedDate: '',
    plannedStart: '',
    pitchEnd: '',
  };

  const LIMITS = {
    leagueRounds: [1, 3],
    leagueMin: [3, 30],
    playoffMin: [3, 30],
    finalMin: [3, 40],
    changeMin: [0, 10],
    breakMin: [0, 20],
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  function createState() {
    return {
      version: 2,
      id: uid(),
      playerPool: [],
      archives: [],
      name: 'Halı Saha Turnuvası',
      players: [],
      teams: [
        { id: 'A', name: 'Kırmızılar', color: 'red', playerIds: [] },
        { id: 'B', name: 'Maviler', color: 'blue', playerIds: [] },
        { id: 'C', name: 'Sarılar', color: 'yellow', playerIds: [] },
      ],
      settings: { ...DEFAULT_SETTINGS },
      started: false,
      matches: [],
      lots: {},
    };
  }

  function isValidState(raw) {
    const id = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
    const unique = (list) => new Set(list).size === list.length;
    const players = (list) => Array.isArray(list) &&
      list.every((p) => p && id(p.id) && typeof p.name === 'string') && unique(list.map((p) => p.id));
    const match = (m) => {
      if (!m || !id(m.id) || !['pending', 'live', 'done'].includes(m.status)) return false;
      if ([m.home, m.away].some((team) => team != null && !TEAM_IDS.includes(team))) return false;
      if (!Array.isArray(m.goals) || !m.goals.every((g) => g && id(g.id) && TEAM_IDS.includes(g.team) && (g.playerId == null || id(g.playerId)))) return false;
      if (m.pens != null && !['home', 'away'].every((side) => Number.isSafeInteger(m.pens[side]) && m.pens[side] >= 0)) return false;
      if (m.lineups == null) return true;
      return typeof m.lineups === 'object' && !Array.isArray(m.lineups) &&
        Object.entries(m.lineups).every(([team, ids]) => TEAM_IDS.includes(team) && Array.isArray(ids) && ids.every(id)) &&
        unique(Object.values(m.lineups).flat());
    };
    const tournament = (t) => {
      if (!t || typeof t !== 'object' || (t.id != null && !id(t.id)) || !players(t.players)) return false;
      if (!Array.isArray(t.teams) || t.teams.length !== TEAM_IDS.length) return false;
      if (!t.teams.every((team) => team && typeof team === 'object' &&
        (team.id == null || TEAM_IDS.includes(team.id)) &&
        (team.playerIds == null || Array.isArray(team.playerIds) && team.playerIds.every(id)))) return false;
      return t.matches == null || Array.isArray(t.matches) && t.matches.every(match);
    };
    if (!tournament(raw) || (raw.playerPool != null && !players(raw.playerPool))) return false;
    if (raw.archives == null) return true;
    return Array.isArray(raw.archives) && unique(raw.archives.map((t) => t?.id)) &&
      raw.archives.every((t) => tournament(t) && id(t.id) && Array.isArray(t.matches) && !t.archives && !t.playerPool);
  }

  function migrate(raw) {
    const base = createState();
    if (!isValidState(raw)) return base;
    const state = {
      ...base,
      ...raw,
      version: 2,
      id: raw.id || legacyId(raw),
      playerPool: Array.isArray(raw.playerPool) ? structuredClone(raw.playerPool) : [],
      archives: Array.isArray(raw.archives) ? structuredClone(raw.archives) : [],
      settings: { ...base.settings, ...raw.settings },
      matches: Array.isArray(raw.matches) ? raw.matches : [],
      lots: raw.lots || {},
    };
    state.players = structuredClone(state.players);
    state.teams = structuredClone(state.teams);
    state.matches = structuredClone(state.matches);
    syncPool(state);
    for (const t of [state, ...state.archives]) {
      t.settings = { ...base.settings, ...t.settings };
      t.teams = t.teams.map((team, i) => ({ ...base.teams[i], ...team }));
      for (const m of t.matches) {
        if (m.status !== 'pending' && !m.lineups) {
          m.lineups = defaultLineups(t, m);
          m.lineupsInferred = true;
        }
      }
      for (const p of t.players) {
        if (!state.playerPool.some((x) => x.id === p.id)) state.playerPool.push({ ...p });
      }
    }
    return state;
  }

  function legacyId(raw) {
    const key = JSON.stringify([raw.players.map((p) => p.id).sort(), raw.name, raw.matches?.map((m) => m.id)]);
    let hash = 2166136261;
    for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return `legacy-${(hash >>> 0).toString(36)}`;
  }

  function syncPool(state) {
    state.playerPool ||= [];
    for (const p of state.players) {
      const saved = state.playerPool.find((x) => x.id === p.id);
      if (saved) Object.assign(saved, p);
      else state.playerPool.push({ ...p });
    }
  }

  function selectPlayer(state, id) {
    const p = state.playerPool.find((x) => x.id === id);
    if (!p || state.players.some((x) => x.id === id)) return false;
    state.players.push({ ...p });
    return true;
  }

  function mergePlayers(state, sourceId, targetId) {
    const target = state.playerPool.find((p) => p.id === targetId);
    if (!target || sourceId === targetId || !state.playerPool.some((p) => p.id === sourceId)) return { error: 'Birleştirilecek iki farklı oyuncu seçin.' };
    const next = structuredClone(state);
    const replace = (ids) => [...new Set(ids.map((id) => id === sourceId ? targetId : id))];
    for (const t of [next, ...next.archives]) {
      const sourceTeam = t.teams.find((team) => team.playerIds.includes(sourceId));
      const targetTeam = t.teams.find((team) => team.playerIds.includes(targetId));
      if (sourceTeam && targetTeam && sourceTeam.id !== targetTeam.id) return { error: 'Bu kayıtlar aynı turnuvada farklı takımlarda yer alıyor. Önce kadroları kontrol edin.' };
      for (const m of t.matches) {
        const lineups = matchLineups(t, m);
        if (Object.values(lineups).some((ids) => ids.includes(sourceId)) && Object.values(lineups).some((ids) => ids.includes(targetId)) &&
          !Object.values(lineups).some((ids) => ids.includes(sourceId) && ids.includes(targetId))) return { error: 'Bu kayıtlar aynı maçta rakip görünüyor. Önce maç kadrosunu kontrol edin.' };
      }
      const hasTarget = t.players.some((p) => p.id === targetId);
      t.players = t.players.filter((p) => !hasTarget || p.id !== sourceId).map((p) => p.id === sourceId ? { ...p, id: targetId } : p);
      for (const team of t.teams) team.playerIds = replace(team.playerIds);
      for (const m of t.matches) {
        if (m.lineups) for (const key of Object.keys(m.lineups)) m.lineups[key] = replace(m.lineups[key]);
        for (const g of m.goals) if (g.playerId === sourceId) g.playerId = targetId;
      }
    }
    next.playerPool = next.playerPool.filter((p) => p.id !== sourceId);
    const selected = next.players.find((p) => p.id === targetId);
    if (selected) selected.name = target.name;
    return { state: next };
  }

  function shuffle(list, rng = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function addPlayers(state, names, { allowDuplicate = false } = {}) {
    const existing = new Set(state.players.map((p) => p.name.toLocaleLowerCase('tr')));
    let added = 0;
    for (const raw of names) {
      const name = String(raw).trim().replace(/\s+/g, ' ');
      const key = name.toLocaleLowerCase('tr');
      if (!name || (!allowDuplicate && existing.has(key))) continue;
      existing.add(key);
      state.players.push({ id: uid(), name, pot: 0 });
      added++;
    }
    syncPool(state);
    return added;
  }

  function removePlayer(state, playerId) {
    if (state.matches.some((m) => m.status !== 'pending' &&
      (Object.values(matchLineups(state, m)).some((ids) => ids.includes(playerId)) || m.goals.some((g) => g.playerId === playerId)))) return false;
    syncPool(state);
    state.players = state.players.filter((p) => p.id !== playerId);
    for (const t of state.teams) t.playerIds = t.playerIds.filter((id) => id !== playerId);
    for (const m of state.matches) {
      if (m.status === 'pending' && m.lineups) for (const team of Object.keys(m.lineups)) m.lineups[team] = m.lineups[team].filter((id) => id !== playerId);
    }
    return true;
  }

  function teamOfPlayer(state, playerId) {
    return state.teams.find((t) => t.playerIds.includes(playerId)) || null;
  }

  function movePlayer(state, playerId, teamId) {
    for (const t of state.teams) t.playerIds = t.playerIds.filter((id) => id !== playerId);
    const target = state.teams.find((t) => t.id === teamId);
    if (target) target.playerIds.push(playerId);
  }

  function drawTeams(players, rng = Math.random) {
    const pots = new Map();
    for (const p of players) {
      const key = p.pot > 0 ? p.pot : Infinity;
      if (!pots.has(key)) pots.set(key, []);
      pots.get(key).push(p.id);
    }
    const teams = Object.fromEntries(TEAM_IDS.map((id) => [id, []]));
    for (const key of [...pots.keys()].sort((a, b) => a - b)) {
      const fromPot = Object.fromEntries(TEAM_IDS.map((id) => [id, 0]));
      for (const playerId of shuffle(pots.get(key), rng)) {
        const [target] = shuffle(TEAM_IDS, rng).sort(
          (a, b) => fromPot[a] - fromPot[b] || teams[a].length - teams[b].length,
        );
        teams[target].push(playerId);
        fromPot[target]++;
      }
    }
    return teams;
  }

  function applyDraw(state, rng) {
    const result = balancedDraw(state, rng);
    for (const t of state.teams) t.playerIds = result[t.id];
  }

  function balancedDraw(state, rng = Math.random) {
    const pairs = new Map();
    const history = (state.archives || []).filter((t) => t.id !== state.id);
    history.forEach((t, index) => {
      for (const team of t.teams) {
        const ids = team.playerIds;
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          const key = JSON.stringify([ids[i], ids[j]].sort());
          pairs.set(key, (pairs.get(key) || 0) + 1 + (index + 1) / Math.max(1, history.length));
        }
      }
    });
    const cost = (draw) => {
      let repeats = 0;
      const keepers = [];
      for (const ids of Object.values(draw)) {
        keepers.push(ids.filter((id) => state.players.find((p) => p.id === id)?.goalkeeper).length);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          repeats += pairs.get(JSON.stringify([ids[i], ids[j]].sort())) || 0;
        }
      }
      return [Math.max(...keepers) - Math.min(...keepers), repeats];
    };
    let best = drawTeams(state.players, rng), score = cost(best);
    for (let i = 0; i < 300; i++) {
      const next = drawTeams(state.players, rng), value = cost(next);
      if (value[0] < score[0] || (value[0] === score[0] && value[1] < score[1])) {
        best = next; score = value;
      }
    }
    return best;
  }

  function defaultLineups(state, m) {
    return Object.fromEntries([m.home, m.away].filter(Boolean).map((id) => [id, [...(state.teams.find((t) => t.id === id)?.playerIds || [])]]));
  }

  function matchLineups(state, m) {
    return m.lineups || defaultLineups(state, m);
  }

  function setLineup(state, m, playerId, teamId) {
    if (!state.players.some((p) => p.id === playerId) || (teamId && teamId !== m.home && teamId !== m.away)) return false;
    const lineups = structuredClone(matchLineups(state, m));
    // Bir golün sahibi, golün atıldığı taraftan yanlışlıkla çıkarılmasın.
    if (m.goals.some((g) => g.playerId === playerId && (g.ownGoal ? (g.team === m.home ? m.away : m.home) : g.team) !== teamId)) return false;
    for (const id of Object.keys(lineups)) lineups[id] = lineups[id].filter((p) => p !== playerId);
    if (teamId) lineups[teamId].push(playerId);
    m.lineups = lineups;
    m.lineupsInferred = false;
    return true;
  }

  function assignScorer(state, m, g, playerId, ownGoal = false) {
    const previous = { ...g };
    setScorer(g, null);
    const side = ownGoal ? (g.team === m.home ? m.away : m.home) : g.team;
    if (playerId && !setLineup(state, m, playerId, side)) {
      Object.assign(g, previous);
      return false;
    }
    setScorer(g, playerId, ownGoal);
    return true;
  }

  function archiveTournament(state, now = Date.now()) {
    if (!state.started || activeMatches(state).some((m) => m.status !== 'done') || !champion(state)) return false;
    syncPool(state);
    const { archives, playerPool, ...snapshot } = state;
    const old = archives.find((t) => t.id === state.id);
    const record = structuredClone({ ...snapshot, archivedAt: old?.archivedAt || now });
    const index = archives.findIndex((t) => t.id === state.id);
    if (index < 0) archives.push(record);
    else archives[index] = record;
    return true;
  }

  function resultError(state) {
    for (const m of activeMatches(state)) {
      const s = score(m);
      if (m.status === 'done' && m.stage !== 'league' && s.home === s.away &&
        (!Number.isSafeInteger(m.pens?.home) || !Number.isSafeInteger(m.pens?.away) || m.pens.home < 0 || m.pens.away < 0 || m.pens.home === m.pens.away)) return 'Berabere biten eleme maçının penaltı sonucunu girin.';
    }
    const trial = structuredClone(state);
    for (const stage of ['playoff', 'final']) {
      const original = state.matches.find((m) => m.stage === stage);
      const m = trial.matches.find((m) => m.stage === stage);
      if (!m || !original || original.status === 'pending' || !activeMatches(state).includes(original)) continue;
      m.status = 'pending';
      resolveKnockouts(trial);
      if (blockingTies(trial).length || m.home !== original.home || m.away !== original.away) return 'Bu skor, oynanmış eleme maçlarının eşleşmesini değiştiriyor. Önce sonraki aşamanın kayıtlarını kontrol edin.';
      Object.assign(m, structuredClone(original));
    }
    return null;
  }

  function nextTournament(state) {
    if (state.started && !archiveTournament(state)) return null;
    syncPool(state);
    const next = createState();
    next.playerPool = structuredClone(state.playerPool);
    next.archives = structuredClone(state.archives);
    next.settings = { ...state.settings, plannedDate: '', plannedStart: '', pitchEnd: '' };
    return next;
  }

  function historyStats(state) {
    const records = new Map((state.archives || []).map((t) => [t.id, t]));
    if (state.started) records.set(state.id, state);
    const players = new Map((state.playerPool || state.players).map((p) => [p.id, {
      ...p, tournaments: 0, played: 0, won: 0, drawn: 0, lost: 0, goals: 0, ownGoals: 0, penaltyWins: 0,
    }]));
    const pairs = new Map();
    const pair = (a, b) => {
      const ids = [a, b].sort(), key = JSON.stringify(ids);
      if (!pairs.has(key)) pairs.set(key, { ids, tournaments: 0, together: 0, against: 0, won: [0, 0], drawn: 0 });
      return pairs.get(key);
    };
    let matches = 0, goals = 0, unknownGoals = 0, tournaments = 0;
    for (const t of records.values()) {
      const done = t.matches.filter((m) => m.status === 'done');
      if (!done.length) continue;
      if (activeMatches(t).every((m) => m.status === 'done') && champion(t)) tournaments++;
      for (const p of t.players) {
        if (!players.has(p.id)) players.set(p.id, { ...p, tournaments: 0, played: 0, won: 0, drawn: 0, lost: 0, goals: 0, ownGoals: 0, penaltyWins: 0 });
        players.get(p.id).tournaments++;
      }
      for (const team of t.teams) for (let i = 0; i < team.playerIds.length; i++) for (let j = i + 1; j < team.playerIds.length; j++) pair(team.playerIds[i], team.playerIds[j]).tournaments++;
      for (const m of done) {
        matches++;
        const s = score(m), lineups = matchLineups(t, m);
        for (const side of ['home', 'away']) {
          const ids = [...new Set(lineups[m[side]] || [])];
          const gf = s[side], ga = s[side === 'home' ? 'away' : 'home'];
          for (const id of ids) {
            const p = players.get(id);
            if (!p) continue;
            p.played++;
            p[gf > ga ? 'won' : gf < ga ? 'lost' : 'drawn']++;
            if (gf === ga && winnerOf(m) === m[side]) p.penaltyWins++;
          }
          for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pair(ids[i], ids[j]).together++;
        }
        for (const a of lineups[m.home] || []) for (const b of lineups[m.away] || []) {
          const r = pair(a, b); r.against++;
          if (s.home === s.away) r.drawn++;
          else r.won[r.ids.indexOf(s.home > s.away ? a : b)]++;
        }
        for (const g of m.goals) {
          if (g.team !== m.home && g.team !== m.away) continue;
          goals++;
          const p = players.get(g.playerId);
          if (!p) unknownGoals++;
          else p[g.ownGoal ? 'ownGoals' : 'goals']++;
        }
      }
    }
    return { players: [...players.values()], pairs: [...pairs.values()], matches, goals, unknownGoals, tournaments };
  }

  function newMatch(id, stage, home, away, round = null) {
    return {
      id,
      stage,
      round,
      home,
      away,
      status: 'pending',
      goals: [],
      pens: null,
      durationMin: null,
      elapsedMs: 0,
      runningSince: null,
      startedAt: null,
      endedAt: null,
    };
  }

  function generateMatches(settings) {
    const matches = [];
    for (let round = 1; round <= settings.leagueRounds; round++) {
      for (const [a, b] of LEAGUE_CYCLE) {
        const [home, away] = round % 2 ? [a, b] : [b, a];
        matches.push(newMatch(`L${matches.length + 1}`, 'league', home, away, round));
      }
    }
    matches.push(newMatch('PO', 'playoff', null, null));
    matches.push(newMatch('F', 'final', null, null));
    return matches;
  }

  const hasFinal = (settings) => settings.finalEnabled !== false;
  // Playoff finale çıkacak takımı belirler; final yoksa playoff da oynanmaz.
  const hasPlayoff = (settings) => !!settings.playoffEnabled && hasFinal(settings);

  function activeMatches(state) {
    const s = state.settings;
    return state.matches.filter((m) => (m.stage === 'playoff' ? hasPlayoff(s) : m.stage === 'final' ? hasFinal(s) : true));
  }

  function stageMinutes(settings, stage) {
    return { league: settings.leagueMin, playoff: settings.playoffMin, final: settings.finalMin }[stage];
  }

  function matchMinutes(state, m) {
    return m.durationMin ?? stageMinutes(state.settings, m.stage);
  }

  function elapsedMs(m, now = Date.now()) {
    return m.elapsedMs + (m.runningSince != null ? now - m.runningSince : 0);
  }

  function remainingMs(state, m, now = Date.now()) {
    return matchMinutes(state, m) * MINUTE - elapsedMs(m, now);
  }

  function startMatch(state, m, now = Date.now()) {
    const lineups = structuredClone(matchLineups(state, m));
    Object.assign(m, newMatch(m.id, m.stage, m.home, m.away, m.round), {
      lineups,
      status: 'live',
      durationMin: stageMinutes(state.settings, m.stage),
      runningSince: now,
      startedAt: now,
    });
  }

  function toggleClock(m, now = Date.now()) {
    if (m.runningSince != null) {
      m.elapsedMs += now - m.runningSince;
      m.runningSince = null;
    } else {
      m.runningSince = now;
    }
  }

  function finishMatch(m, pens, now = Date.now()) {
    if (m.runningSince != null) toggleClock(m, now);
    m.status = 'done';
    m.endedAt = now;
    m.pens = pens || null;
  }

  function resetMatch(m) {
    delete m.lineups;
    delete m.lineupsInferred;
    Object.assign(m, newMatch(m.id, m.stage, m.home, m.away, m.round));
  }

  function addGoal(m, teamId, now = Date.now()) {
    const goal = { id: uid(), team: teamId, playerId: null, ms: m.status === 'live' ? elapsedMs(m, now) : null };
    m.goals.push(goal);
    return goal;
  }

  // Kendi kalesine golde oyuncu rakip takımdandır; gol yine golü kazanan takıma yazılır, gol krallığına sayılmaz.
  function setScorer(g, playerId, ownGoal = false) {
    g.playerId = playerId || null;
    if (ownGoal && g.playerId) g.ownGoal = true;
    else delete g.ownGoal;
  }

  function undoGoal(m, teamId) {
    for (let i = m.goals.length - 1; i >= 0; i--) {
      if (m.goals[i].team === teamId) return m.goals.splice(i, 1)[0];
    }
    return null;
  }

  function removeGoal(m, goalId) {
    m.goals = m.goals.filter((g) => g.id !== goalId);
  }

  function score(m) {
    let home = 0;
    let away = 0;
    for (const g of m.goals) {
      if (g.team === m.home) home++;
      else if (g.team === m.away) away++;
    }
    return { home, away };
  }

  function winnerOf(m) {
    if (m.status !== 'done') return null;
    const s = score(m);
    if (s.home !== s.away) return s.home > s.away ? m.home : m.away;
    if (m.pens && m.pens.home !== m.pens.away) return m.pens.home > m.pens.away ? m.home : m.away;
    return null;
  }

  function emptyRow(team, index) {
    return { team, index, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [], live: false };
  }

  function addResult(row, gf, ga) {
    row.played++;
    row.gf += gf;
    row.ga += ga;
    row.gd = row.gf - row.ga;
    if (gf > ga) {
      row.won++;
      row.pts += 3;
      return 'G';
    }
    if (gf === ga) {
      row.drawn++;
      row.pts += 1;
      return 'B';
    }
    row.lost++;
    return 'M';
  }

  function tableFor(teamIds, matches) {
    const rows = {};
    teamIds.forEach((id, index) => {
      rows[id] = emptyRow(id, index);
    });
    for (const m of matches) {
      if (!rows[m.home] || !rows[m.away]) continue;
      const s = score(m);
      const home = addResult(rows[m.home], s.home, s.away);
      const away = addResult(rows[m.away], s.away, s.home);
      if (m.status === 'live') {
        rows[m.home].live = true;
        rows[m.away].live = true;
      } else {
        rows[m.home].form.push(home);
        rows[m.away].form.push(away);
      }
    }
    return rows;
  }

  const byRecord = (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf;

  function chunkTies(list, cmp) {
    const out = [];
    for (const item of list) {
      const last = out[out.length - 1];
      if (last && cmp(last[0], item) === 0) last.push(item);
      else out.push([item]);
    }
    return out;
  }

  function computeStandings(state, { includeLive = true } = {}) {
    const counted = state.matches.filter(
      (m) => m.stage === 'league' && (m.status === 'done' || (includeLive && m.status === 'live')),
    );
    const table = tableFor(state.teams.map((t) => t.id), counted);
    const lots = state.lots || {};
    const rows = [];
    const unresolved = [];
    const ordered = Object.values(table).sort((a, b) => byRecord(a, b) || a.index - b.index);
    for (const group of chunkTies(ordered, byRecord)) {
      if (group.length === 1) {
        rows.push(group[0]);
        continue;
      }
      const h2h = tableFor(group.map((r) => r.team), counted);
      const byH2h = (a, b) => byRecord(h2h[a.team], h2h[b.team]);
      const sorted = [...group].sort((a, b) => byH2h(a, b) || a.index - b.index);
      for (const sub of chunkTies(sorted, byH2h)) {
        if (sub.length > 1) {
          if (sub.every((r) => lots[r.team] != null)) sub.sort((a, b) => lots[a.team] - lots[b.team]);
          else unresolved.push(sub.map((r) => r.team));
        }
        rows.push(...sub);
      }
    }
    return { rows, unresolved };
  }

  function leagueDone(state) {
    const league = state.matches.filter((m) => m.stage === 'league');
    return league.length > 0 && league.every((m) => m.status === 'done');
  }

  function blockingTies(state) {
    if (!leagueDone(state)) return [];
    const { rows, unresolved } = computeStandings(state, { includeLive: false });
    const pos = Object.fromEntries(rows.map((r, i) => [r.team, i]));
    const s = state.settings;
    const cut = hasPlayoff(s) || !hasFinal(s) ? 1 : 2;
    return unresolved.filter((group) => {
      const idx = group.map((id) => pos[id]);
      return Math.min(...idx) < cut && Math.max(...idx) >= cut;
    });
  }

  function resolveKnockouts(state) {
    const po = state.matches.find((m) => m.stage === 'playoff');
    const fin = state.matches.find((m) => m.stage === 'final');
    if (!po || !fin) return;
    const setTeams = (m, home, away) => {
      if (m.status !== 'pending') return;
      if (m.home !== home || m.away !== away) {
        delete m.lineups;
        delete m.lineupsInferred;
      }
      m.home = home;
      m.away = away;
    };
    if (!leagueDone(state)) {
      setTeams(po, null, null);
      setTeams(fin, null, null);
      return;
    }
    const order = computeStandings(state, { includeLive: false }).rows.map((r) => r.team);
    if (hasPlayoff(state.settings)) {
      setTeams(po, order[1], order[2]);
      setTeams(fin, order[0], winnerOf(po));
    } else {
      setTeams(fin, order[0], order[1]);
    }
  }

  function champion(state) {
    if (!hasFinal(state.settings)) {
      if (!leagueDone(state) || blockingTies(state).length) return null;
      return computeStandings(state, { includeLive: false }).rows[0].team;
    }
    const fin = state.matches.find((m) => m.stage === 'final');
    return fin ? winnerOf(fin) : null;
  }

  function topScorers(state) {
    const counts = new Map();
    let anonymous = 0;
    for (const m of state.matches) {
      if (m.status === 'pending') continue;
      for (const g of m.goals) {
        if (g.ownGoal) continue;
        if (!g.playerId) anonymous++;
        else counts.set(g.playerId, (counts.get(g.playerId) || 0) + 1);
      }
    }
    const list = [...counts]
      .map(([playerId, goals]) => {
        const p = state.players.find((x) => x.id === playerId);
        if (!p) return null;
        const team = teamOfPlayer(state, playerId);
        return { playerId, name: p.name, team: team ? team.id : null, goals };
      })
      .filter(Boolean)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'tr'));
    return { list, anonymous };
  }

  function parseClock(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
  }

  // Gece maçlarında (23:30 başlangıç, 01:00 bitiş) doğru günü bulmak için en yakın tarih seçilir.
  function nearestOccurrence(hhmm, ref) {
    const c = parseClock(hhmm);
    if (!c) return null;
    const d = new Date(ref);
    d.setHours(c.h, c.m, 0, 0);
    const t = d.getTime();
    return [t - DAY, t + DAY].reduce((best, x) => (Math.abs(x - ref) < Math.abs(best - ref) ? x : best), t);
  }

  // Geçmiş bir tarih eski turnuvadan kalmıştır; yok sayılır.
  function plannedDay(settings, now = Date.now()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(settings.plannedDate || '');
    if (!m) return null;
    const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    const today = new Date(now).setHours(0, 0, 0, 0);
    return day >= today ? day : null;
  }

  function occurrenceAfter(hhmm, ref) {
    let t = nearestOccurrence(hhmm, ref);
    if (t == null) return null;
    while (t <= ref) t += DAY;
    return t;
  }

  function gapBefore(settings, prev, m) {
    if (!prev) return 0;
    const min = prev.stage === 'league' && m.stage !== 'league' ? settings.breakMin : settings.changeMin;
    return min * MINUTE;
  }

  function schedule(state, now = Date.now()) {
    const s = state.settings;
    const list = activeMatches(state);
    const started = list.filter((m) => m.startedAt).map((m) => m.startedAt);
    const day = started.length || !parseClock(s.plannedStart) ? null : plannedDay(s, now);
    const ref = started.length ? Math.min(...started) : day != null ? day + DAY / 2 : now;
    const start = nearestOccurrence(s.plannedStart, ref) ?? ref;
    const items = [];
    let planned = start;
    let est = null;
    let prev = null;
    for (const m of list) {
      const gap = gapBefore(s, prev, m);
      const dur = matchMinutes(state, m) * MINUTE;
      const plannedStart = planned + gap;
      planned = plannedStart + dur;
      let estStart;
      let estEnd;
      if (m.status === 'done') {
        estStart = m.startedAt;
        estEnd = m.endedAt;
      } else if (m.status === 'live') {
        estStart = m.startedAt;
        estEnd = now + Math.max(0, remainingMs(state, m, now));
      } else {
        estStart = Math.max(est == null ? plannedStart : est + gap, now);
        estEnd = estStart + dur;
      }
      est = est == null ? estEnd : Math.max(est, estEnd);
      items.push({ id: m.id, plannedStart, plannedEnd: planned, estStart, estEnd });
      prev = m;
    }
    const estEnd = est ?? planned;
    const pitchEnd = occurrenceAfter(s.pitchEnd, start);
    const po = list.find((m) => m.stage === 'playoff');
    return {
      items,
      start,
      plannedEnd: planned,
      estEnd,
      delayMs: estEnd - planned,
      pitchEnd,
      overMs: pitchEnd == null ? null : estEnd - pitchEnd,
      playoffSaving: po && po.status === 'pending' ? (matchMinutes(state, po) + s.changeMin) * MINUTE : 0,
    };
  }

  function playTimeRange(settings) {
    const league = settings.leagueRounds * 2 * settings.leagueMin;
    if (!hasFinal(settings)) return [league, league];
    if (!hasPlayoff(settings)) return [league, league + settings.finalMin];
    return [
      league + Math.min(settings.playoffMin, settings.finalMin),
      league + settings.playoffMin + settings.finalMin,
    ];
  }

  return {
    TEAM_IDS,
    MINUTE,
    DEFAULT_SETTINGS,
    LIMITS,
    createState,
    isValidState,
    migrate,
    syncPool,
    selectPlayer,
    mergePlayers,
    matchLineups,
    setLineup,
    assignScorer,
    archiveTournament,
    resultError,
    nextTournament,
    historyStats,
    balancedDraw,
    addPlayers,
    removePlayer,
    teamOfPlayer,
    movePlayer,
    drawTeams,
    applyDraw,
    generateMatches,
    hasFinal,
    hasPlayoff,
    activeMatches,
    matchMinutes,
    elapsedMs,
    remainingMs,
    startMatch,
    toggleClock,
    finishMatch,
    resetMatch,
    addGoal,
    setScorer,
    undoGoal,
    removeGoal,
    score,
    winnerOf,
    computeStandings,
    leagueDone,
    blockingTies,
    resolveKnockouts,
    champion,
    topScorers,
    plannedDay,
    schedule,
    playTimeRange,
  };
});
