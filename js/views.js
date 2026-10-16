(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tournament.js'), require('./crests.js'), require('./i18n.js'));
  else root.Views = factory(root.Tournament, root.Crests, root.I18n);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, Crests, I18n) {
  'use strict';

  const MINUTE = T.MINUTE;
  const DEFAULT_NAME = 'Halı Saha Turnuvası';
  const RING_LENGTH = 2 * Math.PI * 88;
  const WIDE_QUERY = '(min-width: 761px) and (min-height: 500px) and (orientation: landscape)';

  // Varsayılan Türkçe adı taşıyan turnuvanın adı hiç değiştirilmemiştir; seçili dilde gösterilir.
  const displayName = (name) => (name === DEFAULT_NAME ? I18n.t('Halı Saha Turnuvası') : name);

  const COLORS = {
    red: { label: I18n.t('Kırmızı'), plural: I18n.t('Kırmızılar'), hex: '#e5484d' },
    blue: { label: I18n.t('Mavi'), plural: I18n.t('Maviler'), hex: '#3e63dd' },
    yellow: { label: I18n.t('Sarı'), plural: I18n.t('Sarılar'), hex: '#ffcf33' },
    green: { label: I18n.t('Yeşil'), plural: I18n.t('Yeşiller'), hex: '#2f9e5b' },
    orange: { label: I18n.t('Turuncu'), plural: I18n.t('Turuncular'), hex: '#f76b15' },
    purple: { label: I18n.t('Mor'), plural: I18n.t('Morlar'), hex: '#8e4ec6' },
    pink: { label: I18n.t('Pembe'), plural: I18n.t('Pembeler'), hex: '#e93d82' },
    teal: { label: I18n.t('Turkuaz'), plural: I18n.t('Turkuazlar'), hex: '#12a594' },
    white: { label: I18n.t('Beyaz'), plural: I18n.t('Beyazlar'), hex: '#f4f4f1' },
    black: { label: I18n.t('Siyah'), plural: I18n.t('Siyahlar'), hex: '#2a2c31' },
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
    bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    bellOff: svg('<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>'),
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
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    help: svg('<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.7-2.8 2.7"/><path d="M12 17h.01"/>'),
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

  // Arması olan takımda renk noktasının yerine arma; büyük hâl yalnız 40 px ve üstü için.
  function swatch(t, { big = false, own = false } = {}) {
    const style = own ? ` style="${teamStyle(t)}"` : '';
    const crest = t?.crest ? Crests.svg(t.crest, { small: !big }) : '';
    return crest ? `<span class="crest"${style}>${crest}</span>` : `<span class="sw"${style}></span>`;
  }

  function fmtClock(ms) {
    const over = ms < 0;
    const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
    return `${over ? '+' : ''}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function fmtTime(ts) {
    return ts == null ? '–' : new Date(ts).toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' });
  }

  const goalMinute = (g) => (g.ms == null ? '' : `${Math.floor(g.ms / MINUTE) + 1}'`);

  function dayName(ts, now = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / (24 * 60 * MINUTE));
    if (diff === 0) return I18n.t('bugün');
    if (diff === 1) return I18n.t('yarın');
    const year = d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {};
    return d.toLocaleDateString(I18n.locale(), { day: 'numeric', month: 'long', weekday: 'long', ...year });
  }

  const withTime = (day, time) => (time ? `${day}${day === I18n.t('bugün') || day === I18n.t('yarın') ? ' ' : ', '}${time}` : day);

  function startText(s, now = Date.now()) {
    const time = /^\d{1,2}:\d{2}$/.test(s.plannedStart || '') ? s.plannedStart : '';
    const day = T.plannedDay(s, now);
    if (day == null) return time ? I18n.t('Başlangıç: {when}', { when: time }) : '';
    return I18n.t('Başlangıç: {when}', { when: withTime(dayName(day, now), time) });
  }

  const TIMES = { 1: 'bir', 2: 'iki', 3: 'üç' };

  function rulesText(s) {
    const fin = T.hasFinal(s);
    const po = T.hasPlayoff(s);
    const r = s.leagueRounds;
    const who = I18n.t('Herkes herkesle {times} kez oynar', { times: TIMES[r] || r, n: r });
    const steps = [{ key: 'league', name: I18n.t('Lig'), min: s.leagueMin, who: fin ? who : I18n.t('{who}, 1.si şampiyon', { who }) }];
    if (po) steps.push({ key: 'playoff', name: I18n.t('Playoff'), min: s.playoffMin, who: I18n.t('Lig 2.si – 3.sü') });
    if (fin) steps.push({ key: 'final', name: I18n.t('Final'), min: s.finalMin, who: po ? I18n.t('Lig 1.si – playoff galibi') : I18n.t('Lig 1.si – 2.si') });
    const points = I18n.t('Galibiyet 3, beraberlik 1, mağlubiyet 0 puan');
    let draw = I18n.t('Öyle kalır, iki takım da 1 puan alır.');
    let rule = I18n.t('Final yok, lig 1.si şampiyon');
    if (fin) {
      draw = po ? I18n.t('Ligde öyle kalır; playoff ve finalde penaltı.') : I18n.t('Ligde öyle kalır; finalde penaltı.');
      rule = po ? I18n.t('Playoff ve finalde beraberlikte penaltı') : I18n.t('Finalde beraberlikte penaltı');
    }
    return {
      steps,
      summary: steps.map((x) => x.name).join(' › '),
      meta: `${r > 1 ? `${I18n.t('{n} devre', { n: r })}, ` : ''}${I18n.t('{n} maç', { n: r * 3 })} · ${I18n.t('her maçta bir takım dinlenir')}`,
      draw,
      tvLine: `${points} · ${rule}`,
    };
  }

  function standingZones(s) {
    if (!T.hasFinal(s)) return { zones: ['final', 'out', 'out'], note: I18n.t('1. şampiyon olur') };
    if (T.hasPlayoff(s)) return { zones: ['final', 'playoff', 'playoff'], note: I18n.t('1. finale direkt · 2. ve 3. playoff') };
    return { zones: ['final', 'final', 'out'], note: I18n.t('1. ve 2. finalde') };
  }

  const RANKS = [I18n.t('Lig 1.si'), I18n.t('Lig 2.si'), I18n.t('Lig 3.sü')];

  // Kutu yerinde açılıp kapanır: yeniden çizim geçişi yarıda keserdi. Sonraki çizim aynı hâli zaten üretir.
  function toggleRules(btn) {
    const box = btn.closest('.iz-rules');
    const open = !box.classList.contains('is-open');
    box.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    box.querySelector('.iz-rules-body').inert = !open;
    return open;
  }

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
    connecting: [I18n.t('Canlı yayın'), I18n.t('Bağlanıyor…'), ''],
    notfound: [I18n.t('Canlı yayın'), I18n.t('Yayın bulunamadı'), I18n.t('Link eksik ya da hatalı. Organizatörden linki yeniden iste.')],
    empty: [I18n.t('Hoş geldiniz'), I18n.t('Halı Saha Turnuvası'), I18n.t('Turnuva henüz başlamadı')],
  };

  function create(getState) {
    const team = (id) => getState().teams.find((t) => t.id === id) || null;
    const player = (id) => getState().players.find((p) => p.id === id) || null;
    const liveMatch = () => getState().matches.find((m) => m.status === 'live') || null;
    const nextMatch = () => T.activeMatches(getState()).find((m) => m.status === 'pending') || null;
    const findStage = (stage, list = getState().matches) => list.find((m) => m.stage === stage) || null;
    const match = (id) => getState().matches.find((m) => m.id === id) || null;
    const estimates = (st) => Object.fromEntries(T.schedule(st).items.map((i) => [i.id, i]));
    const tournamentName = () => displayName(getState()?.name.trim() || DEFAULT_NAME);

    // Yalnız ilk maç için: turnuva başka bir gün başlıyorsa saat tek başına yanıltır.
    function firstMatchDay(it) {
      if (!it || getState().matches.some((m) => m.startedAt)) return '';
      const day = dayName(it.estStart);
      return day === I18n.t('bugün') ? '' : day;
    }

    const rosterTeams = () => getState().teams.filter((t) => t.playerIds.length);
    const playerNames = (t) =>
      t.playerIds
        .map(player)
        .filter(Boolean)
        .map((p) => esc(p.name))
        .join(', ');

    function lastFinished() {
      return getState().matches.filter((m) => m.status === 'done').sort((a, b) => b.endedAt - a.endedAt)[0] || null;
    }

    function matchTitle(m, list = getState().matches) {
      if (m.stage === 'league') return I18n.t('{n}. maç', { n: list.filter((x) => x.stage === 'league').indexOf(m) + 1 });
      return m.stage === 'playoff' ? I18n.t('Playoff') : I18n.t('Final');
    }

    function matchLabel(m) {
      if (m.stage !== 'league') return matchTitle(m);
      return `${matchTitle(m)} <span class="of">/ ${T.activeMatches(getState()).length}</span>`;
    }

    function placeholder(m, side) {
      if (m.stage === 'playoff') return side === 'home' ? I18n.t('Lig 2.si') : I18n.t('Lig 3.sü');
      if (side === 'home') return I18n.t('Lig 1.si');
      return T.hasPlayoff(getState().settings) ? I18n.t('Playoff galibi') : I18n.t('Lig 2.si');
    }

    function teamName(id, m, side, { cls = '', end = false } = {}) {
      const t = team(id);
      const order = end ? ' is-end' : '';
      if (!t) return `<span class="tn is-tbd${order}"><span class="sw"></span><span class="tn-name">${m ? placeholder(m, side) : '?'}</span></span>`;
      return `<span class="tn${order}${cls}" style="${teamStyle(t)}">${swatch(t)}<span class="tn-name">${esc(t.name)}</span></span>`;
    }

    function lastResult(m) {
      const s = T.score(m);
      return `${esc(team(m.home)?.name)} ${s.home}–${s.away} ${esc(team(m.away)?.name)}${m.pens ? ` (${I18n.t('pen.')} ${m.pens.home}–${m.pens.away})` : ''}`;
    }

    const scoreLabel = (m, s) =>
      I18n.t('Skor: {home} {homeGoals}, {away} {awayGoals}', { home: esc(team(m.home)?.name), homeGoals: s.home, away: esc(team(m.away)?.name), awayGoals: s.away });

    function goalList(m, teamId) {
      return m.goals
        .filter((g) => !teamId || g.team === teamId)
        .map((g) => {
          const p = player(g.playerId);
          return p ? `${esc(p.name)}${g.ownGoal ? ` (${I18n.t('k.k.')})` : ''} ${goalMinute(g)}` : goalMinute(g);
        })
        .filter(Boolean)
        .join(' · ');
    }

    // Golcüsü sonradan girilen golün dakikası yoktur; o goller sona dizilir.
    function matchEvents(m) {
      let home = 0;
      let away = 0;
      return m.goals
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => g.team === m.home || g.team === m.away)
        .sort((a, b) => (a.g.ms ?? Infinity) - (b.g.ms ?? Infinity) || a.i - b.i)
        .map(({ g }) => {
          const side = g.team === m.home ? 'home' : 'away';
          if (side === 'home') home++;
          else away++;
          return { g, side, home, away };
        });
    }

    function scorerName(g) {
      const p = player(g.playerId);
      return p ? `${esc(p.name)}${g.ownGoal ? ` (${I18n.t('k.k.')})` : ''}` : I18n.t('Bilinmiyor');
    }

    function sideScorers(events, side) {
      const rows = new Map();
      for (const e of events.filter((x) => x.side === side)) {
        const key = player(e.g.playerId) ? `${e.g.playerId}${e.g.ownGoal ? ':kk' : ''}` : '';
        if (!rows.has(key)) rows.set(key, { g: e.g, count: 0, minutes: [] });
        const row = rows.get(key);
        row.count++;
        if (e.g.ms != null) row.minutes.push(goalMinute(e.g));
      }
      return [...rows.values()]
        .map(({ g, count, minutes }) => {
          const extra = minutes.length < count ? ` ×${count}` : '';
          return `<li${player(g.playerId) ? '' : ' class="is-unknown"'}>${scorerName(g)}${extra}${minutes.length ? ` <span class="ms-min">${minutes.join(', ')}</span>` : ''}</li>`;
        })
        .join('');
    }

    function outcomeText(m) {
      if (m.status !== 'done') return '';
      const w = T.winnerOf(m);
      if (!w) return I18n.t('Berabere');
      const name = esc(team(w)?.name);
      if (m.stage === 'final') return m.pens ? I18n.t('{name} penaltılarla şampiyon oldu', { name }) : I18n.t('{name} şampiyon oldu', { name });
      if (m.stage === 'playoff') return m.pens ? I18n.t('{name} penaltılarla finale çıktı', { name }) : I18n.t('{name} finale çıktı', { name });
      return I18n.t('{name} kazandı', { name });
    }

    function renderMatchSummary(id, { links = false, titleId = '' } = {}) {
      const m = match(id);
      if (!m) return '';
      const state = getState();
      const s = T.score(m);
      const w = T.winnerOf(m);
      const events = matchEvents(m);
      const played = m.status !== 'pending';
      const side = (k) => {
        const t = team(m[k]);
        const cls = w ? (w === m[k] ? ' is-win' : ' is-lose') : '';
        const name = t ? `${swatch(t, { big: true })}<span class="tn-name">${esc(t.name)}</span>` : `<span class="tn-name">${placeholder(m, k)}</span>`;
        const head = t && links ? `<button class="ms-tn" data-action="team" data-team="${t.id}">${name}</button>` : `<span class="ms-tn">${name}</span>`;
        const scorers = sideScorers(events, k);
        return `<div class="ms-team ms-${k}${cls}${t ? '' : ' is-tbd'}"${t ? ` style="${teamStyle(t)}"` : ''}>${head}${scorers ? `<ol class="ms-scorers">${scorers}</ol>` : ''}</div>`;
      };
      let when = '';
      if (m.status === 'done') when = `${fmtTime(m.startedAt)} – ${fmtTime(m.endedAt)} · ${I18n.t('{n} dk', { n: T.matchMinutes(state, m) })}`;
      else if (m.status === 'live') when = `<span class="tag-live">${I18n.t('Canlı')}</span>`;
      else when = I18n.t('Henüz oynanmadı');
      const label = played ? scoreLabel(m, s) : I18n.t('Henüz oynanmadı');
      const score = played ? `<span>${s.home}</span><span class="ms-dash">–</span><span>${s.away}</span>` : '<span class="ms-dash">–</span>';
      const outcome = outcomeText(m);
      const timeline = events
        .map((e) => {
          const cell = `<span class="ms-who">${scorerName(e.g)}</span><span class="ms-min">${goalMinute(e.g) || '–'}</span>`;
          const run = e.side === 'home' ? `<b>${e.home}</b>–${e.away}` : `${e.home}–<b>${e.away}</b>`;
          return `<li class="ms-ev is-${e.side}${player(e.g.playerId) ? '' : ' is-unknown'}" style="${teamStyle(team(e.g.team))}">
            <span class="ms-ev-home">${e.side === 'home' ? cell : ''}</span><span class="ms-ev-score">${run}</span><span class="ms-ev-away">${e.side === 'away' ? cell : ''}</span>
          </li>`;
        })
        .join('');
      let goals = '';
      if (played) {
        goals = `<section class="ms-card" aria-label="${I18n.t('Goller')}"><h3 class="ms-h">${I18n.t('Goller')}</h3>${timeline ? `<ol class="ms-tl">${timeline}</ol>` : `<p class="ms-none">${I18n.t('Gol yok')}</p>`}</section>`;
      }
      return `<div class="ms">
        <div class="ms-top"><h2 class="ms-kicker"${titleId ? ` id="${titleId}"` : ''}>${watchKicker(m)}</h2><span class="ms-when">${when}</span></div>
        <div class="ms-board">${side('home')}<div class="ms-score" role="img" aria-label="${label}">${score}</div>${side('away')}</div>
        ${m.pens ? `<p class="ms-pens">${I18n.t('Penaltılar {home}–{away}', m.pens)}</p>` : ''}
        ${outcome ? `<p class="ms-outcome">${outcome}</p>` : ''}
        ${goals}
      </div>`;
    }

    function championData(id) {
      const state = getState();
      const t = team(id);
      const fin = findStage('final');
      const players = t.playerIds.map(player).filter(Boolean).map((p) => `<span>${esc(p.name)}</span>`).join('');
      const { list } = T.topScorers(state);
      const best = list.filter((x) => x.goals === list[0]?.goals);
      const line = T.hasFinal(state.settings)
        ? I18n.t('Final: {result}', { result: lastResult(fin) })
        : I18n.t('Ligi {pts} puanla birinci bitirdi', { pts: T.computeStandings(state, { includeLive: false }).rows[0].pts });
      return { t, players, best, line };
    }

    // Final yoksa lig bitince şampiyon belli olur; puanlar her şeyiyle eşitse önce kura gerekir.
    function awaitingChampion() {
      const state = getState();
      return !T.hasFinal(state.settings) && T.blockingTies(state).length > 0;
    }

    function renderStandings() {
      const state = getState();
      const { rows, unresolved } = T.computeStandings(state);
      const { zones, note } = standingZones(state.settings);
      const tied = new Set(T.leagueDone(state) ? unresolved.flat() : []);
      const gd = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
      return `<section class="card side-card" aria-labelledby="h-table">
      <h2 class="card-title" id="h-table">${I18n.t('Puan durumu')}</h2>
      <table class="standings">
        <thead><tr><th><span class="sr">${I18n.t('Sıra')}</span></th><th><span class="sr">${I18n.t('Takım')}</span></th><th title="${I18n.t('Oynanan')}" abbr="${I18n.t('Oynanan')}">${I18n.t('O')}</th><th title="${I18n.t('Averaj')}" abbr="${I18n.t('Averaj')}">${I18n.t('Av')}</th><th title="${I18n.t('Puan')}" abbr="${I18n.t('Puan')}">${I18n.t('P')}</th></tr></thead>
        <tbody>${rows
          .map((r, i) => {
            const t = team(r.team);
            return `<tr>
              <td><span class="rank rank-${zones[i]}">${i + 1}</span>${tied.has(r.team) ? TIE_MARK : ''}</td>
              <td>${teamName(t.id)}</td>
              <td>${r.played}</td><td>${gd(r.gd)}</td><td class="pts">${r.pts}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table>
      <p class="card-note">${note}</p>
    </section>`;
    }

    function fixtureGroups(st) {
      const groups = [];
      const rounds = Math.max(0, ...st.matches.map((m) => m.round || 0));
      for (let r = 1; r <= rounds; r++) {
        groups.push({ title: rounds > 1 ? I18n.t('Lig · {n}. devre', { n: r }) : I18n.t('Lig'), matches: st.matches.filter((m) => m.stage === 'league' && m.round === r) });
      }
      for (const [stage, title] of [
        ['playoff', I18n.t('Playoff')],
        ['final', I18n.t('Final')],
      ]) {
        groups.push({ title, matches: st.matches.filter((m) => m.stage === stage) });
      }
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
      const fullLabel = full ? I18n.t('Tam ekrandan çık') : I18n.t('Tam ekran');
      return `<div class="tv">
      ${TV_LINES}
      <div class="tv-body">
        <header class="tv-head">
          <div class="tv-brand"><span class="tv-mark">${ICONS.brand}</span><span class="tv-brand-name">${esc(tournamentName())}</span></div>
          <div class="tv-status">${live ? `<span class="tag-live">${I18n.t('Canlı')}</span><span class="tv-no">${matchLabel(live)}</span>` : ''}</div>
          <div class="tv-tools">
            ${sc && !champ ? `<span class="tv-end">${I18n.t('Bitiş')} <strong>${fmtTime(sc.estEnd)}</strong></span>` : ''}
            ${state.started ? `<button class="tv-btn" data-action="screen-fixtures" aria-haspopup="dialog">${ICONS.list}${I18n.t('Fikstür')}</button>` : ''}
            <button class="tv-btn tv-icon" data-action="toggle-fullscreen" aria-label="${fullLabel}" title="${fullLabel}">${full ? ICONS.compress : ICONS.expand}</button>
          </div>
          ${status ? `<div class="tv-alert">${status}</div>` : ''}
        </header>
        ${body}
        ${next ? screenNext(next, est) : ''}
      </div>
    </div>`;
    }

    function screenTeam(m, side, end = false) {
      const t = team(m[side]);
      if (!t) return `<span class="tv-tn is-tbd${end ? ' is-end' : ''}"><span class="sw"></span>${placeholder(m, side)}</span>`;
      return `<span class="tv-tn${end ? ' is-end' : ''}" style="${teamStyle(t)}">${swatch(t)}${esc(t.name)}</span>`;
    }

    function screenLive(m) {
      const s = T.score(m);
      const home = team(m.home);
      const away = team(m.away);
      const side = (t, cls) => `<div class="tv-team ${cls}" style="${teamStyle(t)}">
        <span class="tv-name">${swatch(t, { big: true })}<span>${esc(t.name)}</span></span>
        <span class="tv-scorers">${goalList(m, t.id)}</span>
      </div>`;
      return `<div class="tv-board">
        ${side(home, 'tv-home')}
        <div class="tv-score" role="img" aria-label="${scoreLabel(m, s)}"><span>${s.home}</span><span class="tv-dash">–</span><span>${s.away}</span></div>
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
      if (!m && awaitingChampion()) {
        return `<div class="tv-center"><span class="tv-kicker">${I18n.t('Lig bitti')}</span><div class="tv-big">${I18n.t('Şampiyon belirleniyor')}</div><span class="tv-sub">${TIE_TEXT}</span></div>`;
      }
      if (!m) return `<div class="tv-center"><span class="tv-sub">${I18n.t('Sıradaki maç bekleniyor')}</span></div>`;
      const last = lastFinished();
      const it = est[m.id];
      const day = firstMatchDay(it);
      return `<div class="tv-center">
      <span class="tv-kicker">${I18n.t('Sıradaki')} · ${matchLabel(m)}</span>
      <div class="tv-big">${screenTeam(m, 'home')}<span class="tv-dash">–</span>${screenTeam(m, 'away', true)}</div>
      ${it && m.home && m.away ? `<span class="tv-sub">${I18n.t('Tahmini başlama {time}', { time: day ? withTime(day, fmtTime(it.estStart)) : fmtTime(it.estStart) })}</span>` : ''}
      ${last ? `<span class="tv-last">${I18n.t('Son maç: {result}', { result: lastResult(last) })}</span>` : ''}
    </div>`;
    }

    const topScorerLine = (best) =>
      `${I18n.t('Gol kralı: {names}', { names: best.map((b) => esc(b.name)).join(', ') })} · ${I18n.t('{n} gol', { n: best[0].goals })}`;

    function screenChampion(id) {
      const { t, players, best, line } = championData(id);
      return `<div class="tv-center" style="${teamStyle(t)}">
      <span class="champ-icon tv-trophy">${ICONS.trophy}</span>
      <span class="tv-kicker">${I18n.t('Şampiyon')}</span>
      <div class="tv-big"><span class="tv-tn">${swatch(t, { big: true })}${esc(t.name)}</span></div>
      <span class="tv-sub">${line}</span>
      <div class="champ-players tv-players">${players}</div>
      ${best.length ? `<span class="tv-last">${topScorerLine(best)}</span>` : ''}
    </div>`;
    }

    function screenIdle() {
      const r = rulesText(getState().settings);
      return `<div class="tv-center">
      <span class="tv-kicker">${I18n.t('Hoş geldiniz')}</span>
      <div class="tv-big">${esc(tournamentName())}</div>
      <span class="tv-sub">${startText(getState().settings) || I18n.t('Turnuva henüz başlamadı')}</span>
    </div>
    ${screenTeams()}
    <section class="tv-rules" aria-labelledby="tv-rules-h">
      <h2 class="tv-rules-h" id="tv-rules-h">${I18n.t('Nasıl oynanıyor?')}</h2>
      ${rulesFlow(r)}
      <p class="tv-rules-line">${r.tvLine}</p>
    </section>`;
    }

    function screenTeams() {
      const list = rosterTeams();
      if (!list.length) return '';
      const tiles = list.map(
        (t) => `<li class="tv-team-card" style="${teamStyle(t)}"><span class="tv-team-name">${swatch(t)}${esc(t.name)}</span><span class="tv-team-players">${playerNames(t)}</span></li>`,
      );
      return `<section class="tv-teams" aria-labelledby="tv-teams-h"><h2 class="tv-rules-h" id="tv-teams-h">${I18n.t('Takımlar')}</h2><ul class="tv-team-list">${tiles.join('')}</ul></section>`;
    }

    function screenNext(m, est) {
      const it = est[m.id];
      return `<section class="tv-next" aria-label="${I18n.t('Sıradaki maç')}">
      <span class="tv-next-label">${I18n.t('Sıradaki')}${it && m.home && m.away ? ` · ${fmtTime(it.estStart)}` : ''}</span>
      <span class="tv-next-teams">${screenTeam(m, 'home')}<span class="tv-dash">–</span>${screenTeam(m, 'away', true)}</span>
    </section>`;
    }

    function screenNotice(kind) {
      const [kicker, title, sub] = WATCH_NOTICES[kind] || WATCH_NOTICES.connecting;
      return `<div class="tv">
      ${TV_LINES}
      <div class="tv-body">
        <header class="tv-head"><div class="tv-brand"><span class="tv-mark">${ICONS.brand}</span><span class="tv-brand-name">${I18n.t('Halı Saha Turnuvası')}</span></div></header>
        <div class="tv-center">
          <span class="tv-kicker">${kicker}</span>
          <div class="tv-big">${title}</div>
          ${sub ? `<span class="tv-sub">${sub}</span>` : ''}
        </div>
      </div>
    </div>`;
    }

    const TIE_TEXT = I18n.t('Puanlar her şeyiyle eşit: penaltı ya da yazı-tura');
    const TIE_MARK = `<span class="tie" title="${I18n.t('Eşitlik henüz çözülmedi')}">=</span>`;
    const SYNC_PILL = `<span class="iz-pill is-sync" role="status">${I18n.t('Güncelleniyor…')}</span>`;
    const AWAY_TEXT = I18n.t('Organizatörün cihazı bağlı değil, skor gecikebilir');

    // İzleyici sayfası: geniş ekranda yayın ekranı, telefonda alt alta düzen.
    function renderWatch({ wide = false, notice = 'connecting', updating = false, organizerAway = false, full = false, flags = new Set(), links = false, bell = null } = {}) {
      const state = getState();
      // Turnuva günler önce başlatılmış olabilir; ilk maç başlamadan gecikecek bir skor yok.
      const away = !updating && organizerAway && !!state?.matches.some((m) => m.startedAt) && !T.champion(state);
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
        body = watchHero(I18n.t('Hoş geldiniz'), esc(tournamentName()), startText(state.settings) || I18n.t('Turnuva henüz başlamadı')) + watchTeams(links) + watchRules({ fixed: true });
        layout = ' is-center is-pre';
      } else if (liveMatch()) {
        pill = `<span class="tag-live">${I18n.t('Canlı')}</span>`;
        body = watchLive(liveMatch(), flags) + watchTeams(links);
        layout = '';
      } else if (T.champion(state)) {
        pill = `<span class="iz-pill">${I18n.t('Turnuva bitti')}</span>`;
        body = watchChampion(T.champion(state)) + watchTeams(links);
      } else {
        if (lastFinished()) pill = `<span class="iz-pill">${I18n.t('Maç arası')}</span>`;
        body = watchBreak(estimates(state), links) + watchTeams(links);
        layout = ' is-break';
      }
      return `<div class="iz">
      <div class="iz-field" aria-hidden="true"><span class="iz-field-mid"></span><span class="iz-field-circle"></span><span class="iz-field-box"></span><span class="iz-field-box is-bottom"></span></div>
      <header class="iz-head">
        <span class="iz-brand"><span class="iz-mark">${ICONS.brand}</span><span class="iz-brand-name">${esc(tournamentName())}</span></span>
        <span class="iz-pills">${state && updating ? SYNC_PILL : ''}${pill}${state && bell ? bellButton(bell === 'on') : ''}</span>
      </header>
      <main class="iz-main${layout}">${away ? `<p class="iz-alert" role="status">${AWAY_TEXT}</p>` : ''}${body}</main>
    </div>`;
    }

    function bellButton(on) {
      const label = on ? I18n.t('Gol ve sonuç bildirimleri açık') : I18n.t('Gol ve sonuç bildirimleri kapalı');
      return `<button class="iz-bell${on ? ' is-on' : ''}" data-action="push-toggle" aria-pressed="${on}" aria-label="${I18n.t('Gol ve sonuç bildirimleri')}" title="${label}">${on ? ICONS.bell : ICONS.bellOff}</button>`;
    }

    function watchTeams(links) {
      const list = rosterTeams();
      if (!list.length) return '';
      const rows = list.map((t) => {
        const inner = `<span class="iz-tl-name">${swatch(t)}${esc(t.name)}</span><span class="iz-tl-players">${playerNames(t)}</span>`;
        return links
          ? `<button class="iz-tl-row" data-action="team" data-team="${t.id}" style="${teamStyle(t)}">${inner}${ICONS.forward}</button>`
          : `<div class="iz-tl-row" style="${teamStyle(t)}">${inner}</div>`;
      });
      return `<section class="iz-teams" aria-labelledby="iz-teams-h"><h2 class="iz-teams-h" id="iz-teams-h">${ICONS.users}${I18n.t('Takımlar')}</h2>${rows.join('')}</section>`;
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
      return `${matchTitle(m)} · ${getState().settings.leagueRounds > 1 ? I18n.t('Lig {n}. devre', { n: m.round }) : I18n.t('Lig')}`;
    }

    function watchTeam(m, side, flags) {
      const t = team(m[side]);
      const flag = m.goals.some((g) => g.team === t.id && flags.has(g.id)) ? `<span class="iz-goal-flag">${ICONS.ball}${I18n.t('Gol')}</span>` : '';
      return `<button class="iz-team" style="${teamStyle(t)}" data-action="team" data-team="${t.id}">
        <span class="iz-team-l">
          <span class="iz-tname">${swatch(t)}<span class="tn-name">${esc(t.name)}</span></span>
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
      <section class="iz-board" aria-label="${scoreLabel(m, s)}">
        ${watchTeam(m, 'home', flags)}${watchTeam(m, 'away', flags)}
      </section>
      <section class="iz-clock" aria-label="${I18n.t('Kalan süre')}">
        <div class="iz-ring" data-clock data-timer-progress role="progressbar" aria-label="${I18n.t('Geçen süre')}" aria-valuemin="0" aria-valuemax="100">
          <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="iz-ring-track" cx="100" cy="100" r="88"/><circle class="iz-ring-fill" data-timer-ring cx="100" cy="100" r="88" transform="rotate(-90 100 100)"/></svg>
          <span class="iz-ring-c"><span class="iz-time" data-timer></span><span class="iz-ring-cap" data-timer-state data-running="${I18n.t('kalan · {n} dk', { n: T.matchMinutes(state, m) })}"></span></span>
        </div>
      </section>
      ${next ? watchNext(next, estimates(state)) : ''}`;
    }

    function watchNext(m, est) {
      const it = est[m.id];
      return `<section class="iz-next" aria-label="${I18n.t('Sıradaki maç')}">
        <span class="iz-next-label">${I18n.t('Sıradaki')}${it ? `<br>${fmtTime(it.estStart)}` : ''}</span>
        <span class="iz-next-teams">${screenTeam(m, 'home')}<span class="tv-dash" aria-hidden="true">–</span>${screenTeam(m, 'away', true)}</span>
      </section>`;
    }

    function watchBreak(est, links = false) {
      const m = nextMatch();
      if (!m && awaitingChampion()) return watchHero(I18n.t('Lig bitti'), I18n.t('Şampiyon belirleniyor'), TIE_TEXT);
      if (!m) return watchHero('', I18n.t('Sıradaki maç bekleniyor'), '');
      const last = lastFinished();
      const it = est[m.id];
      const day = firstMatchDay(it);
      return `<span class="iz-kicker">${I18n.t('Sıradaki')} · ${matchTitle(m)}</span>
      <div class="iz-vs">${screenTeam(m, 'home')}<span class="iz-vs-dash" aria-hidden="true">–</span>${screenTeam(m, 'away')}</div>
      ${it ? `<div class="iz-eta"><span>${I18n.t('Tahmini başlama')}</span>${day ? `<span class="iz-eta-day">${day}</span>` : ''}<strong>${fmtTime(it.estStart)}</strong><span>${I18n.t('{n} dakikalık maç', { n: T.matchMinutes(getState(), m) })}</span></div>` : ''}
      ${last ? watchLast(last, links) : ''}`;
    }

    function watchLast(m, links = false) {
      const s = T.score(m);
      const w = T.winnerOf(m);
      const side = (k) => {
        const t = team(m[k]);
        const cls = `${k === 'home' ? ' is-end' : ''}${w && w !== m[k] ? ' is-lose' : ''}`;
        return `<span class="tv-tn${cls}" style="${teamStyle(t)}">${swatch(t)}${esc(t?.name)}</span>`;
      };
      const goals = goalList(m);
      const inner = `<span class="iz-last-head"><span>${I18n.t('Son maç')} · ${matchTitle(m)}</span>${links ? `<span class="iz-last-go">${I18n.t('Maç özeti')}${ICONS.forward}</span>` : ''}</span>
        <span class="iz-last-row">${side('home')}<span class="iz-last-score">${s.home} – ${s.away}</span>${side('away')}</span>
        ${m.pens ? `<span class="iz-last-note">${I18n.t('Penaltılar {home}–{away}', m.pens)}</span>` : ''}
        ${goals ? `<span class="iz-last-note">${goals}</span>` : ''}`;
      if (links) return `<button class="iz-last" data-action="match" data-match="${m.id}" aria-label="${I18n.t('Son maç özeti: {result}', { result: lastResult(m) })}">${inner}</button>`;
      return `<section class="iz-last" aria-label="${I18n.t('Son maç')}">${inner}</section>`;
    }

    function watchChampion(id) {
      const { t, players, best, line } = championData(id);
      return `<div class="iz-hero" style="${teamStyle(t)}">
        <span class="champ-icon">${ICONS.trophy}</span>
        <span class="iz-hero-kicker">${I18n.t('Şampiyon')}</span>
        <h1 class="iz-hero-title iz-champ">${swatch(t, { big: true })}${esc(t.name)}</h1>
        <p class="iz-hero-sub">${line}</p>
        <div class="champ-players">${players}</div>
        ${best.length ? `<p class="iz-hero-note">${topScorerLine(best)}</p>` : ''}
      </div>`;
    }

    function renderSheet({ scorersOpen = false, rulesOpen = false, matchId = null } = {}) {
      const state = getState();
      if (!state?.started) return '';
      const summary = matchId && match(matchId)?.status === 'done' ? renderMatchSummary(matchId, { titleId: 'iz-sheet-title' }) : '';
      const live = liveMatch();
      let peek = esc(tournamentName());
      if (live) {
        const s = T.score(live);
        peek = `${esc(team(live.home).name)} <strong>${s.home} – ${s.away}</strong> ${esc(team(live.away).name)} · <span data-timer></span>`;
      }
      if (summary) {
        return `<div class="iz-peek" data-action="sheet-close" aria-hidden="true"><span>${peek}</span></div>
        <section class="iz-sheet is-match">
          <span class="iz-grip" aria-hidden="true"></span>
          <div class="iz-sheet-head">
            <button class="iz-sheet-back" data-action="sheet-back">${ICONS.back}${I18n.t('Fikstür')}</button>
            <button class="iz-close" data-action="sheet-close" aria-label="${I18n.t('Kapat')}">${ICONS.x}</button>
          </div>
          ${summary}
        </section>`;
      }
      return `<div class="iz-peek" data-action="sheet-close" aria-hidden="true"><span>${peek}</span></div>
      <section class="iz-sheet">
        <span class="iz-grip" aria-hidden="true"></span>
        <div class="iz-sheet-head">
          <h2 id="iz-sheet-title">${I18n.t('Fikstür ve puan')}</h2>
          <button class="iz-close" data-action="sheet-close" aria-label="${I18n.t('Kapat')}" autofocus>${ICONS.x}</button>
        </div>
        <div class="iz-sheet-top"><div class="iz-sheet-side">${renderStandings()}${sheetTeams()}</div><div class="iz-sheet-side">${watchScorers(scorersOpen)}${watchRules({ open: rulesOpen, light: true })}</div></div>
        ${watchFixtures()}
      </section>`;
    }

    function sheetTeams() {
      const list = rosterTeams();
      if (!list.length) return '';
      const rows = list.map((t) => `<div class="iz-roster-name">${teamName(t.id)}</div><span class="iz-roster-players">${playerNames(t)}</span>`);
      return `<section class="card side-card" aria-labelledby="h-roster"><h2 class="card-title" id="h-roster">${I18n.t('Takımlar')}</h2><div class="iz-roster">${rows.join('')}</div></section>`;
    }

    function rulesFlow(r) {
      const steps = r.steps.map(
        (x, i) => `${i ? `<li class="iz-flow-arrow" aria-hidden="true">${ICONS.forward}</li>` : ''}<li class="iz-step">
          <span class="iz-step-name">${x.name}${i === r.steps.length - 1 ? ICONS.trophy : ''}</span>
          <span class="iz-step-min">${x.min}<small>${I18n.t('dk')}</small></span>
          <span class="iz-step-who">${x.who}</span>
        </li>`,
      );
      return `<ol class="iz-flow" aria-label="${I18n.t('Turnuva akışı')}">${steps.join('')}</ol>`;
    }

    function watchRules({ open = false, light = false, fixed = false } = {}) {
      const r = rulesText(getState().settings);
      const sep = ' <i aria-hidden="true">›</i> ';
      const content = `<div class="iz-rules-body" id="iz-rules-${light ? 'tv' : 'body'}"${open || fixed ? '' : ' inert'}><div class="iz-rules-in"><div class="iz-rules-pad">
        ${rulesFlow(r)}
        <p class="iz-flow-meta">${r.meta}</p>
        <dl class="iz-rules-dl">
          <div><dt>${I18n.t('Puan')}</dt><dd class="iz-rules-pts"><span><b>3</b>${I18n.t('galibiyet')}</span><span><b>1</b>${I18n.t('beraberlik')}</span><span><b>0</b>${I18n.t('mağlubiyet')}</span></dd></div>
          <div><dt>${I18n.t('Beraberlik')}</dt><dd>${r.draw}</dd></div>
          <div><dt>${I18n.t('Puan eşitse')}</dt><dd>${[I18n.t('Averaj'), I18n.t('atılan gol'), I18n.t('aralarındaki maç'), I18n.t('penaltı ya da yazı-tura')].join(sep)}</dd></div>
        </dl>
      </div></div></div>`;
      const label = `<span class="iz-rules-label">${light ? '' : ICONS.help}${I18n.t('Nasıl oynanıyor?')}</span>`;
      if (fixed) {
        return `<section class="iz-rules is-open" aria-labelledby="iz-rules-h"><h2 class="iz-rules-head" id="iz-rules-h">${label}</h2>${content}</section>`;
      }
      return `<section class="iz-rules${open ? ' is-open' : ''}${light ? ' is-light' : ''}">
        <button class="iz-rules-btn" data-action="rules-toggle" aria-expanded="${open}" aria-controls="iz-rules-${light ? 'tv' : 'body'}">
          ${label}<span class="iz-rules-lead">${r.summary}${ICONS.chevron}</span>
        </button>
        ${content}
      </section>`;
    }

    function watchScorers(open) {
      const { list } = T.topScorers(getState());
      const label = `<span class="iz-kings-label">${I18n.t('Gol kralı')}</span>`;
      if (!list.length) {
        return `<section class="iz-kings" aria-label="${I18n.t('Gol krallığı')}"><div class="iz-kings-btn">${label}<span class="iz-kings-none">${I18n.t('Henüz gol yok')}</span></div></section>`;
      }
      const top = list[0].goals;
      const leaders = list.filter((s) => s.goals === top);
      const lead =
        leaders
          .slice(0, 2)
          .map((s) => `<span class="iz-kings-name">${scorerSwatch(s)}<span class="tn-name">${esc(s.name)}</span></span>`)
          .join('<span class="iz-kings-sep" aria-hidden="true">·</span>') + (leaders.length > 2 ? `<span class="iz-kings-more">+${leaders.length - 2}</span>` : '');
      return `<section class="iz-kings" aria-label="${I18n.t('Gol krallığı')}">
        <button class="iz-kings-btn" data-action="scorers-toggle" aria-expanded="${open}" aria-controls="iz-kings-list">
          ${label}<span class="iz-kings-lead">${lead}<strong>${I18n.t('{n} gol', { n: top })}</strong>${ICONS.chevron}</span>
        </button>
        <ol class="iz-kings-list" id="iz-kings-list"${open ? '' : ' hidden'}>${scorerRows(list)}</ol>
      </section>`;
    }

    function scorerSwatch(s) {
      const t = team(s.team);
      return t ? swatch(t, { own: true }) : '<span class="is-tbd"><span class="sw"></span></span>';
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
      const active = new Set(T.activeMatches(state));
      const groups = fixtureGroups(state)
        .map((g) => ({ ...g, matches: g.matches.filter((m) => active.has(m)) }))
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

    // Düğme ::after ile bütün satırı kaplar; satırdaki takım düğmeleri onun üstünde kalır.
    function summaryButton(m, cls, inner) {
      return `<button class="${cls} row-hit" data-action="match" data-match="${m.id}" aria-label="${I18n.t('{title} özeti: {result}', { title: matchTitle(m), result: lastResult(m) })}">${inner}</button>`;
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
        time = `<span class="tag-live">${I18n.t('Canlı')}</span>`;
        score = `${s.home}–${s.away}`;
      } else if (m.status === 'done') {
        time = fmtTime(m.startedAt);
        score = `${s.home}–${s.away}${m.pens ? `<small>${I18n.t('pen.')} ${m.pens.home}–${m.pens.away}</small>` : ''}`;
      }
      let scoreEl = `<span class="iz-fx-score">${score}</span>`;
      if (links && m.status === 'live') scoreEl = `<button class="iz-fx-score" data-action="tab" data-tab="mac" aria-label="${I18n.t('Canlı maça git')}">${score}</button>`;
      else if (m.status === 'done') scoreEl = summaryButton(m, 'iz-fx-score', score);
      return `<div class="iz-fx-row is-${m.status}">
        <span class="iz-fx-time">${time}</span>${side('home')}${scoreEl}${side('away')}
      </div>`;
    }

    const TABS = [
      ['mac', I18n.t('Maç'), ICONS.tabMac, ICONS.tabMacOn],
      ['fikstur', I18n.t('Fikstür'), ICONS.tabFikstur, ICONS.tabFiksturOn],
      ['puan', I18n.tc('tab', 'Puan'), ICONS.tabPuan, ICONS.tabPuanOn],
    ];

    function renderTabBar(active) {
      return TABS.map(
        ([key, label, off, on]) => `<button class="iz-tab" role="tab" data-action="tab" data-tab="${key}" aria-selected="${key === active}">
          <span class="iz-tab-pill">${off}${on}${key === 'mac' ? '<span class="iz-tab-dot" aria-hidden="true"></span>' : ''}</span>
          <span class="iz-tab-label">${label}</span>${key === 'mac' ? `<span class="sr iz-tab-live">, ${I18n.t('canlı maç var')}</span>` : ''}
        </button>`,
      ).join('');
    }

    const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

    function pageHead(title, sub) {
      return `<h1 class="iz-large">${title}</h1><p class="iz-large-sub">${sub}</p>`;
    }

    function renderFixturePage({ rulesOpen = false } = {}) {
      const state = getState();
      const n = T.activeMatches(state).length;
      const matches = I18n.t('{n} maç', { n });
      const sub = T.champion(state) ? `${I18n.t('Turnuva bitti')} · ${matches}` : `${matches} · ${I18n.t('tahmini bitiş {time}', { time: fmtTime(T.schedule(state).estEnd) })}`;
      return `${pageHead(I18n.t('Fikstür'), sub)}<div class="iz-stack">${watchRules({ open: rulesOpen })}${watchFixtures({ links: true })}</div>`;
    }

    function renderStandingsPage() {
      const state = getState();
      const { rows, unresolved } = T.computeStandings(state);
      const { zones, note: zoneNote } = standingZones(state.settings);
      const done = T.leagueDone(state);
      const tied = new Set(done ? unresolved.flat() : []);
      const current = state.matches.find((m) => m.stage === 'league' && m.status !== 'done');
      const sub = done ? I18n.t('Lig bitti') : state.settings.leagueRounds > 1 ? I18n.t('Lig · {n}. devre', { n: current.round }) : I18n.t('Lig sürüyor');
      const body = rows
        .map((r, i) => {
          const t = team(r.team);
          return `<button class="iz-st-row" data-action="team" data-team="${t.id}" aria-label="${I18n.t('{name}, {rank}. sıra, {pts} puan', { name: esc(t.name), rank: i + 1, pts: r.pts })}">
            <span><span class="rank rank-${zones[i]}">${i + 1}</span>${tied.has(r.team) ? TIE_MARK : ''}</span>
            <span class="iz-st-tn" style="${teamStyle(t)}">${swatch(t)}<span class="tn-name">${esc(t.name)}</span></span>
            <span>${r.played}</span><span>${signed(r.gd)}</span><b>${r.pts}</b>${ICONS.forward}
          </button>`;
        })
        .join('');
      const liveLeague = liveMatch()?.stage === 'league';
      const note = `${zoneNote}${liveLeague ? ` · ${I18n.t('canlı maç anlık skorla dahil')}` : ''}`;
      const { list } = T.topScorers(state);
      const kings = list.length ? `<ol class="iz-kings-list">${scorerRows(list, { withTeam: true })}</ol>` : `<p class="iz-card-note">${I18n.t('Henüz gol yok')}</p>`;
      return `${pageHead(I18n.tc('tab', 'Puan'), sub)}<div class="iz-stack">
        <section class="iz-card" aria-label="${I18n.t('Puan durumu')}">
          <h2 class="iz-card-h">${I18n.t('Puan durumu')}</h2>
          <div class="iz-st-head" aria-hidden="true"><span></span><span></span><span>${I18n.t('O')}</span><span>${I18n.t('Av')}</span><span>${I18n.t('P')}</span><span></span></div>
          ${body}
          <p class="iz-card-note">${note}</p>
        </section>
        <section class="iz-card" aria-label="${I18n.t('Gol krallığı')}"><h2 class="iz-card-h">${I18n.t('Gol krallığı')} <small>${I18n.t('gol')}</small></h2>${kings}</section>
      </div>`;
    }

    function teamOutcome(id) {
      const state = getState();
      const champ = T.champion(state);
      const fin = findStage('final');
      const po = T.hasPlayoff(state.settings) ? findStage('playoff') : null;
      if (champ === id) return [I18n.t('Şampiyon'), championData(id).line];
      if (champ && !T.hasFinal(state.settings)) {
        const { rows } = T.computeStandings(state, { includeLive: false });
        const pos = rows.findIndex((r) => r.team === id);
        return [RANKS[pos], I18n.t('{n} puan', { n: rows[pos].pts })];
      }
      if (champ && (fin.home === id || fin.away === id)) return [I18n.t('Finalist'), I18n.t('Final: {result}', { result: lastResult(fin) })];
      if (po?.status === 'done' && (po.home === id || po.away === id)) return [I18n.t('Playoff\'ta elendi'), I18n.t('Playoff: {result}', { result: lastResult(po) })];
      return [champ ? I18n.t('Turnuva bitti') : I18n.t('Maçları bitti'), ''];
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
            `<li><span class="iz-pl-name">${esc(p.name)}</span>${goals && goals === top ? `<span class="iz-pl-tag">${I18n.t('Gol kralı')}</span>` : '<span></span>'}<b${goals ? '' : ' class="is-zero"'}>${goals}</b></li>`,
        );
      const played = state.matches.filter((m) => m.status !== 'pending');
      const count = (test) => played.reduce((n, m) => n + m.goals.filter((g) => g.team === id && test(g)).length, 0);
      const unnamed = count((g) => !g.playerId);
      const gifted = count((g) => g.playerId && g.ownGoal);
      if (gifted) players.push(`<li class="is-unnamed"><span class="iz-pl-name">${I18n.t('Rakip kendi kalesine')}</span><span></span><b>${gifted}</b></li>`);
      if (unnamed) players.push(`<li class="is-unnamed"><span class="iz-pl-name">${I18n.t('Golcüsü bilinmeyen')}</span><span></span><b>${unnamed}</b></li>`);

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
                ? `<span class="iz-res is-g" title="${I18n.t('Galibiyet')}">${I18n.t('G')}</span>`
                : w
                  ? `<span class="iz-res is-m" title="${I18n.t('Mağlubiyet')}">${I18n.t('M')}</span>`
                  : `<span class="iz-res is-b" title="${I18n.t('Beraberlik')}">${I18n.t('B')}</span>`;
          }
          const time = m.status === 'live' ? `<span class="tag-live">${I18n.t('Canlı')}</span>` : m.status === 'done' ? fmtTime(m.startedAt) : fmtTime(est[m.id]?.estStart);
          const score = m.status === 'pending' ? '–' : `${us}–${them}${m.pens ? `<small>${I18n.t('pen.')}</small>` : ''}`;
          const scoreEl = m.status === 'done' ? summaryButton(m, 'iz-tm-score', score) : `<span class="iz-tm-score">${score}</span>`;
          return `<li class="is-${m.status}"><span class="iz-tm-time">${time}<small>${matchTitle(m)}</small></span><span class="iz-tm-opp" style="${teamStyle(opp)}">${swatch(opp)}<span class="tn-name">${esc(opp.name)}</span></span>${scoreEl}${res}</li>`;
        })
        .join('');
      let elim = '';
      if (!T.leagueDone(state)) {
        elim = T.hasFinal(state.settings)
          ? `<li class="iz-tm-note">${T.hasPlayoff(state.settings) ? I18n.t('Eleme maçları lig bitince belli olur: 1. finale, 2. ve 3. playoff\'a.') : I18n.t('Eleme maçları lig bitince belli olur: 1. ve 2. finale.')}</li>`
          : `<li class="iz-tm-note">${I18n.t('Final yok: ligi birinci bitiren şampiyon olur.')}</li>`;
      }

      const live = liveMatch();
      const next = mine.find((m) => m.status === 'pending');
      let now;
      if (live && (live.home === id || live.away === id)) {
        const s = T.score(live);
        now = `<section class="iz-nx" aria-label="${I18n.t('Şu an sahada')}">
          <span class="iz-nx-label"><span class="tag-live">${I18n.t('Canlı')}</span>${I18n.t('Şu an sahada')} · ${matchTitle(live)}</span>
          <span class="iz-nx-teams">${screenTeam(live, 'home')}<span>${s.home}–${s.away}</span>${screenTeam(live, 'away', true)}</span>
          <span class="iz-nx-sub"><span data-timer></span> ${I18n.t('kalan')}</span>
          <button class="iz-nx-go" data-action="tab" data-tab="mac">${I18n.t('Maça git')}</button>
        </section>`;
      } else if (next) {
        const it = est[next.id];
        now = `<section class="iz-nx" aria-label="${I18n.t('Sıradaki maç')}">
          <span class="iz-nx-label">${I18n.t('Sıradaki maç · tahmini başlama')}</span>
          <strong class="iz-nx-big">${fmtTime(it?.estStart)}</strong>
          <span class="iz-nx-teams">${screenTeam(next, 'home')}<span class="tv-dash">–</span>${screenTeam(next, 'away', true)}</span>
          <span class="iz-nx-sub">${watchKicker(next)} · ${I18n.t('{n} dk', { n: T.matchMinutes(state, next) })}</span>
        </section>`;
      } else {
        const [title, sub] = teamOutcome(id);
        now = `<section class="iz-nx" aria-label="${I18n.t('Turnuva')}"><span class="iz-nx-label">${T.champion(state) ? I18n.t('Turnuva bitti') : I18n.t('Bu takımın maçları')}</span><strong class="iz-nx-big">${title}</strong>${sub ? `<span class="iz-nx-sub">${sub}</span>` : ''}</section>`;
      }

      return `<div class="iz-th" style="${teamStyle(t)}">${swatch(t, { big: true })}<h1>${esc(t.name)}</h1></div>
        <div class="iz-th-stats">
          <div><b>${I18n.t('{n}.', { n: pos + 1 })}</b><span>${I18n.t('Lig sırası')}</span></div><div><b>${r.pts}</b><span>${I18n.t('Puan')}</span></div>
          <div><b>${r.played}</b><span>${I18n.tc('count', 'Maç')}</span></div><div><b>${signed(r.gd)}</b><span>${I18n.t('Averaj')}</span></div>
        </div>
        <div class="iz-stack">${now}
          <section class="iz-card" aria-label="${I18n.t('Oyuncular')}"><h2 class="iz-card-h">${I18n.t('Oyuncular')} <small>${I18n.t('gol')}</small></h2><ol class="iz-pl">${players.join('')}</ol></section>
          <section class="iz-card" aria-label="${I18n.t('Maçlar')}"><h2 class="iz-card-h">${I18n.t('Maçlar')}</h2><ol class="iz-tm">${games}${elim}</ol>
            <p class="iz-card-note">${I18n.t('G galibiyet · B beraberlik · M mağlubiyet · skor takımın gözünden')}</p></section>
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
          if (label) label.textContent = over ? I18n.t('Süre doldu') : running ? label.dataset.running || '' : I18n.t('Duraklatıldı');
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
      match,
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
      awaitingChampion,
      renderMatchSummary,
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

  return { COLORS, ICONS, WIDE_QUERY, esc, clamp, teamStyle, swatch, fmtClock, fmtTime, goalMinute, displayName, startText, rulesText, toggleRules, keepAwake, sheetView, create };
});
