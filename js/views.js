(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tournament.js'));
  else root.Views = factory(root.Tournament);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  const MINUTE = T.MINUTE;
  const DEFAULT_NAME = 'Halı Saha Turnuvası';
  const RING_LENGTH = 2 * Math.PI * 88;
  const WIDE_QUERY = '(min-width: 761px) and (min-height: 500px) and (orientation: landscape)';

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
    brand:
      '<svg viewBox="0 0 512 512" aria-hidden="true"><circle cx="256" cy="256" r="150" fill="none" stroke="#2C664F" stroke-width="64"/><path d="M256 106A150 150 0 1 1 126.1 181" fill="none" stroke="#B7F34A" stroke-width="64" stroke-linecap="round"/><circle cx="256" cy="256" r="72" fill="#B7F34A"/></svg>',
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
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    forward: svg('<path d="m9 18 6-6-6-6"/>'),
    tabMac: svg('<path d="M12 2.5a9.5 9.5 0 1 1-8.23 4.75"/><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z"/>'),
    tabMacOn: svg('<path d="M12 2.5a9.5 9.5 0 1 1-8.23 4.75"/><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z" fill="currentColor"/>'),
    tabFikstur: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>'),
    tabFiksturOn: svg('<path d="M8 2.5v4M16 2.5v4"/><path d="M6 3.5h12a4 4 0 0 1 4 4V18a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7.5a4 4 0 0 1 4-4zM6.8 12.8v2.4h2.4v-2.4zm4 0v2.4h2.4v-2.4zm4 0v2.4h2.4v-2.4zm-8 3.5v2.4h2.4v-2.4zm4 0v2.4h2.4v-2.4z" fill="currentColor" stroke="none" fill-rule="evenodd"/>'),
    tabPuan: svg('<path d="M9 21V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v15"/><path d="M9 10H4a1 1 0 0 0-1 1v10M15 14h5a1 1 0 0 1 1 1v6M3 21h18"/>'),
    tabPuanOn: svg('<path d="M2 22V10.5A1.5 1.5 0 0 1 3.5 9H8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V13h4.5a1.5 1.5 0 0 1 1.5 1.5V22z" fill="currentColor" stroke="none"/>'),
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

  // Kapanırken pencere önce küçülerek kaybolur; dialog ancak animasyon bitince kapanır.
  function sheetView(dialog, { returnFocus = '', onDismiss = () => {} } = {}) {
    let shown = '';
    let opener = null;
    let closing = false;
    let ours = false;
    const finish = () => {
      if (!closing) return;
      closing = false;
      dialog.classList.remove('is-closing');
      ours = true;
      dialog.close();
      ours = false;
      dialog.innerHTML = shown = '';
      const back = opener?.isConnected && opener !== document.body ? opener : returnFocus && document.querySelector(returnFocus);
      back?.focus({ preventScroll: true });
      opener = null;
    };
    dialog.addEventListener('animationend', (e) => {
      if (e.target.classList?.contains('iz-sheet')) finish();
    });
    // Chrome, Esc'ye üst üste basılınca "cancel" olmadan doğrudan kapatabiliyor.
    dialog.addEventListener('close', () => {
      if (ours) return;
      closing = false;
      dialog.classList.remove('is-closing');
      dialog.innerHTML = shown = '';
      onDismiss();
    });
    return (html) => {
      if (!html) {
        if (dialog.open && !closing) {
          closing = true;
          dialog.classList.add('is-closing');
          setTimeout(finish, 400);
        } else if (!dialog.open) {
          dialog.innerHTML = shown = '';
        }
        return false;
      }
      if (closing) {
        closing = false;
        dialog.classList.remove('is-closing');
      }
      if (html !== shown) {
        const top = dialog.querySelector('.iz-sheet')?.scrollTop ?? 0;
        const focused = dialog.contains(document.activeElement) ? document.activeElement.dataset.action : null;
        dialog.innerHTML = shown = html;
        dialog.querySelector('.iz-sheet').scrollTop = top;
        if (focused) dialog.querySelector(`button[data-action="${focused}"]`)?.focus({ preventScroll: true });
      }
      if (!dialog.open) {
        opener = document.activeElement;
        dialog.showModal();
      }
      return true;
    };
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

    function renderScreen({ status = '', full = false } = {}) {
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
          <div class="tv-brand"><span class="tv-mark">${ICONS.brand}</span><span class="tv-brand-name">${esc(tournamentName())}</span></div>
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
        <header class="tv-head"><div class="tv-brand"><span class="tv-mark">${ICONS.brand}</span><span class="tv-brand-name">${DEFAULT_NAME}</span></div></header>
        <div class="tv-center">
          <span class="tv-kicker">${kicker}</span>
          <div class="tv-big">${title}</div>
          ${sub ? `<span class="tv-sub">${sub}</span>` : ''}
        </div>
      </div>
    </div>`;
    }

    const SYNC_PILL = '<span class="iz-pill is-sync" role="status">Güncelleniyor…</span>';
    const AWAY_TEXT = 'Organizatörün cihazı bağlı değil, skor gecikebilir';

    // İzleyici sayfası: geniş ekranda yayın ekranı, telefonda alt alta düzen.
    function renderWatch({ wide = false, notice = 'connecting', updating = false, organizerAway = false, full = false, flags = new Set() } = {}) {
      const state = getState();
      const away = !updating && organizerAway && !!state?.started && !T.champion(state);
      if (wide) {
        if (!state) return screenNotice(notice);
        const status = updating ? SYNC_PILL : away ? `<span class="iz-pill is-sync" role="status">${AWAY_TEXT}</span>` : '';
        return renderScreen({ status, full });
      }

      let pill = '';
      let body;
      let layout = ' is-center';
      if (!state) {
        body = watchHero(...(WATCH_NOTICES[notice] || WATCH_NOTICES.connecting));
      } else if (!state.started) {
        body = watchHero('Hoş geldiniz', esc(tournamentName()), 'Turnuva henüz başlamadı');
      } else if (liveMatch()) {
        pill = '<span class="tag-live">Canlı</span>';
        body = watchLive(liveMatch(), flags);
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
        <span class="iz-brand"><span class="iz-mark">${ICONS.brand}</span><span class="iz-brand-name">${esc(tournamentName())}</span></span>
        <span class="iz-pills">${state && updating ? SYNC_PILL : ''}${pill}</span>
      </header>
      <main class="iz-main${layout}">${away ? `<p class="iz-alert" role="status">${AWAY_TEXT}</p>` : ''}${body}</main>
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

    function watchTeam(m, side, flags) {
      const t = team(m[side]);
      const flag = m.goals.some((g) => g.team === t.id && flags.has(g.id)) ? `<span class="iz-goal-flag">${ICONS.ball}Gol</span>` : '';
      return `<button class="iz-team" style="${teamStyle(t)}" data-action="team" data-team="${t.id}">
        <span class="iz-team-l">
          <span class="iz-tname"><span class="sw"></span><span class="tn-name">${esc(t.name)}</span></span>
          <span class="iz-scorers">${goalList(m, t.id)}</span>
        </span>
        <span class="iz-score">${flag}<span class="iz-goals">${T.score(m)[side]}</span></span>
      </button>`;
    }

    function watchLive(m, flags) {
      const state = getState();
      const s = T.score(m);
      const next = nextMatch();
      return `<span class="iz-kicker">${watchKicker(m)}</span>
      <section class="iz-board" aria-label="Skor: ${esc(team(m.home).name)} ${s.home}, ${esc(team(m.away).name)} ${s.away}">
        ${watchTeam(m, 'home', flags)}${watchTeam(m, 'away', flags)}
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
      const lead =
        leaders
          .slice(0, 2)
          .map((s) => `<span class="iz-kings-name">${scorerSwatch(s)}<span class="tn-name">${esc(s.name)}</span></span>`)
          .join('<span class="iz-kings-sep" aria-hidden="true">·</span>') + (leaders.length > 2 ? `<span class="iz-kings-more">+${leaders.length - 2}</span>` : '');
      return `<section class="iz-kings" aria-label="Gol krallığı">
        <button class="iz-kings-btn" data-action="scorers-toggle" aria-expanded="${open}" aria-controls="iz-kings-list">
          ${label}<span class="iz-kings-lead">${lead}<strong>${top} gol</strong>${ICONS.chevron}</span>
        </button>
        <ol class="iz-kings-list" id="iz-kings-list"${open ? '' : ' hidden'}>${scorerRows(list)}</ol>
      </section>`;
    }

    function scorerSwatch(s) {
      const t = team(s.team);
      return t ? `<span class="sw" style="${teamStyle(t)}"></span>` : '<span class="is-tbd"><span class="sw"></span></span>';
    }

    function scorerRows(list, { withTeam = false } = {}) {
      return list
        .map((s, i) => {
          const rank = 1 + list.filter((x) => x.goals > s.goals).length;
          const first = i === 0 || list[i - 1].goals !== s.goals;
          const teamLabel = withTeam && team(s.team) ? `<small>${esc(team(s.team).name)}</small>` : '';
          return `<li${rank === 1 ? ' class="is-top"' : ''}><span class="iz-kings-rank">${first ? rank : ''}</span>${scorerSwatch(s)}<span class="tn-name">${esc(s.name)}${teamLabel}</span><strong>${s.goals}</strong></li>`;
        })
        .join('');
    }

    function watchFixtures({ links = false } = {}) {
      const state = getState();
      const est = estimates(state);
      const groups = fixtureGroups(state)
        .map((g) => ({ ...g, matches: g.matches.filter((m) => m.stage !== 'playoff' || state.settings.playoffEnabled) }))
        .filter((g) => g.matches.length);
      if (links) {
        return groups
          .map((g) => `<section class="iz-card iz-fx-card" aria-label="${g.title}"><h2 class="iz-card-h">${g.title}</h2>${g.matches.map((m) => watchFixtureRow(m, est[m.id], true)).join('')}</section>`)
          .join('');
      }
      return `<div class="iz-fx">${groups
        .map((g) => `<section class="iz-fx-group" aria-label="${g.title}"><h3 class="iz-fx-title">${g.title}</h3>${g.matches.map((m) => watchFixtureRow(m, est[m.id])).join('')}</section>`)
        .join('')}</div>`;
    }

    function watchFixtureRow(m, it, links = false) {
      const s = T.score(m);
      const w = T.winnerOf(m);
      const side = (k) => {
        const t = team(m[k]);
        const cls = !t ? ' is-tbd' : w ? (w === m[k] ? ' is-win' : ' is-lose') : '';
        if (t && links) return `<button class="iz-fx-team iz-fx-${k}${cls}" data-action="team" data-team="${t.id}">${esc(t.name)}</button>`;
        return `<span class="iz-fx-team iz-fx-${k}${cls}">${t ? esc(t.name) : placeholder(m, k)}</span>`;
      };
      let time = it ? fmtTime(it.estStart) : '';
      let score = '–';
      if (m.status === 'live') {
        time = '<span class="tag-live">Canlı</span>';
        score = `${s.home}–${s.away}`;
      } else if (m.status === 'done') {
        time = fmtTime(m.startedAt);
        score = `${s.home}–${s.away}${m.pens ? `<small>pen. ${m.pens.home}–${m.pens.away}</small>` : ''}`;
      }
      const scoreEl =
        links && m.status === 'live'
          ? `<button class="iz-fx-score" data-action="tab" data-tab="mac" aria-label="Canlı maça git">${score}</button>`
          : `<span class="iz-fx-score">${score}</span>`;
      return `<div class="iz-fx-row is-${m.status}">
        <span class="iz-fx-time">${time}</span>${side('home')}${scoreEl}${side('away')}
      </div>`;
    }

    const TABS = [
      ['mac', 'Maç', ICONS.tabMac, ICONS.tabMacOn],
      ['fikstur', 'Fikstür', ICONS.tabFikstur, ICONS.tabFiksturOn],
      ['puan', 'Puan', ICONS.tabPuan, ICONS.tabPuanOn],
    ];

    function renderTabBar(active) {
      return TABS.map(
        ([key, label, off, on]) => `<button class="iz-tab" role="tab" data-action="tab" data-tab="${key}" aria-selected="${key === active}">
          <span class="iz-tab-pill">${off}${on}${key === 'mac' ? '<span class="iz-tab-dot" aria-hidden="true"></span>' : ''}</span>
          <span class="iz-tab-label">${label}</span>${key === 'mac' ? '<span class="sr iz-tab-live">, canlı maç var</span>' : ''}
        </button>`,
      ).join('');
    }

    const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

    function pageHead(title, sub) {
      return `<h1 class="iz-large">${title}</h1><p class="iz-large-sub">${sub}</p>`;
    }

    function renderFixturePage() {
      const state = getState();
      const n = T.activeMatches(state).length;
      const sub = T.champion(state) ? `Turnuva bitti · ${n} maç` : `${n} maç · tahmini bitiş ${fmtTime(T.schedule(state).estEnd)}`;
      return `${pageHead('Fikstür', sub)}<div class="iz-stack">${watchFixtures({ links: true })}</div>`;
    }

    function renderStandingsPage() {
      const state = getState();
      const { rows, unresolved } = T.computeStandings(state);
      const zones = state.settings.playoffEnabled ? ['final', 'playoff', 'playoff'] : ['final', 'final', 'out'];
      const done = T.leagueDone(state);
      const tied = new Set(done ? unresolved.flat() : []);
      const current = state.matches.find((m) => m.stage === 'league' && m.status !== 'done');
      const sub = done ? 'Lig bitti' : state.settings.leagueRounds > 1 ? `Lig · ${current.round}. devre` : 'Lig sürüyor';
      const body = rows
        .map((r, i) => {
          const t = team(r.team);
          return `<button class="iz-st-row" data-action="team" data-team="${t.id}" aria-label="${esc(t.name)}, ${i + 1}. sıra, ${r.pts} puan">
            <span><span class="rank rank-${zones[i]}">${i + 1}</span>${tied.has(r.team) ? '<span class="tie" title="Eşitlik henüz çözülmedi">=</span>' : ''}</span>
            <span class="iz-st-tn" style="${teamStyle(t)}"><span class="sw"></span><span class="tn-name">${esc(t.name)}</span></span>
            <span>${r.played}</span><span>${signed(r.gd)}</span><b>${r.pts}</b>${ICONS.forward}
          </button>`;
        })
        .join('');
      const liveLeague = liveMatch()?.stage === 'league';
      const note = `${state.settings.playoffEnabled ? '1. finale direkt · 2. ve 3. playoff' : '1. ve 2. finalde'}${liveLeague ? ' · canlı maç anlık skorla dahil' : ''}`;
      const { list } = T.topScorers(state);
      const kings = list.length ? `<ol class="iz-kings-list">${scorerRows(list, { withTeam: true })}</ol>` : '<p class="iz-card-note">Henüz gol yok</p>';
      return `${pageHead('Puan', sub)}<div class="iz-stack">
        <section class="iz-card" aria-label="Puan durumu">
          <h2 class="iz-card-h">Puan durumu</h2>
          <div class="iz-st-head" aria-hidden="true"><span></span><span></span><span>O</span><span>Av</span><span>P</span><span></span></div>
          ${body}
          <p class="iz-card-note">${note}</p>
        </section>
        <section class="iz-card" aria-label="Gol krallığı"><h2 class="iz-card-h">Gol krallığı <small>gol</small></h2>${kings}</section>
      </div>`;
    }

    function teamOutcome(id) {
      const state = getState();
      const champ = T.champion(state);
      const fin = findStage('final');
      const po = state.settings.playoffEnabled ? findStage('playoff') : null;
      if (champ === id) return ['Şampiyon', `Final: ${lastResult(fin)}`];
      if (champ && (fin.home === id || fin.away === id)) return ['Finalist', `Final: ${lastResult(fin)}`];
      if (po?.status === 'done' && (po.home === id || po.away === id)) return ["Playoff'ta elendi", `Playoff: ${lastResult(po)}`];
      return [champ ? 'Turnuva bitti' : 'Maçları bitti', ''];
    }

    function renderTeamPage(id) {
      const state = getState();
      const t = team(id);
      if (!t) return '';
      const { rows } = T.computeStandings(state);
      const pos = rows.findIndex((r) => r.team === id);
      const r = rows[pos];
      const est = estimates(state);
      const { list } = T.topScorers(state);
      const top = list[0]?.goals;

      const players = t.playerIds
        .map(player)
        .filter(Boolean)
        .map((p, i) => ({ p, i, goals: list.find((s) => s.playerId === p.id)?.goals || 0 }))
        .sort((a, b) => b.goals - a.goals || a.i - b.i)
        .map(
          ({ p, goals }) =>
            `<li><span class="iz-pl-name">${esc(p.name)}</span>${goals && goals === top ? '<span class="iz-pl-tag">Gol kralı</span>' : '<span></span>'}<b${goals ? '' : ' class="is-zero"'}>${goals}</b></li>`,
        );
      const unnamed = state.matches
        .filter((m) => m.status !== 'pending')
        .reduce((n, m) => n + m.goals.filter((g) => g.team === id && !g.playerId).length, 0);
      if (unnamed) players.push(`<li class="is-unnamed"><span class="iz-pl-name">Golcüsü bilinmeyen</span><span></span><b>${unnamed}</b></li>`);

      const mine = T.activeMatches(state).filter((m) => m.home === id || m.away === id);
      const games = mine
        .map((m) => {
          const opp = team(m.home === id ? m.away : m.home);
          const s = T.score(m);
          const us = m.home === id ? s.home : s.away;
          const them = m.home === id ? s.away : s.home;
          const w = m.status === 'done' ? T.winnerOf(m) : undefined;
          let res = '<span></span>';
          if (m.status === 'done') {
            res =
              w === id
                ? '<span class="iz-res is-g" title="Galibiyet">G</span>'
                : w
                  ? '<span class="iz-res is-m" title="Mağlubiyet">M</span>'
                  : '<span class="iz-res is-b" title="Beraberlik">B</span>';
          }
          const time = m.status === 'live' ? '<span class="tag-live">Canlı</span>' : m.status === 'done' ? fmtTime(m.startedAt) : fmtTime(est[m.id]?.estStart);
          const score = m.status === 'pending' ? '–' : `${us}–${them}${m.pens ? '<small>pen.</small>' : ''}`;
          return `<li class="is-${m.status}"><span class="iz-tm-time">${time}<small>${matchTitle(m)}</small></span><span class="iz-tm-opp" style="${teamStyle(opp)}"><span class="sw"></span><span class="tn-name">${esc(opp.name)}</span></span><span class="iz-tm-score">${score}</span>${res}</li>`;
        })
        .join('');
      const elim = T.leagueDone(state)
        ? ''
        : `<li class="iz-tm-note">Eleme maçları lig bitince belli olur: ${state.settings.playoffEnabled ? "1. finale, 2. ve 3. playoff'a" : '1. ve 2. finale'}.</li>`;

      const live = liveMatch();
      const next = mine.find((m) => m.status === 'pending');
      let now;
      if (live && (live.home === id || live.away === id)) {
        const s = T.score(live);
        now = `<section class="iz-nx" aria-label="Şu an sahada">
          <span class="iz-nx-label"><span class="tag-live">Canlı</span>Şu an sahada · ${matchTitle(live)}</span>
          <span class="iz-nx-teams">${screenTeam(live, 'home')}<span>${s.home}–${s.away}</span>${screenTeam(live, 'away', true)}</span>
          <span class="iz-nx-sub"><span data-timer></span> kalan</span>
          <button class="iz-nx-go" data-action="tab" data-tab="mac">Maça git</button>
        </section>`;
      } else if (next) {
        const it = est[next.id];
        now = `<section class="iz-nx" aria-label="Sıradaki maç">
          <span class="iz-nx-label">Sıradaki maç · tahmini başlama</span>
          <strong class="iz-nx-big">${fmtTime(it?.estStart)}</strong>
          <span class="iz-nx-teams">${screenTeam(next, 'home')}<span class="tv-dash">–</span>${screenTeam(next, 'away', true)}</span>
          <span class="iz-nx-sub">${watchKicker(next)} · ${T.matchMinutes(state, next)} dk</span>
        </section>`;
      } else {
        const [title, sub] = teamOutcome(id);
        now = `<section class="iz-nx" aria-label="Turnuva"><span class="iz-nx-label">${T.champion(state) ? 'Turnuva bitti' : 'Bu takımın maçları'}</span><strong class="iz-nx-big">${title}</strong>${sub ? `<span class="iz-nx-sub">${sub}</span>` : ''}</section>`;
      }

      return `<div class="iz-th" style="${teamStyle(t)}"><span class="sw"></span><h1>${esc(t.name)}</h1></div>
        <div class="iz-th-stats">
          <div><b>${pos + 1}.</b><span>Lig sırası</span></div><div><b>${r.pts}</b><span>Puan</span></div>
          <div><b>${r.played}</b><span>Maç</span></div><div><b>${signed(r.gd)}</b><span>Averaj</span></div>
        </div>
        <div class="iz-stack">${now}
          <section class="iz-card" aria-label="Oyuncular"><h2 class="iz-card-h">Oyuncular <small>gol</small></h2><ol class="iz-pl">${players.join('')}</ol></section>
          <section class="iz-card" aria-label="Maçlar"><h2 class="iz-card-h">Maçlar</h2><ol class="iz-tm">${games}${elim}</ol>
            <p class="iz-card-note">G galibiyet · B beraberlik · M mağlubiyet · skor takımın gözünden</p></section>
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
      renderTabBar,
      renderFixturePage,
      renderStandingsPage,
      renderTeamPage,
      tickClocks,
    };
  }

  return { COLORS, ICONS, WIDE_QUERY, esc, clamp, teamStyle, fmtClock, fmtTime, goalMinute, keepAwake, sheetView, create };
});
