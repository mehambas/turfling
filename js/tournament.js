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
    playoffMin: 10,
    finalMin: 15,
    changeMin: 2,
    breakMin: 3,
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
      version: 1,
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
    return !!raw && typeof raw === 'object' && Array.isArray(raw.players) && Array.isArray(raw.teams) && raw.teams.length === TEAM_IDS.length;
  }

  function migrate(raw) {
    const base = createState();
    if (!isValidState(raw)) return base;
    return {
      ...base,
      ...raw,
      settings: { ...base.settings, ...raw.settings },
      matches: Array.isArray(raw.matches) ? raw.matches : [],
      lots: raw.lots || {},
    };
  }

  function shuffle(list, rng = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function addPlayers(state, names) {
    const existing = new Set(state.players.map((p) => p.name.toLocaleLowerCase('tr')));
    let added = 0;
    for (const raw of names) {
      const name = String(raw).trim().replace(/\s+/g, ' ');
      const key = name.toLocaleLowerCase('tr');
      if (!name || existing.has(key)) continue;
      existing.add(key);
      state.players.push({ id: uid(), name, pot: 0 });
      added++;
    }
    return added;
  }

  function removePlayer(state, playerId) {
    state.players = state.players.filter((p) => p.id !== playerId);
    for (const t of state.teams) t.playerIds = t.playerIds.filter((id) => id !== playerId);
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
    const result = drawTeams(state.players, rng);
    for (const t of state.teams) t.playerIds = result[t.id];
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

  function activeMatches(state) {
    return state.matches.filter((m) => m.stage !== 'playoff' || state.settings.playoffEnabled);
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
    Object.assign(m, newMatch(m.id, m.stage, m.home, m.away, m.round), {
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
    Object.assign(m, newMatch(m.id, m.stage, m.home, m.away, m.round));
  }

  function addGoal(m, teamId, now = Date.now()) {
    const goal = { id: uid(), team: teamId, playerId: null, ms: m.status === 'live' ? elapsedMs(m, now) : null };
    m.goals.push(goal);
    return goal;
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

  function withoutHeldGoals(state) {
    const held = (m) => m.goals.some((g) => g.held);
    if (!state.matches.some(held)) return state;
    return { ...state, matches: state.matches.map((m) => (held(m) ? { ...m, goals: m.goals.filter((g) => !g.held) } : m)) };
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
    const cut = state.settings.playoffEnabled ? 1 : 2;
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
      m.home = home;
      m.away = away;
    };
    if (!leagueDone(state)) {
      setTeams(po, null, null);
      setTeams(fin, null, null);
      return;
    }
    const order = computeStandings(state, { includeLive: false }).rows.map((r) => r.team);
    if (state.settings.playoffEnabled) {
      setTeams(po, order[1], order[2]);
      setTeams(fin, order[0], winnerOf(po));
    } else {
      setTeams(fin, order[0], order[1]);
    }
  }

  function champion(state) {
    const fin = state.matches.find((m) => m.stage === 'final');
    return fin ? winnerOf(fin) : null;
  }

  function topScorers(state) {
    const counts = new Map();
    let anonymous = 0;
    for (const m of state.matches) {
      if (m.status === 'pending') continue;
      for (const g of m.goals) {
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
    const ref = started.length ? Math.min(...started) : now;
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
    if (!settings.playoffEnabled) return [league, league + settings.finalMin];
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
    addPlayers,
    removePlayer,
    teamOfPlayer,
    movePlayer,
    drawTeams,
    applyDraw,
    generateMatches,
    activeMatches,
    matchMinutes,
    elapsedMs,
    remainingMs,
    startMatch,
    toggleClock,
    finishMatch,
    resetMatch,
    addGoal,
    undoGoal,
    removeGoal,
    withoutHeldGoals,
    score,
    winnerOf,
    computeStandings,
    leagueDone,
    blockingTies,
    resolveKnockouts,
    champion,
    topScorers,
    schedule,
    playTimeRange,
  };
});
