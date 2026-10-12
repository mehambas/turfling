(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tournament.js'));
  else root.Views = factory(root.Tournament);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  const MINUTE = T.MINUTE;
  const DEFAULT_NAME = 'Halı Saha Turnuvası';
  const RING_LENGTH = 2 * Math.PI * 88;

  const COLORS = {
    red: { label: 'Kırmızı', plural: 'Kırmızılar', hex: '#e5484d' },
    blue: { label: 'Mavi', plural: 'Maviler', hex: '#3e63dd' },
    yellow: { label: 'Sarı', plural: 'Sarılar', hex: '#ffcf33' },
    green: { label: 'Yeşil', plural: 'Yeşiller', hex: '#2f9e5b' },
    orange: { label: 'Turuncu', plural: 'Turuncular', hex: '#f76b15' },
    purple: { label: 'Mor', plural: 'Morlar', hex: '#8e4ec6' },
    pink: { label: 'Pembe', plural: 'Pembeler', hex: '#e93d82' },
    teal: { label: 'Turkuaz', plural: 'Turkuazlar', hex: '#12a594' },
    white: { label: 'Beyaz', plural: 'Beyazlar', hex: '#f4f4f1' },
    black: { label: 'Siyah', plural: 'Siyahlar', hex: '#2a2c31' },
  };

  // #e5484d zemin üstünde beyaz "+ Gol" yazısı yeterince okunmuyor.
  const BUTTON_HEX = { red: '#ce2c31' };

  const svg = (body) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  const ICONS = {
    ball: svg('<circle cx="12" cy="12" r="9.5"/><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z"/>'),
    soundOn: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
    soundOff: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    expand: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    compress: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'),
    tv: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    pencil: svg('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    pause: svg('<path d="M8 5v14M16 5v14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="m5 12 5 5 9-10"/>'),
    chevron: svg('<path d="m6 9 6 6 6-6"/>'),
    swap: svg('<path d="M4 8h14l-4-4M20 16H6l4 4"/>'),
    shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
    upload: svg('<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>'),
    trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    broadcast: svg('<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>'),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4M12 2v13"/>'),
    lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  };

  const TV_LINES =
    '<svg class="tv-lines" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true"><rect x="24" y="24" width="1232" height="672" rx="6"/><line x1="640" y1="24" x2="640" y2="696"/><circle cx="640" cy="360" r="120"/><rect x="24" y="200" width="150" height="320"/><rect x="1106" y="200" width="150" height="320"/></svg>';

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function inkFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return l > 0.6 ? '#0f1a14' : '#ffffff';
  }

  function teamStyle(t) {
    const key = COLORS[t?.color] ? t.color : 'red';
    const hex = COLORS[key].hex;
    const btn = BUTTON_HEX[key] || hex;
    return `--team:${hex};--team-btn:${btn};--team-btn-ink:${inkFor(btn)}`;
  }

  function fmtClock(ms) {
    const over = ms < 0;
    const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
    return `${over ? '+' : ''}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function fmtTime(ts) {
    return ts == null ? '–' : new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  const goalMinute = (g) => (g.ms == null ? '' : `${Math.floor(g.ms / MINUTE) + 1}'`);

  let wakeLock = null;
  let wakePending = false;
  async function keepAwake(on) {
    if (!('wakeLock' in navigator) || wakePending) return;
    try {
      if (on && !wakeLock && document.visibilityState === 'visible') {
        wakePending = true;
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } else if (!on && wakeLock) {
        const lock = wakeLock;
        wakeLock = null;
        await lock.release();
      }
    } catch {
      wakeLock = null;
    } finally {
      wakePending = false;
    }
  }

  const WATCH_NOTICES = {
    connecting: ['Canlı yayın', 'Bağlanıyor…', ''],
    notfound: ['Canlı yayın', 'Yayın bulunamadı', 'Link eksik ya da hatalı. Organizatörden linki yeniden iste.'],
    empty: ['Hoş geldiniz', DEFAULT_NAME, 'Turnuva henüz başlamadı'],
  };

  function create(getState) {
    const team = (id) => getState().teams.find((t) => t.id === id) || null;
    const player = (id) => getState().players.find((p) => p.id === id) || null;
    const liveMatch = () => getState().matches.find((m) => m.status === 'live') || null;
    const nextMatch = () => T.activeMatches(getState()).find((m) => m.status === 'pending') || null;
    const findStage = (stage, list = getState().matches) => list.find((m) => m.stage === stage) || null;
    const estimates = (st) => Object.fromEntries(T.schedule(st).items.map((i) => [i.id, i]));
    const tournamentName = () => getState()?.name.trim() || DEFAULT_NAME;

    function lastFinished() {
      return getState().matches.filter((m) => m.status === 'done').sort((a, b) => b.endedAt - a.endedAt)[0] || null;
    }

    function matchTitle(m, list = getState().matches) {
      if (m.stage === 'league') return `${list.filter((x) => x.stage === 'league').indexOf(m) + 1}. maç`;
      return m.stage === 'playoff' ? 'Playoff' : 'Final';
    }

    function matchLabel(m) {
      if (m.stage !== 'league') return matchTitle(m);
      return `${matchTitle(m)} <span class="of">/ ${T.activeMatches(getState()).length}</span>`;
    }

    function placeholder(m, side) {
      if (m.stage === 'playoff') return side === 'home' ? 'Lig 2.si' : 'Lig 3.sü';
      if (side === 'home') return 'Lig 1.si';
      return getState().settings.playoffEnabled ? 'Playoff galibi' : 'Lig 2.si';
    }

    function teamName(id, m, side, { cls = '', end = false } = {}) {
      const t = team(id);
      const order = end ? ' is-end' : '';
      if (!t) return `<span class="tn is-tbd${order}"><span class="sw"></span><span class="tn-name">${m ? placeholder(m, side) : '?'}</span></span>`;
      return `<span class="tn${order}${cls}" style="${teamStyle(t)}"><span class="sw"></span><span class="tn-name">${esc(t.name)}</span></span>`;
    }

    function lastResult(m) {
      const s = T.score(m);
      return `${esc(team(m.home)?.name)} ${s.home}–${s.away} ${esc(team(m.away)?.name)}${m.pens ? ` (pen. ${m.pens.home}–${m.pens.away})` : ''}`;
    }

    function goalList(m, teamId) {
      return m.goals
        .filter((g) => !teamId || g.team === teamId)
        .map((g) => {
          const p = player(g.playerId);
          return p ? `${esc(p.name)} ${goalMinute(g)}` : goalMinute(g);
        })
        .filter(Boolean)
        .join(' · ');
    }

    function championData(id) {
      const t = team(id);
      const fin = findStage('final');
      const players = t.playerIds.map(player).filter(Boolean).map((p) => `<span>${esc(p.name)}</span>`).join('');
      const { list } = T.topScorers(getState());
      const best = list.filter((x) => x.goals === list[0]?.goals);
      return { t, fin, players, best };
    }

    function renderStandings() {
      const state = getState();
      const { rows, unresolved } = T.computeStandings(state);
      const zones = state.settings.playoffEnabled ? ['final', 'playoff', 'playoff'] : ['final', 'final', 'out'];
      const tied = new Set(T.leagueDone(state) ? unresolved.flat() : []);
      const gd = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
      return `<section class="card side-card" aria-labelledby="h-table">
      <h2 class="card-title" id="h-table">Puan durumu</h2>
      <table class="standings">
        <thead><tr><th><span class="sr">Sıra</span></th><th><span class="sr">Takım</span></th><th title="Oynanan" abbr="Oynanan">O</th><th title="Averaj" abbr="Averaj">Av</th><th title="Puan" abbr="Puan">P</th></tr></thead>
        <tbody>${rows
          .map((r, i) => {
            const t = team(r.team);
            return `<tr>
              <td><span class="rank rank-${zones[i]}">${i + 1}</span>${tied.has(r.team) ? '<span class="tie" title="Eşitlik henüz çözülmedi">=</span>' : ''}</td>
              <td>${teamName(t.id)}</td>
              <td>${r.played}</td><td>${gd(r.gd)}</td><td class="pts">${r.pts}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table>
      <p class="card-note">${state.settings.playoffEnabled ? '1. finale direkt · 2. ve 3. playoff' : '1. ve 2. finalde'}</p>
    </section>`;
    }

    function fixtureGroups(st) {
      const groups = [];
      const rounds = Math.max(0, ...st.matches.map((m) => m.round || 0));
      for (let r = 1; r <= rounds; r++) {
        groups.push({ title: `Lig · ${r}. devre`, matches: st.matches.filter((m) => m.stage === 'league' && m.round === r) });
      }
      groups.push({ title: 'Eleme', matches: st.matches.filter((m) => m.stage !== 'league') });
      return groups;
    }

    function renderScreen({ panel = '', status = '', full = false } = {}) {
      const state = getState();
      const live = liveMatch();
      const champ = state.started ? T.champion(state) : null;
      const sc = state.started ? T.schedule(state) : null;
      const est = sc ? Object.fromEntries(sc.items.map((i) => [i.id, i])) : {};
      let body;
      if (!state.started) body = screenIdle();
      else if (live) body = screenLive(live);
      else if (champ) body = screenChampion(champ);
      else body = screenBreak(est);
      const next = live ? T.activeMatches(state).find((m) => m.status === 'pending') : null;
      return `<div class="tv">
      ${TV_LINES}
      <div class="tv-body">
        <header class="tv-head">
          <div class="tv-brand"><span class="tv-mark">${ICONS.ball}</span><span class="tv-brand-name">${esc(tournamentName())}</span></div>
          <div class="tv-status">${live ? `<span class="tag-live">Canlı</span><span class="tv-no">${matchLabel(live)}</span>` : ''}</div>
          <div class="tv-tools">
            ${status}
            ${sc && !champ ? `<span class="tv-end">Bitiş <strong>${fmtTime(sc.estEnd)}</strong></span>` : ''}
            ${state.started ? `<button class="tv-btn" data-action="screen-fixtures" aria-haspopup="dialog">${ICONS.list}Fikstür</button>` : ''}
            <button class="tv-btn tv-icon" data-action="toggle-fullscreen" aria-label="${full ? 'Tam ekrandan çık' : 'Tam ekran'}" title="${full ? 'Tam ekrandan çık' : 'Tam ekran'}">${full ? ICONS.compress : ICONS.expand}</button>
          </div>
        </header>
        ${body}
        ${next ? screenNext(next, est) : ''}
      </div>
      ${panel}
    </div>`;
    }

    function screenTeam(m, side, end = false) {
      const t = team(m[side]);
      if (!t) return `<span class="tv-tn is-tbd${end ? ' is-end' : ''}"><span class="sw"></span>${placeholder(m, side)}</span>`;
      return `<span class="tv-tn${end ? ' is-end' : ''}" style="${teamStyle(t)}"><span class="sw"></span>${esc(t.name)}</span>`;
    }

    function screenLive(m) {
      const s = T.score(m);
      const home = team(m.home);
      const away = team(m.away);
      const side = (t, cls) => `<div class="tv-team ${cls}" style="${teamStyle(t)}">
        <span class="tv-name"><span class="sw"></span><span>${esc(t.name)}</span></span>
        <span class="tv-scorers">${goalList(m, t.id)}</span>
      </div>`;
      return `<div class="tv-board">
        ${side(home, 'tv-home')}
        <div class="tv-score" role="img" aria-label="Skor: ${esc(home.name)} ${s.home}, ${esc(away.name)} ${s.away}"><span>${s.home}</span><span class="tv-dash">–</span><span>${s.away}</span></div>
        ${side(away, 'tv-away')}
      </div>
      <div class="tv-clockwrap">
        <div class="tv-clock" data-clock>
          <span class="lc-state" data-timer-state></span>
          <span class="tv-time" data-timer></span>
          <span class="lc-bar tv-bar"><span data-timer-bar></span></span>
        </div>
      </div>`;
    }

    function screenBreak(est) {
      const m = nextMatch();
      if (!m) return '<div class="tv-center"><span class="tv-sub">Sıradaki maç bekleniyor</span></div>';
      const last = lastFinished();
      const it = est[m.id];
      return `<div class="tv-center">
      <span class="tv-kicker">Sıradaki · ${matchLabel(m)}</span>
      <div class="tv-big">${screenTeam(m, 'home')}<span class="tv-dash">–</span>${screenTeam(m, 'away', true)}</div>
      ${it && m.home && m.away ? `<span class="tv-sub">Tahmini başlama ${fmtTime(it.estStart)}</span>` : ''}
      ${last ? `<span class="tv-last">Son maç: ${lastResult(last)}</span>` : ''}
    </div>`;
    }

    function screenChampion(id) {
      const { t, fin, players, best } = championData(id);
      return `<div class="tv-center" style="${teamStyle(t)}">
      <span class="champ-icon tv-trophy">${ICONS.trophy}</span>
      <span class="tv-kicker">Şampiyon</span>
      <div class="tv-big"><span class="tv-tn"><span class="sw"></span>${esc(t.name)}</span></div>
      <span class="tv-sub">Final: ${lastResult(fin)}</span>
      <div class="champ-players tv-players">${players}</div>
      ${best.length ? `<span class="tv-last">Gol kralı: ${best.map((b) => esc(b.name)).join(', ')} · ${best[0].goals} gol</span>` : ''}
    </div>`;
    }

    function screenIdle() {
      return `<div class="tv-center">
      <span class="tv-kicker">Hoş geldiniz</span>
      <div class="tv-big">${esc(tournamentName())}</div>
      <span class="tv-sub">Turnuva henüz başlamadı</span>
    </div>`;
    }

    function screenNext(m, est) {
      const it = est[m.id];
      return `<section class="tv-next" aria-label="Sıradaki maç">
      <span class="tv-next-label">Sıradaki${it && m.home && m.away ? ` · ${fmtTime(it.estStart)}` : ''}</span>
      <span class="tv-next-teams">${screenTeam(m, 'home')}<span class="tv-dash">–</span>${screenTeam(m, 'away', true)}</span>
    </section>`;
    }

    function screenNotice(kind) {
      const [kicker, title, sub] = WATCH_NOTICES[kind] || WATCH_NOTICES.connecting;
      return `<div class="tv">
      ${TV_LINES}
      <div class="tv-body">
        <header class="tv-head"><div class="tv-brand"><span class="tv-mark">${ICONS.ball}</span><span class="tv-brand-name">${DEFAULT_NAME}</span></div></header>
        <div class="tv-center">
          <span class="tv-kicker">${kicker}</span>
          <div class="tv-big">${title}</div>
          ${sub ? `<span class="tv-sub">${sub}</span>` : ''}
        </div>
      </div>
    </div>`;
    }

    const SYNC_PILL = '<span class="iz-pill is-sync" role="status">Güncelleniyor…</span>';

    // İzleyici sayfası: geniş ekranda yayın ekranı, telefonda alt alta düzen.
    function renderWatch({ wide = false, notice = 'connecting', updating = false, full = false } = {}) {
      const state = getState();
      if (wide) return state ? renderScreen({ status: updating ? SYNC_PILL : '', full }) : screenNotice(notice);

      let pill = '';
      let body;
      let layout = ' is-center';
      if (!state) {
        body = watchHero(...(WATCH_NOTICES[notice] || WATCH_NOTICES.connecting));
      } else if (!state.started) {
        body = watchHero('Hoş geldiniz', esc(tournamentName()), 'Turnuva henüz başlamadı');
      } else if (liveMatch()) {
        pill = '<span class="tag-live">Canlı</span>';
        body = watchLive(liveMatch());
        layout = '';
      } else if (T.champion(state)) {
        pill = '<span class="iz-pill">Turnuva bitti</span>';
        body = watchChampion(T.champion(state));
      } else {
        if (lastFinished()) pill = '<span class="iz-pill">Maç arası</span>';
        body = watchBreak(estimates(state));
        layout = ' is-break';
      }
      return `<div class="iz">
      <div class="iz-field" aria-hidden="true"><span class="iz-field-mid"></span><span class="iz-field-circle"></span><span class="iz-field-box"></span><span class="iz-field-box is-bottom"></span></div>
      <header class="iz-head">
        <span class="iz-brand"><span class="iz-mark">${ICONS.ball}</span><span class="iz-brand-name">${esc(tournamentName())}</span></span>
        <span class="iz-pills">${state && updating ? SYNC_PILL : ''}${pill}</span>
      </header>
      <main class="iz-main${layout}">${body}</main>
      ${state?.started ? `<div class="iz-foot"><button class="iz-open" data-action="sheet-open" aria-haspopup="dialog">${ICONS.list}Fikstür ve puan durumu</button></div>` : ''}
    </div>`;
    }

    function watchHero(kicker, title, sub) {
      return `<div class="iz-hero">
        ${kicker ? `<span class="iz-hero-kicker">${kicker}</span>` : ''}
        <h1 class="iz-hero-title">${title}</h1>
        ${sub ? `<p class="iz-hero-sub">${sub}</p>` : ''}
      </div>`;
    }

    function watchKicker(m) {
      if (m.stage !== 'league') return matchTitle(m);
      return `${matchTitle(m)} · Lig${getState().settings.leagueRounds > 1 ? ` ${m.round}. devre` : ''}`;
    }

    function watchTeam(m, side) {
      const t = team(m[side]);
      return `<div class="iz-team" style="${teamStyle(t)}">
        <div class="iz-team-l">
          <span class="iz-tname"><span class="sw"></span><span class="tn-name">${esc(t.name)}</span></span>
          <span class="iz-scorers">${goalList(m, t.id)}</span>
        </div>
        <span class="iz-goals">${T.score(m)[side]}</span>
      </div>`;
    }

    function watchLive(m) {
      const state = getState();
      const s = T.score(m);
      const next = nextMatch();
      return `<span class="iz-kicker">${watchKicker(m)}</span>
      <section class="iz-board" aria-label="Skor: ${esc(team(m.home).name)} ${s.home}, ${esc(team(m.away).name)} ${s.away}">
        ${watchTeam(m, 'home')}${watchTeam(m, 'away')}
      </section>
      <section class="iz-clock" aria-label="Kalan süre">
        <div class="iz-ring" data-clock data-timer-progress role="progressbar" aria-label="Geçen süre" aria-valuemin="0" aria-valuemax="100">
          <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="iz-ring-track" cx="100" cy="100" r="88"/><circle class="iz-ring-fill" data-timer-ring cx="100" cy="100" r="88" transform="rotate(-90 100 100)"/></svg>
          <span class="iz-ring-c"><span class="iz-time" data-timer></span><span class="iz-ring-cap" data-timer-state data-running="kalan · ${T.matchMinutes(state, m)} dk"></span></span>
        </div>
      </section>
      ${next ? watchNext(next, estimates(state)) : ''}`;
    }

    function watchNext(m, est) {
      const it = est[m.id];
      return `<section class="iz-next" aria-label="Sıradaki maç">
        <span class="iz-next-label">Sıradaki${it ? `<br>${fmtTime(it.estStart)}` : ''}</span>
        <span class="iz-next-teams">${screenTeam(m, 'home')}<span class="tv-dash" aria-hidden="true">–</span>${screenTeam(m, 'away', true)}</span>
      </section>`;
    }

    function watchBreak(est) {
      const m = nextMatch();
      if (!m) return watchHero('', 'Sıradaki maç bekleniyor', '');
      const last = lastFinished();
      const it = est[m.id];
      return `<span class="iz-kicker">Sıradaki · ${matchTitle(m)}</span>
      <div class="iz-vs">${screenTeam(m, 'home')}<span class="iz-vs-dash" aria-hidden="true">–</span>${screenTeam(m, 'away')}</div>
      ${it ? `<div class="iz-eta"><span>Tahmini başlama</span><strong>${fmtTime(it.estStart)}</strong><span>${T.matchMinutes(getState(), m)} dakikalık maç</span></div>` : ''}
      ${last ? watchLast(last) : ''}`;
    }

    function watchLast(m) {
      const s = T.score(m);
      const w = T.winnerOf(m);
      const side = (k) => {
        const t = team(m[k]);
        const cls = `${k === 'home' ? ' is-end' : ''}${w && w !== m[k] ? ' is-lose' : ''}`;
        return `<span class="tv-tn${cls}" style="${teamStyle(t)}"><span class="sw"></span>${esc(t?.name)}</span>`;
      };
      const goals = goalList(m);
      return `<section class="iz-last" aria-label="Son maç">
        <span class="iz-last-head">Son maç · ${matchTitle(m)}</span>
        <div class="iz-last-row">${side('home')}<span class="iz-last-score">${s.home} – ${s.away}</span>${side('away')}</div>
        ${m.pens ? `<span class="iz-last-note">Penaltılar ${m.pens.home}–${m.pens.away}</span>` : ''}
        ${goals ? `<span class="iz-last-note">${goals}</span>` : ''}
      </section>`;
    }

    function watchChampion(id) {
      const { t, fin, players, best } = championData(id);
      return `<div class="iz-hero" style="${teamStyle(t)}">
        <span class="champ-icon">${ICONS.trophy}</span>
        <span class="iz-hero-kicker">Şampiyon</span>
        <h1 class="iz-hero-title iz-champ"><span class="sw"></span>${esc(t.name)}</h1>
        <p class="iz-hero-sub">Final: ${lastResult(fin)}</p>
        <div class="champ-players">${players}</div>
        ${best.length ? `<p class="iz-hero-note">Gol kralı: ${best.map((b) => esc(b.name)).join(', ')} · ${best[0].goals} gol</p>` : ''}
      </div>`;
    }

    function renderSheet({ scorersOpen = false } = {}) {
      const state = getState();
      if (!state?.started) return '';
      const live = liveMatch();
      let peek = esc(tournamentName());
      if (live) {
        const s = T.score(live);
        peek = `${esc(team(live.home).name)} <strong>${s.home} – ${s.away}</strong> ${esc(team(live.away).name)} · <span data-timer></span>`;
      }
      return `<div class="iz-peek" data-action="sheet-close" aria-hidden="true"><span>${peek}</span></div>
      <section class="iz-sheet">
        <span class="iz-grip" aria-hidden="true"></span>
        <div class="iz-sheet-head">
          <h2 id="iz-sheet-title">Fikstür ve puan</h2>
          <button class="iz-close" data-action="sheet-close" aria-label="Kapat" autofocus>${ICONS.x}</button>
        </div>
        <div class="iz-sheet-top">${renderStandings()}${watchScorers(scorersOpen)}</div>
        ${watchFixtures()}
      </section>`;
    }

    function watchScorers(open) {
      const { list } = T.topScorers(getState());
      const label = '<span class="iz-kings-label">Gol kralı</span>';
      if (!list.length) {
        return `<section class="iz-kings" aria-label="Gol krallığı"><div class="iz-kings-btn">${label}<span class="iz-kings-none">Henüz gol yok</span></div></section>`;
      }
      const top = list[0].goals;
      const leaders = list.filter((s) => s.goals === top);
      const sw = (s) => {
        const t = team(s.team);
        return t ? `<span class="sw" style="${teamStyle(t)}"></span>` : '<span class="is-tbd"><span class="sw"></span></span>';
      };
      const lead =
        leaders
          .slice(0, 2)
          .map((s) => `<span class="iz-kings-name">${sw(s)}<span class="tn-name">${esc(s.name)}</span></span>`)
          .join('<span class="iz-kings-sep" aria-hidden="true">·</span>') + (leaders.length > 2 ? `<span class="iz-kings-more">+${leaders.length - 2}</span>` : '');
      const rows = list
        .map((s, i) => {
          const rank = 1 + list.filter((x) => x.goals > s.goals).length;
          const first = i === 0 || list[i - 1].goals !== s.goals;
          return `<li${rank === 1 ? ' class="is-top"' : ''}><span class="iz-kings-rank">${first ? rank : ''}</span>${sw(s)}<span class="tn-name">${esc(s.name)}</span><strong>${s.goals}</strong></li>`;
        })
        .join('');
      return `<section class="iz-kings" aria-label="Gol krallığı">
        <button class="iz-kings-btn" data-action="scorers-toggle" aria-expanded="${open}" aria-controls="iz-kings-list">
          ${label}<span class="iz-kings-lead">${lead}<strong>${top} gol</strong>${ICONS.chevron}</span>
        </button>
        <ol class="iz-kings-list" id="iz-kings-list"${open ? '' : ' hidden'}>${rows}</ol>
      </section>`;
    }

    function watchFixtures() {
      const state = getState();
      const est = estimates(state);
      const groups = fixtureGroups(state)
        .map((g) => ({ ...g, matches: g.matches.filter((m) => m.stage !== 'playoff' || state.settings.playoffEnabled) }))
        .filter((g) => g.matches.length);
      return `<div class="iz-fx">${groups
        .map((g) => `<section class="iz-fx-group" aria-label="${g.title}"><h3 class="iz-fx-title">${g.title}</h3>${g.matches.map((m) => watchFixtureRow(m, est[m.id])).join('')}</section>`)
        .join('')}</div>`;
    }

    function watchFixtureRow(m, it) {
      const s = T.score(m);
      const w = T.winnerOf(m);
      const side = (k) => {
        const t = team(m[k]);
        const cls = !t ? ' is-tbd' : w ? (w === m[k] ? ' is-win' : ' is-lose') : '';
        return `<span class="iz-fx-team iz-fx-${k}${cls}">${t ? esc(t.name) : placeholder(m, k)}</span>`;
      };
      let time = it ? fmtTime(it.estStart) : '';
      let score = '–';
      if (m.status === 'live') {
        time = '<span class="iz-fx-dot" aria-hidden="true"></span><span class="sr">Canlı, kalan </span><span data-timer></span>';
        score = `${s.home}–${s.away}`;
      } else if (m.status === 'done') {
        time = fmtTime(m.startedAt);
        score = `${s.home}–${s.away}${m.pens ? `<small>pen. ${m.pens.home}–${m.pens.away}</small>` : ''}`;
      }
      return `<div class="iz-fx-row is-${m.status}">
        <span class="iz-fx-time">${time}</span>${side('home')}<span class="iz-fx-score">${score}</span>${side('away')}
      </div>`;
    }

    function tickClocks(now = Date.now()) {
      const state = getState();
      const m = state && liveMatch();
      if (m) {
        const rem = T.remainingMs(state, m, now);
        const total = T.matchMinutes(state, m) * MINUTE;
        const running = m.runningSince != null;
        const over = rem <= 0;
        const done = clamp(1 - rem / total, 0, 1);
        for (const clock of document.querySelectorAll('[data-clock]')) {
          clock.classList.toggle('is-over', over);
          clock.classList.toggle('is-last-minute', !over && rem <= MINUTE);
          clock.classList.toggle('is-paused', !running);
          const label = clock.querySelector('[data-timer-state]');
          if (label) label.textContent = over ? 'Süre doldu' : running ? label.dataset.running || '' : 'Duraklatıldı';
        }
        for (const el of document.querySelectorAll('[data-timer]')) el.textContent = fmtClock(rem);
        for (const el of document.querySelectorAll('[data-timer-bar]')) el.style.width = `${done * 100}%`;
        for (const el of document.querySelectorAll('[data-timer-ring]')) el.style.strokeDasharray = `${(done * RING_LENGTH).toFixed(1)} ${RING_LENGTH.toFixed(1)}`;
        for (const el of document.querySelectorAll('[data-timer-progress]')) el.setAttribute('aria-valuenow', String(Math.round(done * 100)));
        return { m, rem, running };
      }
      return null;
    }

    return {
      team,
      player,
      liveMatch,
      nextMatch,
      findStage,
      estimates,
      tournamentName,
      lastFinished,
      matchTitle,
      matchLabel,
      placeholder,
      teamName,
      lastResult,
      championData,
      renderStandings,
      fixtureGroups,
      renderScreen,
      renderWatch,
      renderSheet,
      tickClocks,
    };
  }

  return { COLORS, ICONS, esc, clamp, teamStyle, fmtClock, fmtTime, goalMinute, keepAwake, create };
});
