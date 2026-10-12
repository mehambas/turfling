(() => {
  'use strict';

  const T = window.Tournament;
  const STORAGE_KEY = 'halisaha-turnuva';
  const PREFS_KEY = 'halisaha-turnuva-prefs';
  const MINUTE = T.MINUTE;

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
  };

  const PITCH_LINES =
    '<svg class="pitch-lines wide-only" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><line x1="400" y1="0" x2="400" y2="520"/><circle cx="400" cy="260" r="86"/><circle class="spot" cx="400" cy="260" r="4"/><rect x="-2" y="150" width="96" height="220"/><rect x="706" y="150" width="96" height="220"/></svg>' +
    '<svg class="pitch-lines narrow-only" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><line x1="0" y1="280" x2="400" y2="280"/><circle cx="200" cy="280" r="70"/><rect x="110" y="-2" width="180" height="80"/><rect x="110" y="482" width="180" height="80"/></svg>';

  const TV_LINES =
    '<svg class="tv-lines" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true"><rect x="24" y="24" width="1232" height="672" rx="6"/><line x1="640" y1="24" x2="640" y2="696"/><circle cx="640" cy="360" r="120"/><rect x="24" y="200" width="150" height="320"/><rect x="1106" y="200" width="150" height="320"/></svg>';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let storageWarned = false;
  let state = loadState();
  const prefs = loadPrefs();
  const ui = {
    tab: state.started ? 'dashboard' : 'setup',
    goalPicker: null,
    goalFresh: false,
    showAllScorers: false,
    finishing: false,
    revealDraw: false,
    fixtureFilter: 'all',
    colorMenu: null,
    moveMenu: null,
    screenFixtures: false,
  };
  const dialog = { kind: null, opts: null, resolve: null, matchId: null, pens: { home: '', away: '' }, error: '' };
  let viewHtml = '';
  let sideHtml = '';

  const isScreen = () => location.hash === '#ekran';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return T.migrate(JSON.parse(raw));
    } catch (err) {
      console.warn('Kayıt okunamadı', err);
    }
    return T.createState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Kayıt yazılamadı', err);
      if (!storageWarned) toast('Tarayıcı kayda izin vermiyor: sayfa kapanırsa veriler kaybolur. Yedek indirin.', 'warn');
      storageWarned = true;
    }
  }

  function loadPrefs() {
    const base = { sound: true, theme: null };
    try {
      return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return base;
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }

  function commit(fn, { rerender = true } = {}) {
    fn();
    T.resolveKnockouts(state);
    saveState();
    if (rerender) render();
  }

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const team = (id) => state.teams.find((t) => t.id === id) || null;
  const player = (id) => state.players.find((p) => p.id === id) || null;
  const match = (id) => state.matches.find((m) => m.id === id) || null;
  const liveMatch = () => state.matches.find((m) => m.status === 'live') || null;
  const nextMatch = () => T.activeMatches(state).find((m) => m.status === 'pending') || null;
  const findStage = (stage, list = state.matches) => list.find((m) => m.stage === stage) || null;
  const estimates = (st) => Object.fromEntries(T.schedule(st).items.map((i) => [i.id, i]));
  const tournamentName = () => state.name.trim() || 'Halı Saha Turnuvası';

  function lastFinished() {
    return state.matches.filter((m) => m.status === 'done').sort((a, b) => b.endedAt - a.endedAt)[0] || null;
  }

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

  function fmtDuration(ms) {
    const total = Math.round(ms / MINUTE);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `${h} sa${m ? ` ${m} dk` : ''}` : `${m} dk`;
  }

  const minuteOf = (ts) => Math.floor(ts / MINUTE);
  const goalMinute = (g) => (g.ms == null ? '' : `${Math.floor(g.ms / MINUTE) + 1}'`);

  function matchTitle(m, list = state.matches) {
    if (m.stage === 'league') return `${list.filter((x) => x.stage === 'league').indexOf(m) + 1}. maç`;
    return m.stage === 'playoff' ? 'Playoff' : 'Final';
  }

  function matchLabel(m) {
    if (m.stage !== 'league') return matchTitle(m);
    return `${matchTitle(m)} <span class="of">/ ${T.activeMatches(state).length}</span>`;
  }

  function placeholder(m, side) {
    if (m.stage === 'playoff') return side === 'home' ? 'Lig 2.si' : 'Lig 3.sü';
    if (side === 'home') return 'Lig 1.si';
    return state.settings.playoffEnabled ? 'Playoff galibi' : 'Lig 2.si';
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

  function restingHtml(m) {
    const tag = (label, t) => `${label} <span class="sw" style="${teamStyle(t)}"></span><strong>${esc(t.name)}</strong>`;
    if (m.stage === 'league') {
      const t = team(T.TEAM_IDS.find((x) => x !== m.home && x !== m.away));
      return t ? tag('Dinlenen', t) : '';
    }
    if (m.stage === 'playoff') {
      const t = team(findStage('final')?.home);
      return t ? tag('Finalde bekleyen', t) : 'Lig 1.si finalde bekler';
    }
    return '';
  }

  function canEdit(m) {
    if (m.status !== 'done') return false;
    if (m.stage === 'league') return state.matches.filter((x) => x.stage !== 'league').every((x) => x.status === 'pending');
    if (m.stage === 'playoff') return findStage('final').status === 'pending';
    return true;
  }

  function canTogglePlayoff() {
    if (!state.started) return true;
    return findStage('playoff')?.status === 'pending' && findStage('final')?.status === 'pending';
  }

  function previewState() {
    return state.started ? state : { ...state, matches: T.generateMatches(state.settings) };
  }

  function setView(html) {
    viewHtml = html;
    $('#view').innerHTML = html;
  }

  function render() {
    applyTheme();
    const screen = isScreen();
    document.body.classList.toggle('is-screen', screen);
    if (screen) {
      document.title = `${tournamentName()} · Yayın`;
      $('#view').className = 'screen';
      setView(renderScreen());
    } else {
      renderChrome();
      $('#view').className = `view view-${ui.tab}`;
      if (ui.tab === 'dashboard') setView(renderDashboard());
      else if (ui.tab === 'fixtures') setView(renderFixtures());
      else setView(renderSetup());
    }
    renderDialog();
    tick();
    keepAwake(screen || !!liveMatch());
  }

  function applyTheme() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
  }

  function effectiveTheme() {
    return prefs.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function renderChrome() {
    const name = tournamentName();
    $('#brand-title').textContent = name;
    document.title = name;
    const live = !!liveMatch();
    for (const b of $$('.tab')) {
      const on = b.dataset.tab === ui.tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('has-live', b.dataset.tab === 'dashboard' && live);
    }
    const dark = effectiveTheme() === 'dark';
    const tools = [
      ['toggle-sound', prefs.sound ? ICONS.soundOn : ICONS.soundOff, prefs.sound ? 'Sesi kapat' : 'Sesi aç'],
      ['toggle-theme', dark ? ICONS.sun : ICONS.moon, dark ? 'Açık tema' : 'Koyu tema'],
    ];
    for (const [action, icon, label] of tools) {
      const b = $(`[data-action="${action}"]`);
      b.innerHTML = icon;
      b.title = label;
      b.setAttribute('aria-label', label);
    }
  }

  function renderDashboard() {
    if (!state.started) return renderNotStarted();
    const live = liveMatch();
    const champ = T.champion(state);
    let main;
    if (live) main = renderLive(live);
    else if (champ) main = renderChampion(champ);
    else main = renderNext(estimates(state));
    sideHtml = renderSide();
    return `<div class="dash">
      <div class="dash-main">${main}</div>
      <aside class="dash-side" id="dash-side" aria-label="Özet">${sideHtml}</aside>
    </div>`;
  }

  function renderSide() {
    const live = liveMatch();
    const pending = T.activeMatches(state).filter((m) => m.status === 'pending');
    const next = T.champion(state) ? null : pending[live ? 0 : 1];
    return `${next ? renderSideNext(next) : ''}${renderTimeAlert()}${renderStandings()}${renderScorers()}`;
  }

  function renderNotStarted() {
    const n = state.players.length;
    const drawn = state.teams.every((t) => t.playerIds.length);
    const item = (no, done, text, extra = '') =>
      `<li class="${done ? 'is-done' : ''}"><span class="ck">${done ? ICONS.check : no}</span>${text}${extra}</li>`;
    return `<section class="card hero">
      <div class="hero-mark">${ICONS.ball}</div>
      <h1>Turnuva henüz başlamadı</h1>
      <p>Kurulumu tamamlayın. Ardından canlı skor, puan durumu ve zaman planı burada görünür.</p>
      <ol class="checklist">
        ${item(1, n >= 3, 'Oyuncuları ekleyin', `<small>${n} oyuncu</small>`)}
        ${item(2, drawn, 'Kurayı çekin')}
        ${item(3, false, 'Süreleri kontrol edip başlatın')}
      </ol>
      <button class="btn btn-primary btn-lg" data-action="tab" data-tab="setup">Kuruluma git</button>
    </section>`;
  }

  function cardTop(m, tag) {
    const rest = restingHtml(m);
    return `<div class="lc-top">
      <div class="lc-top-l">${tag}<span class="lc-no">${matchLabel(m)}</span></div>
      ${rest ? `<span class="lc-rest">${rest}</span>` : ''}
    </div>`;
  }

  function renderLive(m) {
    const s = T.score(m);
    const home = team(m.home);
    const away = team(m.away);
    const running = m.runningSince != null;
    const picker = ui.goalPicker ? m.goals.find((g) => g.id === ui.goalPicker) : null;
    const fresh = picker && ui.goalFresh ? picker.team : null;
    const digit = (n, t) => `<span${fresh === t.id ? ' class="is-fresh"' : ''}>${n}</span>`;
    return `<section class="pitch-card live-card${picker ? ' has-picker' : ''}" aria-label="Canlı maç">
      ${PITCH_LINES}
      <div class="pc-body">
        ${cardTop(m, '<span class="tag-live">Canlı</span>')}
        <div class="lc-board">
          ${liveTeam(m, home, 'home')}
          <div class="lc-score" role="img" aria-label="Skor: ${esc(home.name)} ${s.home}, ${esc(away.name)} ${s.away}">${digit(s.home, home)}<span class="lc-dash">–</span>${digit(s.away, away)}</div>
          ${liveTeam(m, away, 'away')}
        </div>
        ${m.goals.length ? `<div class="lc-chips lc-chips-all narrow-only">${m.goals.map((g) => goalChip(g, true)).join('')}</div>` : ''}
        ${picker ? renderGoalPicker(m, picker) : ''}
        <div class="lc-play">
          <div class="lc-clockbox">
            <div class="lc-clock" data-clock>
              <span class="lc-state" data-timer-state></span>
              <span class="lc-time" data-timer></span>
              <span class="lc-bar"><span data-timer-bar></span></span>
            </div>
            <div class="lc-btns">
              <button class="lc-btn" data-action="timer-adjust" data-delta="-1" aria-label="Süreyi 1 dakika kısalt" title="Süreyi 1 dakika kısalt">−1</button>
              <button class="lc-btn lc-toggle" data-action="timer-toggle">${running ? `${ICONS.pause}Duraklat` : `${ICONS.play}Devam et`}</button>
              <button class="lc-btn" data-action="timer-adjust" data-delta="1" aria-label="Süreyi 1 dakika uzat" title="Süreyi 1 dakika uzat">+1</button>
            </div>
          </div>
          ${goalButton(home, 'home')}
          ${goalButton(away, 'away')}
        </div>
        ${ui.finishing ? renderPensForm(m) : ''}
        <footer class="lc-foot">
          <button class="lc-cancel" data-action="cancel-match">Maçı iptal et</button>
          ${ui.finishing ? '' : '<button class="btn btn-lime btn-lg lc-finish" data-action="finish-match">Maçı bitir</button>'}
        </footer>
      </div>
    </section>`;
  }

  function liveTeam(m, t, side) {
    const goals = m.goals.filter((g) => g.team === t.id);
    return `<div class="lc-team lc-${side}" style="${teamStyle(t)}">
      <span class="lc-name"><span class="sw"></span><span class="lc-name-text">${esc(t.name)}</span></span>
      ${goals.length ? `<div class="lc-chips wide-only">${goals.map((g) => goalChip(g, false)).join('')}</div>` : ''}
    </div>`;
  }

  function goalChip(g, withDot) {
    const p = player(g.playerId);
    const min = goalMinute(g);
    const label = p ? `${esc(p.name)} ${min}` : `? ${min}`;
    const aria = p ? `Gol: ${p.name}, ${min}. Düzenle veya sil` : `Gol ${min}: golü atan seçilmedi`;
    const cls = `${p ? '' : ' is-unknown'}${ui.goalPicker === g.id ? ' is-open' : ''}`;
    return `<button class="chip-goal${cls}" style="${teamStyle(team(g.team))}" data-action="scorer-edit" data-goal="${g.id}" aria-label="${esc(aria)}" title="Düzenle / sil">${withDot ? '<span class="sw"></span>' : ''}${label}${p && !withDot ? ICONS.pencil : ''}</button>`;
  }

  function goalButton(t, side) {
    return `<button class="lc-goal lc-goal-${side}" style="${teamStyle(t)}" data-action="goal-add" data-team="${t.id}" aria-label="${esc(t.name)}: gol ekle">${ICONS.plus}Gol<span class="lc-goal-team">${esc(t.name)}</span></button>`;
  }

  function renderGoalPicker(m, g) {
    const t = team(g.team);
    const s = T.score(m);
    const min = goalMinute(g);
    const chip = (p) => {
      const on = g.playerId === p.id;
      return `<button class="pk-player${on ? ' is-on' : ''}" data-action="scorer-pick" data-goal="${g.id}" data-player="${p.id}" aria-pressed="${on}">${on ? ICONS.check : ''}${esc(p.name)}</button>`;
    };
    const own = t.playerIds.map(player).filter(Boolean);
    const others = state.players.filter((p) => !t.playerIds.includes(p.id));
    const more = ui.showAllScorers
      ? others.map(chip).join('')
      : others.length
        ? '<button class="pk-player pk-more" data-action="scorer-more">Diğer…</button>'
        : '';
    return `<div class="picker-scrim narrow-only" data-action="picker-close"></div>
    <section class="picker" aria-labelledby="picker-title" style="${teamStyle(t)}">
      <span class="picker-grip narrow-only" aria-hidden="true"></span>
      <div class="picker-head">
        <div class="picker-title">
          <span class="picker-meta narrow-only">${g.ms == null ? '' : `${Math.floor(g.ms / MINUTE) + 1}. dakika · `}${s.home}–${s.away}</span>
          <h2 id="picker-title"><span class="picker-soft wide-only">${min ? `${min} · ` : ''}</span><span class="sw narrow-only"></span><span class="picker-team">${esc(t.name)} golü</span><span class="picker-soft wide-only">&nbsp;— kim attı?</span></h2>
        </div>
        <button class="pk-remove wide-only" data-action="goal-remove" data-goal="${g.id}">${ICONS.undo}${ui.goalFresh ? 'Yanlışlıkla mı? Geri al' : 'Golü sil'}</button>
        <button class="pk-close narrow-only" data-action="picker-close" aria-label="Kapat">${ICONS.x}</button>
      </div>
      <span class="picker-label narrow-only">Golü atan</span>
      <div class="pk-players" role="group" aria-label="Golü atan">
        ${own.map(chip).join('')}${more}
        <button class="pk-later wide-only" data-action="picker-close">${g.playerId ? 'Kapat' : 'Sonra seç'}</button>
      </div>
      <div class="pk-foot narrow-only">
        <button class="pk-delete" data-action="goal-remove" data-goal="${g.id}">${ui.goalFresh ? `${ICONS.undo}Geri al` : `${ICONS.trash}Golü sil`}</button>
        <button class="btn btn-primary btn-lg" data-action="picker-close">Tamam</button>
      </div>
    </section>`;
  }

  function renderPensForm(m) {
    const h = team(m.home);
    const a = team(m.away);
    const field = (t, id) =>
      `<label style="${teamStyle(t)}"><span class="sw"></span>${esc(t.name)}<input class="input-num" id="${id}" type="number" min="0" max="30" inputmode="numeric"></label>`;
    return `<div class="pens">
      <strong>Maç berabere bitti: penaltı sonucunu girin</strong>
      <div class="pens-row">${field(h, 'pens-home')}${field(a, 'pens-away')}</div>
      <p class="form-error" id="pens-error" role="alert"></p>
      <div class="pens-actions">
        <button class="lc-cancel" data-action="finish-cancel">Vazgeç</button>
        <button class="btn btn-lime" data-action="pens-confirm">Kaydet ve bitir</button>
      </div>
    </div>`;
  }

  function renderNext(est) {
    const m = nextMatch();
    if (!m) return '';
    const ready = !!(m.home && m.away);
    const blocking = m.stage !== 'league' && T.blockingTies(state).length > 0;
    const last = lastFinished();
    const isBreak = last && last.stage === 'league' && m.stage !== 'league';
    const gapMin = last ? (isBreak ? state.settings.breakMin : state.settings.changeMin) : 0;
    const showGap = last && gapMin > 0 && Date.now() - last.endedAt < 30 * MINUTE;
    return `<section class="pitch-card next-card" aria-label="Sıradaki maç">
      ${PITCH_LINES}
      <div class="pc-body">
        ${cardTop(m, '<span class="tag-next">Sıradaki</span>')}
        <div class="nc-teams">${teamName(m.home, m, 'home')}<span class="lc-dash" aria-hidden="true">–</span>${teamName(m.away, m, 'away', { end: true })}</div>
        <div class="nc-meta">
          <span>${T.matchMinutes(state, m)} dk</span>
          ${est[m.id] && ready ? `<span>Tahmini başlama ${fmtTime(est[m.id].estStart)}</span>` : ''}
          ${last ? `<span>Son maç: ${lastResult(last)}</span>` : ''}
        </div>
        ${showGap ? `<div class="nc-gap" data-until="${last.endedAt + gapMin * MINUTE}" data-label="${isBreak ? 'Ara' : 'Değişim'}"></div>` : ''}
        ${blocking ? renderLotsAlert() : ''}
        <div class="nc-foot">
          <button class="btn btn-lime btn-lg" data-action="start-match" data-id="${m.id}" ${ready && !blocking ? '' : 'disabled'}>${ICONS.play}Maçı başlat</button>
        </div>
      </div>
    </section>`;
  }

  function renderLotsAlert() {
    const groups = T.blockingTies(state);
    const names = (g) => g.map((id) => `<strong>${esc(team(id).name)}</strong>`).join(' ve ');
    const pair = groups.length === 1 && groups[0].length === 2 ? groups[0] : null;
    return `<div class="pc-alert">
      <p>${groups.map(names).join('; ')} puan, averaj, attığı gol ve ikili maçlarda eşit. Sıralamayı penaltı ya da yazı-tura ile belirleyin.</p>
      <div class="btn-row">
        ${pair ? pair.map((id) => `<button class="btn btn-sm" data-action="lots-set" data-first="${id}">${esc(team(id).name)} üstte</button>`).join('') : ''}
        <button class="btn btn-sm" data-action="lots-draw">Rastgele kura çek</button>
      </div>
    </div>`;
  }

  function championData(id) {
    const t = team(id);
    const fin = findStage('final');
    const players = t.playerIds.map(player).filter(Boolean).map((p) => `<span>${esc(p.name)}</span>`).join('');
    const { list } = T.topScorers(state);
    const best = list.filter((x) => x.goals === list[0]?.goals);
    return { t, fin, players, best };
  }

  function renderChampion(id) {
    const { t, fin, players, best } = championData(id);
    return `<section class="pitch-card champion" style="${teamStyle(t)}" aria-label="Şampiyon">
      ${PITCH_LINES}
      <div class="pc-body">
        <span class="champ-icon">${ICONS.trophy}</span>
        <span class="champ-kicker">Şampiyon</span>
        <h1 class="champ-name"><span class="sw"></span>${esc(t.name)}</h1>
        <p class="champ-line">Final: ${lastResult(fin)}</p>
        <div class="champ-players">${players}</div>
        ${best.length ? `<p class="champ-line">Gol kralı: ${best.map((b) => esc(b.name)).join(', ')} · ${best[0].goals} gol</p>` : ''}
      </div>
    </section>`;
  }

  function renderSideNext(m) {
    const it = estimates(state)[m.id];
    return `<section class="card side-next" aria-label="Sıradaki maç">
      <span class="side-next-label">Sıradaki${it && m.home && m.away ? ` · ~${fmtTime(it.estStart)}` : ''}</span>
      <span class="side-next-teams">${teamName(m.home, m, 'home')}<span class="vs" aria-hidden="true">–</span>${teamName(m.away, m, 'away', { end: true })}</span>
    </section>`;
  }

  function renderTimeAlert() {
    const sc = T.schedule(state);
    const list = T.activeMatches(state);
    const done = list.filter((m) => m.status === 'done').length;
    const overMin = sc.pitchEnd == null ? 0 : minuteOf(sc.estEnd) - minuteOf(sc.pitchEnd);
    if (overMin <= 0 || done >= list.length) return '';
    const canCut = sc.playoffSaving > 0 && state.settings.playoffEnabled && canTogglePlayoff();
    return `<section class="card alert-card" role="status">
      <strong>Süre yetmeyebilir</strong>
      <p>Tahmini bitiş ${fmtTime(sc.estEnd)}, saha saatini ${overMin} dk aşıyor.${canCut ? ` Playoff kaldırılırsa tahmini bitiş ${fmtTime(sc.estEnd - sc.playoffSaving)} olur.` : ''}</p>
      ${canCut ? '<button class="btn btn-sm btn-card" data-action="disable-playoff">Playoff\'u kaldır</button>' : ''}
    </section>`;
  }

  function renderStandings() {
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

  function renderScorers() {
    const { list } = T.topScorers(state);
    const leaders = list.filter((s) => s.goals === list[0]?.goals);
    const shown = leaders.slice(0, 5);
    const rows = shown.map((s) => {
      const t = team(s.team);
      const tag = t ? `class="tn" style="${teamStyle(t)}"` : 'class="tn is-tbd"';
      return `<li><span ${tag}><span class="sw"></span><span class="tn-name">${esc(s.name)}</span></span><strong>${s.goals}</strong></li>`;
    });
    return `<section class="card side-card" aria-labelledby="h-scorers">
      <h2 class="card-title" id="h-scorers">Gol krallığı</h2>
      ${
        shown.length
          ? `<ol class="scorers">${rows.join('')}</ol>${leaders.length > shown.length ? `<p class="card-note">+${leaders.length - shown.length} oyuncu daha · ${leaders[0].goals} gol</p>` : ''}`
          : '<p class="card-note">Golü atanı seçilen goller burada sayılır.</p>'
      }
    </section>`;
  }

  function renderFixtures() {
    const preview = !state.started;
    const st = previewState();
    const sc = T.schedule(st);
    const est = Object.fromEntries(sc.items.map((i) => [i.id, i]));
    const active = T.activeMatches(st);
    const done = active.filter((m) => m.status === 'done').length;
    const left = active.length - done;
    const summary = preview
      ? `Önizleme · ${active.length} maç · Bitiş ~${fmtTime(sc.estEnd)}`
      : `${done} oynandı · ${left} kaldı${left ? ` · Bitiş ~${fmtTime(sc.estEnd)}` : ''}`;
    const f = preview ? 'all' : ui.fixtureFilter;
    const skipped = (m) => m.stage === 'playoff' && !st.settings.playoffEnabled;
    const keep = (m) => f === 'all' || (f === 'done' ? m.status === 'done' : m.status !== 'done' && !skipped(m));
    const groups = fixtureGroups(st)
      .map((g) => ({ ...g, matches: g.matches.filter(keep) }))
      .filter((g) => g.matches.length);
    const filters = [
      ['all', 'Tümü'],
      ['done', 'Oynanan'],
      ['left', 'Kalan'],
    ]
      .map(([v, label]) => `<button data-action="fixture-filter" data-value="${v}" aria-pressed="${f === v}">${label}</button>`)
      .join('');
    return `<div class="page-head">
        <div><h1 class="page-title">Fikstür</h1><p class="page-sub">${summary}</p></div>
        ${preview ? '' : `<div class="seg" role="group" aria-label="Filtre">${filters}</div>`}
      </div>
      <div class="stack">
        ${preview ? '<p class="page-note">Turnuva başlayınca skorlar ve gerçek saatler burada görünür.</p>' : renderTimeAlert()}
        ${groups.map((g) => fixtureCard(g, st, est, { readonly: preview })).join('') || '<p class="page-note">Bu filtrede maç yok.</p>'}
      </div>`;
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

  function fixtureCard(g, st, est, opts) {
    return `<section class="card fx-card" aria-label="${g.title}">
      <h2 class="fx-title">${g.title}</h2>
      <div class="fx-rows">${g.matches.map((m) => fixtureRow(m, st, est[m.id], opts)).join('')}</div>
    </section>`;
  }

  function fixtureRow(m, st, it, { readonly = false, approx = true } = {}) {
    const skipped = m.stage === 'playoff' && !st.settings.playoffEnabled;
    const s = T.score(m);
    const w = T.winnerOf(m);
    const label = matchTitle(m, st.matches);
    const side = (k) => {
      const cls = m.status === 'done' && w ? (w === m[k] ? ' is-win' : ' is-lose') : '';
      return teamName(m[k], m, k, { cls, end: k === 'home' });
    };
    if (m.status === 'live') {
      return `<div class="fx-row is-live">
        <span class="fx-label">${label}</span>
        <span class="fx-time" data-timer></span>
        <span class="fx-team fx-home">${side('home')}</span>
        <span class="fx-score">${s.home} – ${s.away}</span>
        <span class="fx-team fx-away">${side('away')}</span>
        <span class="fx-act">${readonly ? '' : '<button class="btn-live" data-action="tab" data-tab="dashboard"><span class="dot"></span>Canlı</button>'}</span>
      </div>`;
    }
    let time = '';
    if (skipped) time = 'Kaldırıldı';
    else if (m.status === 'done') time = fmtTime(m.startedAt);
    else if (it) time = `${approx ? '~' : ''}${fmtTime(it.estStart)}`;
    const score = m.status === 'done' ? `${s.home} – ${s.away}${m.pens ? `<small>pen. ${m.pens.home}–${m.pens.away}</small>` : ''}` : '–';
    let act = '';
    if (!readonly) {
      if (skipped) {
        act = canTogglePlayoff() ? '<button class="btn btn-sm" data-action="set-playoff" data-value="1">Geri ekle</button>' : '';
      } else if (m.status === 'done') {
        act = canEdit(m)
          ? `<button class="icon-btn icon-soft" data-action="edit-match" data-id="${m.id}" aria-label="${label}: sonucu düzenle" title="Sonucu düzenle">${ICONS.edit}</button>`
          : '';
      } else {
        if (m.stage === 'playoff' && canTogglePlayoff()) {
          act += '<button class="btn btn-sm" data-action="disable-playoff" title="Playoff kaldırılırsa final lig 1.si – 2.si oynanır">Kaldır</button>';
        }
        if (!liveMatch() && m.home && m.away) {
          act += `<button class="icon-btn icon-soft" data-action="start-match" data-id="${m.id}" aria-label="${label}: başlat" title="Bu maçı başlat">${ICONS.play}</button>`;
        }
      }
    }
    return `<div class="fx-row is-${skipped ? 'skipped' : m.status} is-${m.stage}">
      <span class="fx-label">${label}</span>
      <span class="fx-time">${time}</span>
      <span class="fx-team fx-home">${side('home')}</span>
      <span class="fx-score">${score}</span>
      <span class="fx-team fx-away">${side('away')}</span>
      <span class="fx-act">${act}</span>
    </div>`;
  }

  function renderSetup() {
    return `<div class="page-head">
        <h1 class="page-title">Kurulum</h1>
        ${state.started ? '' : renderSteps()}
      </div>
      <div class="setup">
        <div class="setup-side">${renderPlayers()}${renderData()}</div>
        <div class="setup-main">${renderTeams()}${renderFormat()}</div>
      </div>
      ${renderReady()}`;
  }

  function renderSteps() {
    const steps = [
      ['oyuncular', 'Oyuncular', state.players.length >= 3],
      ['takimlar', 'Kura', state.teams.every((t) => t.playerIds.length)],
      ['format', 'Süreler', false],
    ];
    const current = steps.findIndex((s) => !s[2]);
    return `<ol class="steps" aria-label="Adımlar">${steps
      .map(([id, label, done], i) => {
        const cls = `${done ? ' is-done' : ''}${i === current ? ' is-current' : ''}`;
        return `<li><button class="step${cls}" data-action="scroll-to" data-target="${id}"${i === current ? ' aria-current="step"' : ''}><span class="step-no" aria-hidden="true">${done ? ICONS.check : i + 1}</span>${label}</button></li>`;
      })
      .join('')}</ol>`;
  }

  function renderPlayers() {
    const n = state.players.length;
    return `<section class="card setup-card players-card" id="oyuncular" aria-labelledby="h-players">
      <div class="sc-head"><h2 class="card-title" id="h-players">Oyuncular</h2><span class="sc-count">${n}</span></div>
      <div class="pl-add">
        <input class="input-pill pl-name" id="new-player" placeholder="İsim yaz, Enter'a bas" maxlength="40" autocomplete="off" enterkeyhint="next" aria-label="Yeni oyuncu adı">
        <button class="icon-btn icon-primary" data-action="player-add" aria-label="Oyuncu ekle" title="Ekle">${ICONS.plus}</button>
      </div>
      ${
        n
          ? `<ol class="pl-list">${state.players.map(playerRow).join('')}</ol>`
          : '<p class="sc-hint">Alt alta yazılmış bir listeyi yapıştırırsanız hepsi birden eklenir.</p>'
      }
      ${playersFoot(n)}
    </section>`;
  }

  function playerRow(p) {
    const pots = [0, 1, 2, 3, 4, 5]
      .map((k) => `<option value="${k}"${p.pot === k ? ' selected' : ''}>${k ? `T${k}` : '–'}</option>`)
      .join('');
    return `<li class="pl-row">
      <input class="pl-input pl-name" data-field="player-name" data-id="${p.id}" value="${esc(p.name)}" maxlength="40" aria-label="Oyuncu adı">
      <span class="pot"><select data-field="player-pot" data-id="${p.id}" aria-label="${esc(p.name)}: torba" title="Torba: benzer seviyedekileri aynı torbaya koyun">${pots}</select>${ICONS.chevron}</span>
      <button class="icon-btn icon-ghost icon-sm" data-action="player-remove" data-id="${p.id}" aria-label="${esc(p.name)}: sil" title="Sil">${ICONS.x}</button>
    </li>`;
  }

  function playersFoot(n) {
    if (n === 0) return '';
    if (n < 3) return '<p class="sc-foot">Kura için en az 3 oyuncu gerekli.</p>';
    const sizes = state.teams.map((_, i) => Math.floor(n / 3) + (i < n % 3 ? 1 : 0)).join(' · ');
    const counts = {};
    for (const p of state.players) if (p.pot) counts[p.pot] = (counts[p.pot] || 0) + 1;
    const keys = Object.keys(counts).sort();
    const uneven = keys.filter((k) => counts[k] % 3);
    if (!keys.length) return `<p class="sc-foot">${sizes} kişi · torba yok, kura tamamen rastgele</p>`;
    if (!uneven.length) return `<p class="sc-foot is-ok">${ICONS.check}${sizes} kişi, torbalar dengeli</p>`;
    return `<p class="sc-foot is-warn">${sizes} kişi · ${uneven.map((k) => `T${k}: ${counts[k]}`).join(', ')}. Her torbada 3 ya da 3'ün katı kişi olursa kura tam dengeli olur.</p>`;
  }

  function renderData() {
    return `<section class="card setup-card" aria-labelledby="h-data">
      <h2 class="card-title" id="h-data">Yedek</h2>
      <div class="btn-row">
        <button class="btn btn-sm" data-action="export">${ICONS.download}İndir</button>
        <button class="btn btn-sm" data-action="import">${ICONS.upload}Yükle</button>
        <span class="spacer"></span>
        ${state.started ? '<button class="btn btn-sm btn-text-danger" data-action="reset-results">Sonuçları sıfırla</button>' : ''}
        <button class="btn btn-sm btn-text-danger" data-action="reset-all">Her şeyi sil</button>
      </div>
    </section>`;
  }

  function renderTeams() {
    const unassigned = state.players.filter((p) => !T.teamOfPlayer(state, p.id));
    const hasTeams = state.teams.some((t) => t.playerIds.length);
    const draw = state.started
      ? ''
      : `<button class="btn btn-primary btn-sm" data-action="draw-teams" ${state.players.length < 3 ? 'disabled' : ''}>${ICONS.shuffle}${hasTeams ? 'Yeniden çek' : 'Kurayı çek'}</button>`;
    return `<section class="card setup-card" id="takimlar" aria-labelledby="h-teams">
      <div class="sc-head"><h2 class="card-title" id="h-teams">Takımlar</h2>${draw}</div>
      <div class="team-grid">${state.teams.map(teamCard).join('')}</div>
      ${
        unassigned.length && hasTeams
          ? `<div class="unassigned"><span class="sc-label">Takımsız (${unassigned.length})</span><ol class="tc-players">${unassigned.map((p, i) => teamPlayer(p, null, i, 0)).join('')}</ol></div>`
          : ''
      }
      <p class="sc-hint">${
        state.started
          ? 'Turnuva sürüyor. Gerekirse (ör. sakatlıkta) oyuncuyu adının yanındaki oklarla başka takıma alabilirsiniz.'
          : 'Oyuncuyu başka takıma almak için adının yanındaki oklara dokunun. Başka takımın kullandığı renk seçilemez.'
      }</p>
    </section>`;
  }

  function teamCard(t, teamIndex) {
    const players = t.playerIds.map(player).filter(Boolean);
    const open = ui.colorMenu === t.id;
    const c = COLORS[t.color] || COLORS.red;
    return `<div class="tc" style="${teamStyle(t)}">
      <div class="tc-head">
        <input class="tc-name" data-field="team-name" data-team="${t.id}" value="${esc(t.name)}" maxlength="24" aria-label="Takım adı">
        <button class="tc-color${open ? ' is-open' : ''}" data-action="color-menu" data-team="${t.id}" data-popover aria-haspopup="listbox" aria-expanded="${open}" aria-label="Yelek rengi: ${c.label}, değiştir" title="Yelek rengi"><span class="sw"></span>${ICONS.chevron}</button>
        ${open ? colorMenu(t) : ''}
      </div>
      <ol class="tc-players">${players.map((p, i) => teamPlayer(p, t, i, teamIndex)).join('') || '<li class="tc-empty">Kura bekleniyor</li>'}</ol>
    </div>`;
  }

  function colorMenu(t) {
    return `<div class="pop pop-colors" role="listbox" aria-label="Yelek rengi" data-popover>${Object.entries(COLORS)
      .map(([key, c]) => {
        const owner = state.teams.find((o) => o !== t && o.color === key);
        const on = t.color === key;
        const extra = owner ? ` aria-disabled="true" title="${esc(owner.name)} kullanıyor"` : ` title="${c.label}"`;
        return `<button class="pop-color${on ? ' is-on' : ''}${owner ? ' is-taken' : ''}" role="option" aria-selected="${on}" data-action="team-color" data-team="${t.id}" data-color="${key}" style="--sw:${c.hex}"${extra}><span class="sw"></span>${c.label}</button>`;
      })
      .join('')}</div>`;
  }

  function teamPlayer(p, t, i, teamIndex) {
    const open = ui.moveMenu === p.id;
    const others = state.teams.filter((x) => x !== t);
    const menu = open
      ? `<div class="pop pop-move" role="menu" aria-label="Takım değiştir" data-popover><span class="pop-label">Takım değiştir</span>${others
          .map((o) => `<button class="pop-item" role="menuitem" data-action="move-player" data-id="${p.id}" data-team="${o.id}" style="${teamStyle(o)}"><span class="sw"></span>${esc(o.name)}</button>`)
          .join('')}</div>`
      : '';
    return `<li class="tc-player${ui.revealDraw ? ' reveal' : ''}" style="--i:${i * 3 + teamIndex}">
      <span class="tc-pname" data-pname="${p.id}">${esc(p.name)}</span>
      <button class="icon-btn tc-move${open ? ' is-open' : ''}" data-action="move-menu" data-id="${p.id}" data-popover aria-haspopup="menu" aria-expanded="${open}" aria-label="${esc(p.name)}: takım değiştir" title="Takım değiştir">${ICONS.swap}</button>
      ${menu}
    </li>`;
  }

  function stepper(key, label) {
    const [lo, hi] = T.LIMITS[key];
    const v = state.settings[key];
    return `<div class="box box-step">
      <span class="box-label">${label}</span>
      <div class="stepper">
        <button class="step-btn" data-action="setting-step" data-key="${key}" data-delta="-1" ${v <= lo ? 'disabled' : ''} aria-label="${label}: azalt">−</button>
        <span class="step-value">${v}<small>dk</small></span>
        <button class="step-btn" data-action="setting-step" data-key="${key}" data-delta="1" ${v >= hi ? 'disabled' : ''} aria-label="${label}: artır">+</button>
      </div>
    </div>`;
  }

  function timeField(key, label, hint) {
    return `<div class="box box-time">
      <label class="box-label" for="time-${key}">${label}</label>
      <input class="time-input" id="time-${key}" type="time" required data-field="setting-time" data-key="${key}" value="${esc(state.settings[key])}">
      <span class="box-hint">${hint}</span>
      <button class="icon-btn icon-ghost icon-sm box-clear" data-action="clear-time" data-key="${key}" aria-label="${label}: temizle" title="Temizle">${ICONS.x}</button>
    </div>`;
  }

  function renderFormat() {
    const s = state.settings;
    const togglable = canTogglePlayoff();
    const rounds = [1, 2, 3]
      .map((r) => `<button data-action="setting-rounds" data-value="${r}" aria-pressed="${s.leagueRounds === r}" ${state.started ? 'disabled' : ''}>${r} devre</button>`)
      .join('');
    const off = togglable ? '' : 'disabled';
    return `<section class="card setup-card" id="format" aria-labelledby="h-format">
      <div class="sc-head sc-head-wrap">
        <h2 class="card-title" id="h-format">Süreler</h2>
        <label class="name-field">Turnuva adı<input class="input-pill" data-field="tournament-name" value="${esc(state.name)}" maxlength="40"></label>
      </div>
      <div class="fmt-rows">
        <div class="fmt-row fmt-row-2">
          <div class="box"><span class="box-label">Lig</span><div class="seg seg-box" role="group" aria-label="Lig devre sayısı">${rounds}</div></div>
          <div class="box"><span class="box-label">Playoff</span><div class="seg seg-box" role="group" aria-label="Playoff">
            <button data-action="set-playoff" data-value="1" aria-pressed="${s.playoffEnabled}" ${off}>Açık</button>
            <button data-action="set-playoff" data-value="0" aria-pressed="${!s.playoffEnabled}" ${off}>Kapalı</button>
          </div></div>
        </div>
        <div class="fmt-row fmt-row-steps">
          ${stepper('leagueMin', 'Lig maçı')}
          ${s.playoffEnabled ? stepper('playoffMin', 'Playoff maçı') : ''}
          ${stepper('finalMin', 'Final')}
          ${stepper('changeMin', 'Maç arası')}
          ${stepper('breakMin', 'Lig sonrası ara')}
        </div>
        <div class="fmt-row fmt-row-2">
          ${timeField('plannedStart', 'Başlangıç', 'Boşsa ilk maçın başladığı an')}
          ${timeField('pitchEnd', 'Saha bitişi', 'Aşılacaksa uyarı verir')}
        </div>
      </div>
      <div class="plan" id="plan-preview">${renderPlanBody()}</div>
    </section>`;
  }

  function renderPlanBody() {
    const st = previewState();
    const sc = T.schedule(st);
    const list = T.activeMatches(st);
    const spare = sc.pitchEnd == null ? null : minuteOf(sc.pitchEnd) - minuteOf(sc.plannedEnd);
    const fromNow = !state.started && !state.settings.plannedStart;
    const end = Math.max(sc.plannedEnd, sc.pitchEnd ?? 0);
    const span = Math.max(end - sc.start, MINUTE);
    const segs = [];
    let prevEnd = sc.start;
    let prev = null;
    let leagueNo = 0;
    list.forEach((m, i) => {
      const it = sc.items[i];
      const gap = it.plannedStart - prevEnd;
      if (gap > 0) {
        const kind = prev && prev.stage === 'league' && m.stage !== 'league' ? 'Lig sonrası ara' : 'Değişim';
        segs.push({ ms: gap, kind: 'gap', label: '', title: `${kind} · ${Math.round(gap / MINUTE)} dk` });
      }
      const label = m.stage === 'league' ? String(++leagueNo) : m.stage === 'playoff' ? 'PO' : 'Final';
      segs.push({
        ms: it.plannedEnd - it.plannedStart,
        kind: m.stage,
        label,
        title: `${matchTitle(m, st.matches)} · ${fmtTime(it.plannedStart)}–${fmtTime(it.plannedEnd)}`,
      });
      prevEnd = it.plannedEnd;
      prev = m;
    });
    if (spare > 0) segs.push({ ms: sc.pitchEnd - sc.plannedEnd, kind: 'spare', label: '', title: `Pay · ${spare} dk` });
    const bar = segs
      .map((s) => `<span class="pb-seg pb-${s.kind}" style="flex-grow:${(s.ms / MINUTE).toFixed(2)}" title="${esc(s.title)}">${s.label}</span>`)
      .join('');
    const limit =
      spare != null && spare < 0
        ? `<span class="pb-limit" style="left:${(((sc.pitchEnd - sc.start) / span) * 100).toFixed(2)}%" title="Saha bitişi ${fmtTime(sc.pitchEnd)}"></span>`
        : '';
    const badge =
      spare == null
        ? ''
        : spare < 0
          ? `<span class="badge badge-danger">Saha bitişini ${-spare} dk aşıyor</span>`
          : `<span class="badge badge-ok">${ICONS.check}Saha bitişine ${spare} dk pay</span>`;
    const aria = `Plan: ${fmtTime(sc.start)} ile ${fmtTime(sc.plannedEnd)} arası ${list.length} maç${spare == null ? '' : spare < 0 ? `, saha bitişini ${-spare} dakika aşıyor` : `, sonda ${spare} dakika pay`}`;
    return `<div class="plan-head">
        <span class="plan-range">${fmtTime(sc.start)} – ${fmtTime(sc.plannedEnd)} <span>· ${fmtDuration(sc.plannedEnd - sc.start)}</span></span>
        ${badge}
      </div>
      ${fromNow ? '<p class="plan-note">Başlangıç saati boş: şimdi başlarsanız böyle olur.</p>' : ''}
      <div class="plan-bar" role="img" aria-label="${aria}">${bar}${limit}</div>
      <div class="plan-ticks" aria-hidden="true">${planTicks(sc.start, end)}</div>`;
  }

  function planTicks(start, end) {
    const span = Math.max(end - start, MINUTE);
    const stepMin = span <= 3 * 60 * MINUTE ? 30 : 60;
    const d = new Date(start);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + ((stepMin - (d.getMinutes() % stepMin)) % stepMin));
    const ticks = [[start, 0]];
    for (let t = d.getTime(); t < end; t += stepMin * MINUTE) {
      const pos = (t - start) / span;
      if (pos > 0.08 && pos < 0.92) ticks.push([t, pos]);
    }
    ticks.push([end, 1]);
    return ticks.map(([t, pos]) => `<span style="left:${(pos * 100).toFixed(2)}%">${fmtTime(t)}</span>`).join('');
  }

  function refreshPlan() {
    const el = $('#plan-preview');
    if (el) el.innerHTML = renderPlanBody();
  }

  function renderReady() {
    if (state.started) {
      return `<div class="ready-strip">
        <div><strong>Turnuva sürüyor</strong><span>Süre değişiklikleri henüz başlamamış maçlara uygulanır.</span></div>
        <button class="btn btn-lime btn-lg" data-action="tab" data-tab="dashboard">Turnuvaya dön</button>
      </div>`;
    }
    const n = state.players.length;
    const drawn = state.teams.every((t) => t.playerIds.length);
    const title = n < 3 ? 'Önce oyuncuları ekleyin' : !drawn ? 'Sırada kura var' : 'Her şey hazır';
    const count = T.activeMatches(previewState()).length;
    return `<div class="ready-strip">
      <div><strong>${title}</strong><span>${n} oyuncu · ${state.teams.length} takım · ${count} maç</span></div>
      <button class="btn btn-lime btn-lg" data-action="start-tournament">${ICONS.play}Turnuvayı başlat</button>
    </div>`;
  }

  function renderScreen() {
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
    const full = !!document.fullscreenElement;
    return `<div class="tv">
      ${TV_LINES}
      <div class="tv-body">
        <header class="tv-head">
          <div class="tv-brand"><span class="tv-mark">${ICONS.ball}</span><span class="tv-brand-name">${esc(tournamentName())}</span></div>
          <div class="tv-status">${live ? `<span class="tag-live">Canlı</span><span class="tv-no">${matchLabel(live)}</span>` : ''}</div>
          <div class="tv-tools">
            ${sc && !champ ? `<span class="tv-end">Bitiş <strong>${fmtTime(sc.estEnd)}</strong></span>` : ''}
            ${state.started ? `<button class="tv-btn" data-action="screen-fixtures">${ICONS.list}Fikstür</button>` : ''}
            <button class="tv-btn tv-icon" data-action="toggle-fullscreen" aria-label="${full ? 'Tam ekrandan çık' : 'Tam ekran'}" title="${full ? 'Tam ekrandan çık' : 'Tam ekran'}">${full ? ICONS.compress : ICONS.expand}</button>
          </div>
        </header>
        ${body}
        ${next ? screenNext(next, est) : ''}
      </div>
      ${ui.screenFixtures && state.started ? screenFixtures(est) : ''}
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
    const scorers = (t) =>
      m.goals
        .filter((g) => g.team === t.id)
        .map((g) => {
          const p = player(g.playerId);
          return p ? `${esc(p.name)} ${goalMinute(g)}` : goalMinute(g);
        })
        .join(' · ');
    const side = (t, cls) => `<div class="tv-team ${cls}" style="${teamStyle(t)}">
        <span class="tv-name"><span class="sw"></span><span>${esc(t.name)}</span></span>
        <span class="tv-scorers">${scorers(t)}</span>
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

  function screenFixtures(est) {
    const groups = fixtureGroups(state)
      .map((g) => ({ ...g, matches: g.matches.filter((m) => m.stage !== 'playoff' || state.settings.playoffEnabled) }))
      .filter((g) => g.matches.length);
    return `<div class="tv-overlay" data-action="screen-fixtures"></div>
      <section class="tv-panel" role="dialog" aria-label="Fikstür">
        <div class="tv-panel-head"><h2 class="page-title">Fikstür</h2><button class="icon-btn icon-soft" data-action="screen-fixtures" aria-label="Kapat">${ICONS.x}</button></div>
        ${groups.map((g) => fixtureCard(g, state, est, { readonly: true, approx: false })).join('')}
      </section>`;
  }

  function renderDialog() {
    const el = $('#dialog');
    if (!dialog.kind) {
      if (el.open) el.close();
      el.innerHTML = '';
      return;
    }
    el.innerHTML = dialog.kind === 'confirm' ? confirmHtml() : editHtml();
    if (!el.open) el.showModal();
  }

  function confirmHtml() {
    const o = dialog.opts;
    return `<div class="dialog-body">
      <h2>${esc(o.title)}</h2>
      ${o.body ? `<p>${esc(o.body)}</p>` : ''}
      <div class="dialog-actions">
        <button class="btn" data-action="dialog-cancel">${esc(o.cancel || 'Vazgeç')}</button>
        <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-action="dialog-ok">${esc(o.ok || 'Tamam')}</button>
      </div>
    </div>`;
  }

  function editHtml() {
    const m = match(dialog.matchId);
    if (!m) return '';
    const s = T.score(m);
    const home = team(m.home);
    const away = team(m.away);
    const options = (selected) =>
      `<option value="">Bilinmiyor</option>${state.teams
        .map(
          (t) =>
            `<optgroup label="${esc(t.name)}">${t.playerIds
              .map(player)
              .filter(Boolean)
              .map((p) => `<option value="${p.id}"${selected === p.id ? ' selected' : ''}>${esc(p.name)}</option>`)
              .join('')}</optgroup>`,
        )
        .join('')}`;
    const side = (t, n) => `<div class="edit-side">
      ${teamName(t.id)}
      <div class="stepper">
        <button class="step-btn" data-action="goal-undo" data-match="${m.id}" data-team="${t.id}" ${n ? '' : 'disabled'} aria-label="${esc(t.name)}: gol sil">−</button>
        <span class="step-value">${n}</span>
        <button class="step-btn" data-action="goal-add" data-match="${m.id}" data-team="${t.id}" aria-label="${esc(t.name)}: gol ekle">+</button>
      </div>
    </div>`;
    const goals = m.goals
      .map(
        (g) => `<li style="${teamStyle(team(g.team))}">
          <span class="sw"></span>
          <span class="eg-min">${goalMinute(g) || '–'}</span>
          <span class="pot pot-wide"><select data-field="goal-scorer" data-match="${m.id}" data-goal="${g.id}" aria-label="Golü atan">${options(g.playerId)}</select>${ICONS.chevron}</span>
          <button class="icon-btn icon-ghost icon-sm" data-action="goal-remove" data-match="${m.id}" data-goal="${g.id}" aria-label="Golü sil" title="Golü sil">${ICONS.x}</button>
        </li>`,
      )
      .join('');
    const pens =
      m.stage !== 'league' && s.home === s.away
        ? `<div class="pens-edit">
            <span class="box-label">Berabere: penaltılar</span>
            <label>${esc(home.name)}<input class="input-num" type="number" min="0" max="30" data-field="edit-pens" data-side="home" value="${esc(dialog.pens.home)}"></label>
            <label>${esc(away.name)}<input class="input-num" type="number" min="0" max="30" data-field="edit-pens" data-side="away" value="${esc(dialog.pens.away)}"></label>
          </div>`
        : '';
    return `<div class="dialog-body">
      <h2>${matchTitle(m)} · sonucu düzenle</h2>
      <div class="edit-score">${side(home, s.home)}${side(away, s.away)}</div>
      ${goals ? `<ol class="edit-goals">${goals}</ol>` : ''}
      ${pens}
      ${dialog.error ? `<p class="form-error">${esc(dialog.error)}</p>` : ''}
      <div class="dialog-actions"><button class="btn btn-primary" data-action="edit-done">Tamam</button></div>
    </div>`;
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      dialog.kind = 'confirm';
      dialog.opts = opts;
      dialog.resolve = resolve;
      renderDialog();
    });
  }

  function closeDialog(result) {
    const resolve = dialog.resolve;
    Object.assign(dialog, { kind: null, opts: null, resolve: null, matchId: null, error: '' });
    renderDialog();
    if (resolve) resolve(result);
  }

  function dismissDialog() {
    if (dialog.kind === 'edit') actions['edit-done']();
    else closeDialog(false);
  }

  function closeMenus() {
    if (!ui.colorMenu && !ui.moveMenu) return false;
    ui.colorMenu = null;
    ui.moveMenu = null;
    for (const el of $$('.pop')) el.remove();
    for (const el of $$('[data-popover][aria-expanded="true"]')) {
      el.setAttribute('aria-expanded', 'false');
      el.classList.remove('is-open');
    }
    return true;
  }

  let toastTimer = null;
  function toast(message, kind = 'info') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast is-${kind} is-shown`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-shown'), 3500);
  }

  let audio = null;
  function ensureAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch {
      audio = null;
    }
  }

  function tone({ at, dur, freq, vol = 0.3, trill = 0 }, t0) {
    const start = t0 + at;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    if (trill) {
      const lfo = audio.createOscillator();
      const depth = audio.createGain();
      lfo.frequency.value = trill;
      depth.gain.value = freq * 0.06;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + dur + 0.05);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.setValueAtTime(vol, start + Math.max(0.03, dur - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function play(pattern) {
    // Yayın ekranı çoğu zaman aynı bilgisayarda açık; düdük iki kez çalmasın.
    if (!prefs.sound || isScreen()) return;
    ensureAudio();
    if (!audio) return;
    const t0 = audio.currentTime + 0.03;
    for (const p of pattern) tone(p, t0);
  }

  const WHISTLE = { freq: 2800, trill: 28, vol: 0.28 };
  const SOUND_START = [{ ...WHISTLE, at: 0, dur: 0.7 }];
  const SOUND_END = [
    { ...WHISTLE, at: 0, dur: 0.3 },
    { ...WHISTLE, at: 0.45, dur: 0.3 },
    { ...WHISTLE, at: 0.9, dur: 1.2 },
  ];
  const SOUND_LAST_MINUTE = [
    { at: 0, dur: 0.12, freq: 880, vol: 0.25 },
    { at: 0.2, dur: 0.12, freq: 880, vol: 0.25 },
  ];

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

  const lastRemaining = new Map();
  function tick() {
    const now = Date.now();
    const m = liveMatch();
    if (m) {
      const rem = T.remainingMs(state, m, now);
      const total = T.matchMinutes(state, m) * MINUTE;
      const running = m.runningSince != null;
      const prev = lastRemaining.get(m.id);
      if (prev != null && running) {
        if (prev > MINUTE && rem <= MINUTE && rem > 0) play(SOUND_LAST_MINUTE);
        if (prev > 0 && rem <= 0) play(SOUND_END);
      }
      lastRemaining.set(m.id, rem);
      const over = rem <= 0;
      $('.live-card')?.classList.toggle('is-over', over);
      for (const clock of $$('[data-clock]')) {
        clock.classList.toggle('is-over', over);
        clock.classList.toggle('is-last-minute', !over && rem <= MINUTE);
        clock.classList.toggle('is-paused', !running);
        const label = $('[data-timer-state]', clock);
        if (label) label.textContent = over ? 'Süre doldu' : running ? '' : 'Duraklatıldı';
      }
      for (const el of $$('[data-timer]')) el.textContent = fmtClock(rem);
      for (const el of $$('[data-timer-bar]')) el.style.width = `${clamp((1 - rem / total) * 100, 0, 100)}%`;
    }
    for (const el of $$('[data-until]')) {
      const left = Number(el.dataset.until) - now;
      el.textContent = left > 0 ? `${el.dataset.label}: ${fmtClock(left)}` : `${el.dataset.label} süresi doldu`;
      el.classList.toggle('is-over', left <= 0);
    }
  }

  function addPlayers(names) {
    const wanted = names.map((x) => x.trim()).filter(Boolean);
    let added = 0;
    commit(() => {
      added = T.addPlayers(state, wanted);
    });
    if (wanted.length > 1) toast(`${added} oyuncu eklendi${added < wanted.length ? ` (${wanted.length - added} isim zaten listedeydi)` : ''}`, 'ok');
    else if (!added) {
      const key = wanted[0].replace(/\s+/g, ' ').toLocaleLowerCase('tr');
      const existing = state.players.find((p) => p.name.toLocaleLowerCase('tr') === key);
      toast(`${existing ? existing.name : wanted[0]} zaten listede`, 'warn');
    }
    $('#new-player')?.focus();
  }

  function finishLive(m, pens) {
    commit(() => T.finishMatch(m, pens, Date.now()), { rerender: false });
    ui.finishing = false;
    ui.goalPicker = null;
    render();
    if (m.stage === 'final') toast(`Şampiyon: ${team(T.champion(state))?.name || ''}`, 'ok');
  }

  function openMenu(key, id) {
    const open = ui[key] === id ? null : id;
    ui.colorMenu = null;
    ui.moveMenu = null;
    ui[key] = open;
    render();
    if (open) $('.pop button:not([aria-disabled="true"])')?.focus();
  }

  const actions = {
    tab(el) {
      ui.tab = el.dataset.tab;
      ui.goalPicker = null;
      render();
      window.scrollTo(0, 0);
    },

    'toggle-sound'() {
      prefs.sound = !prefs.sound;
      savePrefs();
      if (prefs.sound) play(SOUND_START);
      renderChrome();
    },

    'toggle-theme'() {
      prefs.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
      savePrefs();
      applyTheme();
      renderChrome();
    },

    'toggle-fullscreen'() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    },

    'screen-fixtures'() {
      ui.screenFixtures = !ui.screenFixtures;
      render();
    },

    'scroll-to'(el) {
      document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    'fixture-filter'(el) {
      ui.fixtureFilter = el.dataset.value;
      render();
    },

    'player-add'() {
      const input = $('#new-player');
      if (!input || !input.value.trim()) return input?.focus();
      addPlayers([input.value]);
    },

    async 'player-remove'(el) {
      const p = player(el.dataset.id);
      if (!p) return;
      if (state.started) {
        const ok = await confirmDialog({
          title: `${p.name} silinsin mi?`,
          body: 'Turnuva başladı. Oyuncunun attığı goller skorda kalır ama gol krallığından çıkar.',
          ok: 'Sil',
          danger: true,
        });
        if (!ok) return;
      }
      commit(() => T.removePlayer(state, p.id));
    },

    async 'draw-teams'() {
      if (state.started) return;
      if (state.teams.some((t) => t.playerIds.length)) {
        const ok = await confirmDialog({ title: 'Kura yeniden çekilsin mi?', body: 'Mevcut takımlar dağıtılıp yeniden çekilecek.', ok: 'Yeniden çek' });
        if (!ok) return;
      }
      ui.revealDraw = true;
      commit(() => T.applyDraw(state));
      ui.revealDraw = false;
    },

    'color-menu'(el) {
      openMenu('colorMenu', el.dataset.team);
    },

    'move-menu'(el) {
      openMenu('moveMenu', el.dataset.id);
    },

    'move-player'(el) {
      ui.moveMenu = null;
      commit(() => T.movePlayer(state, el.dataset.id, el.dataset.team));
    },

    'team-color'(el) {
      const t = team(el.dataset.team);
      if (!t) return;
      ui.colorMenu = null;
      commit(() => {
        if (t.name === COLORS[t.color]?.plural) t.name = COLORS[el.dataset.color].plural;
        t.color = el.dataset.color;
      });
    },

    'setting-step'(el) {
      const key = el.dataset.key;
      const [lo, hi] = T.LIMITS[key];
      commit(() => (state.settings[key] = clamp(state.settings[key] + Number(el.dataset.delta), lo, hi)));
    },

    'setting-rounds'(el) {
      if (!state.started) commit(() => (state.settings.leagueRounds = Number(el.dataset.value)));
    },

    'set-playoff'(el) {
      if (!canTogglePlayoff()) return toast('Playoff başladıktan sonra değiştirilemez', 'warn');
      commit(() => (state.settings.playoffEnabled = el.dataset.value === '1'));
    },

    async 'disable-playoff'() {
      if (!canTogglePlayoff()) return;
      const ok = await confirmDialog({
        title: 'Playoff kaldırılsın mı?',
        body: 'Lig bitince final doğrudan lig 1.si ile 2.si arasında oynanır. İsterseniz fikstürden geri ekleyebilirsiniz.',
        ok: 'Kaldır',
      });
      if (ok) commit(() => (state.settings.playoffEnabled = false));
    },

    'clear-time'(el) {
      commit(() => (state.settings[el.dataset.key] = ''));
    },

    async 'start-tournament'() {
      if (state.teams.some((t) => !t.playerIds.length)) return toast('Önce kurayı çekin: her takımda en az bir oyuncu olmalı', 'warn');
      const unassigned = state.players.filter((p) => !T.teamOfPlayer(state, p.id)).length;
      if (unassigned) {
        const ok = await confirmDialog({ title: 'Takımsız oyuncu var', body: `${unassigned} oyuncu bir takıma atanmadı. Yine de başlansın mı?`, ok: 'Başlat' });
        if (!ok) return;
      }
      ui.tab = 'dashboard';
      commit(() => {
        state.matches = T.generateMatches(state.settings);
        state.started = true;
        state.lots = {};
      });
      window.scrollTo(0, 0);
    },

    'start-match'(el) {
      const m = match(el.dataset.id);
      if (!m || m.status !== 'pending') return;
      if (liveMatch()) return toast('Önce devam eden maçı bitirin', 'warn');
      if (!m.home || !m.away) return toast('Bu maçın takımları henüz belli değil', 'warn');
      if (m.stage !== 'league' && T.blockingTies(state).length) return toast('Önce puan durumundaki eşitliği çözün', 'warn');
      Object.assign(ui, { finishing: false, goalPicker: null, showAllScorers: false, tab: 'dashboard' });
      commit(() => T.startMatch(state, m, Date.now()));
      play(SOUND_START);
      window.scrollTo(0, 0);
    },

    'timer-toggle'() {
      const m = liveMatch();
      if (m) commit(() => T.toggleClock(m, Date.now()));
    },

    'timer-adjust'(el) {
      const m = liveMatch();
      if (m) commit(() => (m.durationMin = Math.max(1, T.matchMinutes(state, m) + Number(el.dataset.delta))));
    },

    'goal-add'(el) {
      const m = match(el.dataset.match) || liveMatch();
      if (!m) return;
      let goal;
      commit(() => (goal = T.addGoal(m, el.dataset.team, Date.now())), { rerender: false });
      if (m.status === 'live') Object.assign(ui, { goalPicker: goal.id, goalFresh: true, showAllScorers: false, finishing: false });
      render();
    },

    'goal-undo'(el) {
      const m = match(el.dataset.match) || liveMatch();
      if (!m) return;
      commit(
        () => {
          const removed = T.undoGoal(m, el.dataset.team);
          if (removed && removed.id === ui.goalPicker) ui.goalPicker = null;
        },
        { rerender: false },
      );
      ui.finishing = false;
      render();
    },

    'goal-remove'(el) {
      const m = match(el.dataset.match) || liveMatch();
      if (!m) return;
      if (ui.goalPicker === el.dataset.goal) ui.goalPicker = null;
      ui.finishing = false;
      commit(() => T.removeGoal(m, el.dataset.goal));
    },

    'scorer-pick'(el) {
      const m = liveMatch();
      const g = m?.goals.find((x) => x.id === el.dataset.goal);
      ui.goalPicker = null;
      if (g && el.dataset.player) commit(() => (g.playerId = el.dataset.player));
      else render();
    },

    'scorer-edit'(el) {
      const same = ui.goalPicker === el.dataset.goal;
      Object.assign(ui, { goalPicker: same ? null : el.dataset.goal, goalFresh: false, showAllScorers: false });
      render();
    },

    'scorer-more'() {
      ui.showAllScorers = true;
      render();
    },

    'picker-close'() {
      ui.goalPicker = null;
      render();
    },

    'finish-match'() {
      const m = liveMatch();
      if (!m) return;
      const s = T.score(m);
      if (m.stage !== 'league' && s.home === s.away) {
        ui.finishing = true;
        ui.goalPicker = null;
        render();
        $('#pens-home')?.focus();
        return;
      }
      finishLive(m, null);
    },

    'pens-confirm'() {
      const m = liveMatch();
      if (!m) return;
      const h = parseInt($('#pens-home').value, 10);
      const a = parseInt($('#pens-away').value, 10);
      const error = !(h >= 0 && a >= 0) ? 'İki takımın penaltı skorunu da girin.' : h === a ? 'Penaltılarda bir kazanan olmalı.' : '';
      if (error) {
        $('#pens-error').textContent = error;
        return;
      }
      finishLive(m, { home: h, away: a });
    },

    'finish-cancel'() {
      ui.finishing = false;
      render();
    },

    async 'cancel-match'() {
      const m = liveMatch();
      if (!m) return;
      const ok = await confirmDialog({
        title: 'Maç iptal edilsin mi?',
        body: 'Skor ve süre silinir, maç oynanmamış sayılır ve sıradaki maçlar arasına geri döner.',
        ok: 'İptal et',
        cancel: 'Devam et',
        danger: true,
      });
      if (!ok) return;
      Object.assign(ui, { finishing: false, goalPicker: null });
      commit(() => T.resetMatch(m));
    },

    'edit-match'(el) {
      const m = match(el.dataset.id);
      if (!m || !canEdit(m)) return;
      Object.assign(dialog, {
        kind: 'edit',
        matchId: m.id,
        error: '',
        pens: m.pens ? { home: String(m.pens.home), away: String(m.pens.away) } : { home: '', away: '' },
      });
      renderDialog();
    },

    'edit-done'() {
      const m = match(dialog.matchId);
      if (m && m.stage !== 'league') {
        const s = T.score(m);
        if (s.home === s.away) {
          const h = parseInt(dialog.pens.home, 10);
          const a = parseInt(dialog.pens.away, 10);
          if (!(h >= 0 && a >= 0) || h === a) {
            dialog.error = 'Berabere biten eleme maçında kazananı belirleyen penaltı skorunu girin.';
            renderDialog();
            return;
          }
          commit(() => (m.pens = { home: h, away: a }), { rerender: false });
        } else {
          commit(() => (m.pens = null), { rerender: false });
        }
      }
      closeDialog(true);
      render();
    },

    'lots-draw'() {
      const groups = T.computeStandings(state, { includeLive: false }).unresolved;
      commit(() => {
        for (const g of groups) for (const id of g) state.lots[id] = Math.random();
      });
      toast(`Kura sonucu: ${T.computeStandings(state).rows.map((r, i) => `${i + 1}. ${team(r.team).name}`).join(', ')}`, 'ok');
    },

    'lots-set'(el) {
      const group = T.blockingTies(state).find((g) => g.includes(el.dataset.first));
      if (!group) return;
      commit(() => {
        for (const id of group) state.lots[id] = id === el.dataset.first ? 0 : 1;
      });
    },

    export() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      a.href = URL.createObjectURL(blob);
      a.download = `turnuva-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    import() {
      $('#import-file').click();
    },

    async 'reset-results'() {
      const ok = await confirmDialog({
        title: 'Sonuçlar sıfırlansın mı?',
        body: 'Oynanan tüm maçlar, skorlar ve goller silinir. Oyuncular, takımlar ve ayarlar kalır.',
        ok: 'Sıfırla',
        danger: true,
      });
      if (!ok) return;
      Object.assign(ui, { tab: 'setup', finishing: false, goalPicker: null });
      commit(() => {
        state.matches = [];
        state.started = false;
        state.lots = {};
      });
    },

    async 'reset-all'() {
      const ok = await confirmDialog({
        title: 'Her şey silinsin mi?',
        body: 'Oyuncular, takımlar, ayarlar ve sonuçlar silinir. Bu geri alınamaz; önce yedek indirmek isteyebilirsiniz.',
        ok: 'Hepsini sil',
        danger: true,
      });
      if (!ok) return;
      state = T.createState();
      Object.assign(ui, { tab: 'setup', finishing: false, goalPicker: null });
      saveState();
      render();
    },

    'dialog-ok'() {
      closeDialog(true);
    },

    'dialog-cancel'() {
      closeDialog(false);
    },
  };

  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-popover]')) closeMenus();
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    ensureAudio();
    await fn(el, e);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    switch (el.dataset.field) {
      case 'player-name': {
        const p = player(el.dataset.id);
        if (!p) return;
        p.name = el.value;
        saveState();
        for (const n of $$(`[data-pname="${p.id}"]`)) n.textContent = el.value;
        break;
      }
      case 'team-name': {
        const t = team(el.dataset.team);
        if (!t) return;
        t.name = el.value;
        saveState();
        break;
      }
      case 'tournament-name':
        state.name = el.value;
        saveState();
        renderChrome();
        break;
      case 'setting-time':
        state.settings[el.dataset.key] = el.value;
        saveState();
        refreshPlan();
        break;
      case 'edit-pens':
        dialog.pens[el.dataset.side] = el.value;
        break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const field = el.dataset.field;
    if (field === 'player-name' || field === 'team-name') {
      const item = field === 'player-name' ? player(el.dataset.id) : team(el.dataset.team);
      if (item && !item.name.trim()) {
        item.name = field === 'player-name' ? 'İsimsiz' : 'Takım';
        el.value = item.name;
      } else if (item) {
        item.name = item.name.trim();
      }
      saveState();
    } else if (field === 'player-pot') {
      const p = player(el.dataset.id);
      if (p) commit(() => (p.pot = Number(el.value)));
    } else if (field === 'goal-scorer') {
      const g = match(el.dataset.match)?.goals.find((x) => x.id === el.dataset.goal);
      if (g) commit(() => (g.playerId = el.value || null));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.target.classList?.contains('pl-name')) {
      e.preventDefault();
      if (e.target.id === 'new-player') return actions['player-add']();
      const inputs = $$('.pl-input');
      (inputs[inputs.indexOf(e.target) + 1] || $('#new-player'))?.focus();
      return;
    }
    if (dialog.kind) return;
    if (e.key === 'Escape') {
      if (closeMenus()) return;
      if (isScreen() && ui.screenFixtures) {
        ui.screenFixtures = false;
        render();
        return;
      }
      if (ui.goalPicker) {
        ui.goalPicker = null;
        render();
        return;
      }
    }
    if (isScreen() || e.target.closest?.('input, textarea, select, button, [contenteditable]')) return;
    if (e.code === 'Space' && ui.tab === 'dashboard' && liveMatch()) {
      e.preventDefault();
      actions['timer-toggle']();
    }
  });

  document.addEventListener('paste', (e) => {
    if (e.target.id !== 'new-player') return;
    const text = e.clipboardData?.getData('text') || '';
    if (!/[\n\r]/.test(text)) return;
    e.preventDefault();
    addPlayers(text.split(/[\r\n]+/));
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      data = null;
    }
    if (!T.isValidState(data)) return toast('Bu dosya geçerli bir turnuva yedeği değil', 'warn');
    const ok = await confirmDialog({ title: 'Yedek yüklensin mi?', body: 'Mevcut turnuva verileri bu yedekle değiştirilecek.', ok: 'Yükle', danger: true });
    if (!ok) return;
    state = T.migrate(data);
    T.resolveKnockouts(state);
    Object.assign(ui, { tab: state.started ? 'dashboard' : 'setup', finishing: false, goalPicker: null });
    saveState();
    render();
    toast('Yedek yüklendi', 'ok');
  });

  const dialogEl = $('#dialog');
  dialogEl.addEventListener('cancel', (e) => {
    e.preventDefault();
    dismissDialog();
  });
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) dismissDialog();
  });

  // Yayın ekranı ve ikinci pencereler skoru localStorage üzerinden alır.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState();
    if (dialog.kind === 'edit' && !match(dialog.matchId)) closeDialog(false);
    if (ui.goalPicker && !liveMatch()?.goals.some((g) => g.id === ui.goalPicker)) ui.goalPicker = null;
    render();
  });

  window.addEventListener('hashchange', () => {
    ui.screenFixtures = false;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAwake(isScreen() || !!liveMatch());
      tick();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (isScreen()) render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!isScreen()) renderChrome();
  });

  function refreshView() {
    let html = null;
    if (isScreen()) html = renderScreen();
    else if (!state.started) return;
    else if (ui.tab === 'fixtures') html = renderFixtures();
    else if (ui.tab === 'dashboard') {
      const side = $('#dash-side');
      const next = side && renderSide();
      if (side && next !== sideHtml) {
        sideHtml = next;
        side.innerHTML = next;
      }
      return;
    }
    if (html != null && html !== viewHtml) {
      setView(html);
      tick();
    }
  }

  $('.brand-mark').innerHTML = ICONS.ball;
  $('.tool-screen').innerHTML = ICONS.tv;
  T.resolveKnockouts(state);
  render();
  setInterval(tick, 250);
  setInterval(refreshView, 5000);
})();
