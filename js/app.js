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

  const svg = (body) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  const ICONS = {
    ball: svg('<circle cx="12" cy="12" r="9.5"/><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 7.5V2.5M16 10.4l4.6-1.5M14.5 15.1l2.8 3.9M9.5 15.1l-2.8 3.9M8 10.4 3.4 8.9"/>'),
    soundOn: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
    soundOff: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    expand: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    compress: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
    pause: svg('<path d="M8 5v14M16 5v14"/>'),
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let storageWarned = false;
  let state = loadState();
  const prefs = loadPrefs();
  const ui = {
    tab: state.started ? 'dashboard' : 'setup',
    goalPicker: null,
    showAllScorers: false,
    finishing: false,
    revealDraw: false,
  };
  const dialog = { kind: null, opts: null, resolve: null, matchId: null, pens: { home: '', away: '' }, error: '' };

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

  function lastFinished() {
    return state.matches.filter((m) => m.status === 'done').sort((a, b) => b.endedAt - a.endedAt)[0] || null;
  }

  function inkFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return l > 0.6 ? '#15171a' : '#ffffff';
  }

  function teamStyle(t) {
    const hex = (COLORS[t?.color] || COLORS.red).hex;
    return `--team:${hex};--team-ink:${inkFor(hex)}`;
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

  function matchSub(m) {
    if (m.stage === 'league') return `Lig · ${m.round}. devre`;
    return m.stage === 'playoff' ? 'Kazanan finale çıkar' : 'Şampiyonluk maçı';
  }

  function placeholder(m, side) {
    if (m.stage === 'playoff') return side === 'home' ? 'Lig ikincisi' : 'Lig üçüncüsü';
    if (side === 'home') return 'Lig birincisi';
    return state.settings.playoffEnabled ? 'Playoff galibi' : 'Lig ikincisi';
  }

  function teamTag(id, m, side, winner) {
    const t = team(id);
    if (!t) return `<span class="tteam is-tbd">${m ? placeholder(m, side) : '?'}</span>`;
    return `<span class="tteam${winner === id ? ' is-winner' : ''}" style="${teamStyle(t)}"><span class="swatch"></span><span class="tname">${esc(t.name)}</span></span>`;
  }

  function restingHtml(m) {
    if (m.stage === 'league') {
      const id = T.TEAM_IDS.find((x) => x !== m.home && x !== m.away);
      return `Dinlenen: ${teamTag(id)}`;
    }
    if (m.stage === 'playoff') {
      const fin = findStage('final');
      return fin && fin.home ? `Finalde bekleyen: ${teamTag(fin.home)}` : 'Lig birincisi finalde bekler';
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

  function render() {
    applyTheme();
    renderChrome();
    const view = $('#view');
    if (ui.tab === 'dashboard') view.innerHTML = renderDashboard();
    else if (ui.tab === 'fixtures') view.innerHTML = renderFixtures();
    else view.innerHTML = renderSetup();
    renderDialog();
    tick();
    keepAwake(!!liveMatch());
  }

  function applyTheme() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
  }

  function effectiveTheme() {
    return prefs.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function renderChrome() {
    const name = state.name.trim() || 'Halı Saha Turnuvası';
    $('#brand-title').textContent = name;
    document.title = name;
    const live = !!liveMatch();
    for (const b of $$('.tab')) {
      const on = b.dataset.tab === ui.tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('has-live', b.dataset.tab === 'dashboard' && live && !on);
    }
    const tools = [
      ['toggle-sound', prefs.sound ? ICONS.soundOn : ICONS.soundOff, prefs.sound ? 'Sesi kapat' : 'Sesi aç'],
      ['toggle-theme', effectiveTheme() === 'dark' ? ICONS.sun : ICONS.moon, effectiveTheme() === 'dark' ? 'Açık tema' : 'Koyu tema'],
      ['toggle-fullscreen', document.fullscreenElement ? ICONS.compress : ICONS.expand, document.fullscreenElement ? 'Tam ekrandan çık' : 'Tam ekran'],
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
    const est = Object.fromEntries(T.schedule(state).items.map((i) => [i.id, i]));
    let main;
    if (live) main = renderLive(live);
    else if (champ) main = renderChampion(champ);
    else main = renderNext(est);
    return `<div class="dash">
      <div class="dash-main">
        ${main}
        <div class="dash-pair">${renderUpcoming(live, est)}${renderResults()}</div>
      </div>
      <aside class="dash-side">
        ${renderStandings()}
        <section class="card" id="schedule-card">${renderScheduleBody()}</section>
        ${renderScorers()}
      </aside>
    </div>`;
  }

  function renderNotStarted() {
    const n = state.players.length;
    const drawn = state.teams.every((t) => t.playerIds.length);
    return `<section class="card hero">
      <div class="hero-mark">${ICONS.ball}</div>
      <h1>Turnuva henüz başlamadı</h1>
      <p class="muted">Kurulumu tamamlayın. Ardından canlı skor, puan durumu ve zaman planı burada görünür.</p>
      <ol class="checklist">
        <li class="${n >= 3 ? 'is-done' : ''}">Oyuncuları ekleyin <span class="muted">${n} oyuncu</span></li>
        <li class="${drawn ? 'is-done' : ''}">Kurayı çekin</li>
        <li>Süreleri kontrol edip turnuvayı başlatın</li>
      </ol>
      <button class="btn btn-primary btn-lg" data-action="tab" data-tab="setup">Kuruluma git</button>
    </section>`;
  }

  function renderLive(m) {
    const s = T.score(m);
    const home = team(m.home);
    const away = team(m.away);
    const running = m.runningSince != null;
    const rest = restingHtml(m);
    return `<section class="card live-card">
      <header class="live-head">
        <div class="live-title"><span class="badge badge-live">Canlı</span><strong>${matchTitle(m)}</strong><span class="muted">${matchSub(m)}</span></div>
        ${rest ? `<span class="pill">${rest}</span>` : ''}
      </header>
      <div class="scoreboard">
        ${renderSide(m, home)}
        <div class="sb-score" aria-live="polite"><span>${s.home}</span><span class="sb-dash">–</span><span>${s.away}</span></div>
        ${renderSide(m, away)}
      </div>
      ${renderGoalPicker(m)}
      <div class="clock" data-clock>
        <div class="clock-time" data-timer></div>
        <div class="clock-state" data-timer-state></div>
        <div class="clock-bar"><span data-timer-bar></span></div>
        <div class="clock-controls">
          <button class="btn" data-action="timer-adjust" data-delta="-1" title="Süreyi 1 dakika kısalt">−1 dk</button>
          <button class="btn btn-primary btn-lg btn-clock" data-action="timer-toggle">${running ? `${ICONS.pause}Duraklat` : `${ICONS.play}Devam et`}</button>
          <button class="btn" data-action="timer-adjust" data-delta="1" title="Süreyi 1 dakika uzat">+1 dk</button>
        </div>
      </div>
      ${renderGoalLog(m)}
      ${ui.finishing ? renderPensForm(m) : ''}
      <footer class="live-foot">
        <button class="btn btn-ghost btn-sm" data-action="cancel-match">Maçı iptal et</button>
        ${ui.finishing ? '' : '<button class="btn btn-finish btn-lg" data-action="finish-match">Maçı bitir</button>'}
      </footer>
    </section>`;
  }

  function renderSide(m, t) {
    const count = m.goals.filter((g) => g.team === t.id).length;
    return `<div class="sb-team" style="${teamStyle(t)}">
      <div class="sb-name"><span class="swatch"></span><span>${esc(t.name)}</span></div>
      <div class="sb-actions">
        <button class="btn-goal" data-action="goal-add" data-team="${t.id}">+ Gol</button>
        <button class="btn-undo" data-action="goal-undo" data-team="${t.id}" ${count ? '' : 'disabled'} title="Son golü sil" aria-label="${esc(t.name)}: son golü sil">−</button>
      </div>
    </div>`;
  }

  function renderGoalPicker(m) {
    const g = ui.goalPicker && m.goals.find((x) => x.id === ui.goalPicker);
    if (!g) return '';
    const t = team(g.team);
    const chip = (p) =>
      `<button class="chip${g.playerId === p.id ? ' is-on' : ''}" data-action="scorer-pick" data-goal="${g.id}" data-player="${p.id}">${esc(p.name)}</button>`;
    const own = t.playerIds.map(player).filter(Boolean);
    const others = state.players.filter((p) => !t.playerIds.includes(p.id));
    return `<div class="picker" style="${teamStyle(t)}">
      <div class="picker-head"><span>${goalMinute(g) ? `${goalMinute(g)} ` : ''}<strong>${esc(t.name)}</strong> golü: kim attı?</span><span class="muted small">İsteğe bağlı</span></div>
      <div class="chips">
        ${own.map(chip).join('')}
        ${ui.showAllScorers ? others.map(chip).join('') : others.length ? '<button class="chip chip-ghost" data-action="scorer-more">Diğer…</button>' : ''}
      </div>
      <div class="picker-foot"><button class="btn btn-ghost btn-sm" data-action="scorer-pick" data-goal="${g.id}" data-player="">Geç</button></div>
    </div>`;
  }

  function renderGoalLog(m) {
    if (!m.goals.length) return '<p class="goal-log-empty muted">Henüz gol yok.</p>';
    let h = 0;
    let a = 0;
    const rows = m.goals.map((g) => {
      if (g.team === m.home) h++;
      else a++;
      const t = team(g.team);
      const p = player(g.playerId);
      return `<li style="${teamStyle(t)}">
        <span class="gl-min">${goalMinute(g)}</span>
        <span class="swatch"></span>
        <button class="gl-name${p ? '' : ' is-unknown'}" data-action="scorer-edit" data-goal="${g.id}">${p ? esc(p.name) : 'Golü atanı seç'}</button>
        <span class="gl-score">${h}–${a}</span>
        <button class="icon-btn icon-btn-sm" data-action="goal-remove" data-goal="${g.id}" title="Golü sil" aria-label="Golü sil">${ICONS.x}</button>
      </li>`;
    });
    return `<ol class="goal-log">${rows.join('')}</ol>`;
  }

  function renderPensForm(m) {
    const h = team(m.home);
    const a = team(m.away);
    return `<div class="pens">
      <strong>Maç berabere bitti: penaltı sonucunu girin</strong>
      <label style="${teamStyle(h)}"><span class="swatch"></span>${esc(h.name)}<input class="input input-num" id="pens-home" type="number" min="0" max="30" inputmode="numeric"></label>
      <label style="${teamStyle(a)}"><span class="swatch"></span>${esc(a.name)}<input class="input input-num" id="pens-away" type="number" min="0" max="30" inputmode="numeric"></label>
      <span class="pens-actions">
        <button class="btn btn-ghost" data-action="finish-cancel">Vazgeç</button>
        <button class="btn btn-primary" data-action="pens-confirm">Kaydet ve bitir</button>
      </span>
      <p class="form-error" id="pens-error" role="alert"></p>
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
    const rest = restingHtml(m);
    const side = (s) => {
      const t = team(m[s]);
      return t
        ? `<div class="next-team" style="${teamStyle(t)}"><span class="swatch"></span>${esc(t.name)}</div>`
        : `<div class="next-team is-tbd"><span class="swatch"></span>${placeholder(m, s)}</div>`;
    };
    return `<section class="card next-card">
      <div class="kicker">Sıradaki maç · ${matchTitle(m)}${m.stage === 'league' ? ` · ${m.round}. devre` : ''}</div>
      <div class="next-teams">${side('home')}<span class="vs">–</span>${side('away')}</div>
      <div class="next-meta">
        ${rest ? `<span class="pill">${rest}</span>` : ''}
        <span class="pill">${T.matchMinutes(state, m)} dk</span>
        ${est[m.id] && ready ? `<span class="pill">Tahmini başlama ${fmtTime(est[m.id].estStart)}</span>` : ''}
      </div>
      ${showGap ? `<div class="change" data-until="${last.endedAt + gapMin * MINUTE}" data-label="${isBreak ? 'Ara' : 'Değişim'}"></div>` : ''}
      ${blocking ? renderLotsAlert() : ''}
      <button class="btn btn-primary btn-lg" data-action="start-match" data-id="${m.id}" ${ready && !blocking ? '' : 'disabled'}>${ICONS.play}Maçı başlat</button>
    </section>`;
  }

  function renderLotsAlert() {
    const groups = T.blockingTies(state);
    const names = (g) => g.map((id) => `<strong>${esc(team(id).name)}</strong>`).join(' ve ');
    const pair = groups.length === 1 && groups[0].length === 2 ? groups[0] : null;
    return `<div class="alert alert-warn">
      <div>${groups.map(names).join('; ')} puan, averaj, attığı gol ve ikili maçlarda eşit. Sıralamayı penaltı ya da yazı-tura ile belirleyin.</div>
      <div class="btn-row">
        ${pair ? pair.map((id) => `<button class="btn btn-sm" data-action="lots-set" data-first="${id}">${esc(team(id).name)} üstte</button>`).join('') : ''}
        <button class="btn btn-sm" data-action="lots-draw">Rastgele kura çek</button>
      </div>
    </div>`;
  }

  function renderChampion(id) {
    const t = team(id);
    const fin = findStage('final');
    const s = T.score(fin);
    const { list } = T.topScorers(state);
    const best = list.filter((x) => x.goals === list[0]?.goals);
    return `<section class="card champion" style="${teamStyle(t)}">
      <div class="champion-trophy" aria-hidden="true">🏆</div>
      <div class="champion-kicker">Şampiyon</div>
      <div class="champion-name">${esc(t.name)}</div>
      <div class="champion-score">Final: ${esc(team(fin.home).name)} ${s.home}–${s.away} ${esc(team(fin.away).name)}${fin.pens ? ` (pen. ${fin.pens.home}–${fin.pens.away})` : ''}</div>
      <div class="champion-players">${t.playerIds.map(player).filter(Boolean).map((p) => `<span>${esc(p.name)}</span>`).join('')}</div>
      ${best.length ? `<div class="champion-extra">Gol kralı: ${best.map((b) => esc(b.name)).join(', ')} · ${best[0].goals} gol</div>` : ''}
    </section>`;
  }

  function renderUpcoming(live, est) {
    const pending = T.activeMatches(state).filter((m) => m.status === 'pending');
    const items = pending.slice(live ? 0 : 1, (live ? 0 : 1) + 4);
    if (!items.length) return '';
    return `<section class="card">
      <header class="card-head"><h2>Sonraki maçlar</h2><button class="link" data-action="tab" data-tab="fixtures">Tüm fikstür</button></header>
      <ol class="mlist">${items
        .map((m) => {
          const rest = restingHtml(m);
          return `<li>
            <span class="ml-time">${est[m.id] ? `~${fmtTime(est[m.id].estStart)}` : ''}</span>
            <span class="ml-teams">${teamTag(m.home, m, 'home')}<span class="muted">–</span>${teamTag(m.away, m, 'away')}</span>
            <span class="ml-sub">${matchTitle(m)}${rest ? ` · ${rest}` : ''}</span>
          </li>`;
        })
        .join('')}</ol>
    </section>`;
  }

  function renderResults() {
    const done = state.matches
      .filter((m) => m.status === 'done')
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, 4);
    if (!done.length) return '';
    return `<section class="card">
      <header class="card-head"><h2>Son sonuçlar</h2></header>
      <ol class="mlist">${done
        .map((m) => {
          const s = T.score(m);
          const w = T.winnerOf(m);
          return `<li>
            <span class="ml-time">${fmtTime(m.startedAt)}</span>
            <span class="ml-teams">${teamTag(m.home, m, 'home', w)}<span class="ml-score">${s.home}–${s.away}</span>${teamTag(m.away, m, 'away', w)}</span>
            <span class="ml-sub">${matchTitle(m)}${m.pens ? ` · Penaltılar ${m.pens.home}–${m.pens.away}` : ''}</span>
          </li>`;
        })
        .join('')}</ol>
    </section>`;
  }

  function renderStandings() {
    const { rows, unresolved } = T.computeStandings(state);
    const league = state.matches.filter((m) => m.stage === 'league');
    const played = league.filter((m) => m.status === 'done').length;
    const zones = state.settings.playoffEnabled ? ['final', 'playoff', 'playoff'] : ['final', 'final', 'out'];
    const tied = new Set(T.leagueDone(state) ? unresolved.flat() : []);
    return `<section class="card">
      <header class="card-head"><h2>Puan durumu</h2><span class="muted small">${T.leagueDone(state) ? 'Lig tamamlandı' : `${played}/${league.length} lig maçı`}</span></header>
      <div class="table-wrap"><table class="standings">
        <thead><tr>
          <th>#</th><th class="l">Takım</th><th title="Oynanan">O</th><th title="Galibiyet">G</th><th title="Beraberlik">B</th><th title="Mağlubiyet">M</th><th class="col-ay" title="Attığı–Yediği">A–Y</th><th title="Averaj">Av</th><th title="Puan">P</th>
        </tr></thead>
        <tbody>${rows
          .map((r, i) => {
            const t = team(r.team);
            return `<tr class="zone-${zones[i]}">
              <td class="pos">${i + 1}${tied.has(r.team) ? '<sup title="Eşitlik henüz çözülmedi">=</sup>' : ''}</td>
              <td class="l">
                <span class="st-team" style="${teamStyle(t)}"><span class="swatch"></span><span class="name">${esc(t.name)}</span>${r.live ? '<span class="badge badge-live badge-xs">Canlı</span>' : ''}</span>
                ${r.form.length ? `<span class="form">${r.form.slice(-5).map((f) => `<i class="f-${f}">${f}</i>`).join('')}</span>` : ''}
              </td>
              <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td class="col-ay">${r.gf}–${r.ga}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
      <div class="legend">${
        state.settings.playoffEnabled
          ? '<span style="--c:var(--final)">Finale direkt</span><span style="--c:var(--playoff)">Playoff</span>'
          : '<span style="--c:var(--final)">Final</span>'
      }<span>Eşitlikte: averaj → atılan gol → ikili maç</span></div>
    </section>`;
  }

  function renderScheduleBody() {
    const sc = T.schedule(state);
    const list = T.activeMatches(state);
    const done = list.filter((m) => m.status === 'done').length;
    const delay = minuteOf(sc.estEnd) - minuteOf(sc.plannedEnd);
    const delayText = delay === 0 ? 'Planda' : delay > 0 ? `${delay} dk geç` : `${-delay} dk erken`;
    const overMin = sc.pitchEnd == null ? 0 : minuteOf(sc.estEnd) - minuteOf(sc.pitchEnd);
    const over = overMin > 0 && done < list.length;
    const po = findStage('playoff');
    const canCut = over && sc.playoffSaving > 0 && state.settings.playoffEnabled && canTogglePlayoff();
    return `<header class="card-head"><h2>Zaman</h2><span class="muted small">${done}/${list.length} maç</span></header>
      <div class="stats">
        <div class="stat"><span class="stat-label">Tahmini bitiş</span><span class="stat-value">${fmtTime(sc.estEnd)}</span></div>
        <div class="stat"><span class="stat-label">Plana göre</span><span class="stat-value ${delay > 0 ? 'is-late' : delay < 0 ? 'is-early' : ''}">${delayText}</span></div>
        ${sc.pitchEnd ? `<div class="stat"><span class="stat-label">Saha bitişi</span><span class="stat-value">${fmtTime(sc.pitchEnd)}</span></div>` : ''}
      </div>
      <div class="progress"><span style="width:${list.length ? (done / list.length) * 100 : 0}%"></span></div>
      ${
        over
          ? `<div class="alert alert-warn"><div><strong>Süre yetmeyebilir:</strong> tahmini bitiş saha saatini ${overMin} dk aşıyor.${
              canCut ? ` Playoff kaldırılırsa tahmini bitiş ${fmtTime(sc.estEnd - sc.playoffSaving)} olur.` : ''
            }</div>${canCut && po ? '<div class="btn-row"><button class="btn btn-sm" data-action="disable-playoff">Playoff\'u kaldır</button></div>' : ''}</div>`
          : ''
      }`;
  }

  function refreshSchedule() {
    const card = $('#schedule-card');
    if (!card) return;
    const html = renderScheduleBody();
    if (card.innerHTML !== html) card.innerHTML = html;
  }

  function renderScorers() {
    const { list, anonymous } = T.topScorers(state);
    const rows = list.slice(0, 10).map((s, i) => {
      const t = team(s.team);
      const rank = 1 + list.filter((x) => x.goals > s.goals).length;
      const showRank = i === 0 || list[i - 1].goals !== s.goals;
      return `<li class="${rank === 1 ? 'is-leader' : ''}" style="${teamStyle(t)}">
        <span class="sc-rank">${showRank ? rank : ''}</span>
        <span class="swatch"></span>
        <span class="sc-name">${esc(s.name)}</span>
        <span class="sc-goals">${s.goals} <small>gol</small></span>
      </li>`;
    });
    return `<section class="card">
      <header class="card-head"><h2>Gol krallığı</h2>${anonymous ? `<span class="muted small">${anonymous} gol isimsiz</span>` : ''}</header>
      ${rows.length ? `<ol class="scorers">${rows.join('')}</ol>` : '<p class="empty">Gol eklerken golü atanı seçerseniz burada listelenir.</p>'}
    </section>`;
  }

  function renderFixtures() {
    const preview = !state.started;
    const st = previewState();
    const est = Object.fromEntries(T.schedule(st).items.map((i) => [i.id, i]));
    const groups = [];
    for (let r = 1; r <= Math.max(...st.matches.map((m) => m.round || 0)); r++) {
      groups.push({ title: `Lig · ${r}. devre`, matches: st.matches.filter((m) => m.stage === 'league' && m.round === r) });
    }
    groups.push({ title: 'Eleme', matches: st.matches.filter((m) => m.stage !== 'league') });
    const active = T.activeMatches(st);
    const done = active.filter((m) => m.status === 'done').length;
    return `<section class="card fixtures">
      <header class="card-head"><h2>Fikstür</h2><span class="muted small">${
        preview ? 'Önizleme: turnuva başlayınca skorlar burada görünür' : `${done}/${active.length} maç oynandı`
      }</span></header>
      ${groups
        .map((g) => `<h3 class="fx-group">${g.title}</h3><div class="fx-list">${g.matches.map((m) => fixtureRow(m, st, est[m.id], preview)).join('')}</div>`)
        .join('')}
    </section>`;
  }

  function fixtureRow(m, st, it, preview) {
    const skipped = m.stage === 'playoff' && !st.settings.playoffEnabled;
    const s = T.score(m);
    const w = T.winnerOf(m);
    let time = '';
    if (skipped) time = '—';
    else if (m.status === 'done') time = fmtTime(m.startedAt);
    else if (m.status === 'live') time = '<span class="badge badge-live">Canlı</span>';
    else if (it) time = `~${fmtTime(it.estStart)}`;
    const scoreHtml =
      m.status === 'pending' ? '<span class="muted">–</span>' : `${s.home}–${s.away}${m.pens ? `<small>pen. ${m.pens.home}–${m.pens.away}</small>` : ''}`;
    let action = '';
    if (!preview) {
      if (skipped) {
        action = canTogglePlayoff() ? '<button class="btn btn-sm" data-action="set-playoff" data-value="1">Geri ekle</button>' : '';
      } else if (m.status === 'live') {
        action = '<button class="btn btn-sm" data-action="tab" data-tab="dashboard">Canlıya git</button>';
      } else if (m.status === 'done') {
        action = canEdit(m) ? `<button class="btn btn-sm btn-ghost" data-action="edit-match" data-id="${m.id}">${ICONS.edit}Düzenle</button>` : '';
      } else {
        const start = !liveMatch() && m.home && m.away ? `<button class="btn btn-sm" data-action="start-match" data-id="${m.id}">Başlat</button>` : '';
        const drop = m.stage === 'playoff' && canTogglePlayoff() ? '<button class="btn btn-sm btn-ghost" data-action="disable-playoff">Kaldır</button>' : '';
        action = drop + start;
      }
    }
    const rest = skipped ? 'Kaldırıldı: final lig 1.si – 2.si' : restingHtml(m);
    return `<div class="fx-row is-${skipped ? 'skipped' : m.status}">
      <div class="fx-title">${matchTitle(m, st.matches)}</div>
      <div class="fx-time">${time}</div>
      <div class="fx-match">
        <span class="fx-home">${teamTag(m.home, m, 'home', w)}</span>
        <span class="fx-score">${scoreHtml}</span>
        <span class="fx-away">${teamTag(m.away, m, 'away', w)}</span>
      </div>
      <div class="fx-rest">${rest}</div>
      <div class="fx-actions">${action}</div>
    </div>`;
  }

  function renderSetup() {
    return `<div class="setup">
      <div class="setup-top">${renderPlayers()}${renderTeams()}</div>
      ${renderFormat()}
      ${renderData()}
    </div>`;
  }

  function renderPlayers() {
    const n = state.players.length;
    return `<section class="card">
      <header class="card-head"><h2><span class="step">1</span>Oyuncular</h2><span class="pill pill-count">${n} oyuncu</span></header>
      <p class="hint">${
        n
          ? '<strong>Torba</strong> isteğe bağlıdır. Benzer seviyedeki oyuncuları aynı torbaya koyun; kurada her takıma her torbadan birer kişi düşer, takımlar dengeli çıkar. Torbası boş (–) olanlar rastgele dağıtılır.'
          : 'İsmi yazıp Enter\'a basın; sıradaki satır kendiliğinden açılır. Alt alta yazılmış bir listeyi yapıştırırsanız hepsi birden eklenir.'
      }</p>
      <ol class="player-list">
        ${state.players.map(playerRow).join('')}
        <li class="player-row player-new">
          <span class="pl-no">${n + 1}</span>
          <input class="input pl-name" id="new-player" placeholder="Oyuncu adı" maxlength="40" autocomplete="off" enterkeyhint="next" aria-label="Yeni oyuncu adı">
          <button class="btn btn-primary btn-sm" data-action="player-add">Ekle</button>
        </li>
      </ol>
      ${teamSizes(n)}
      ${potSummary()}
    </section>`;
  }

  function playerRow(p, i) {
    const t = T.teamOfPlayer(state, p.id);
    return `<li class="player-row">
      <span class="pl-no">${i + 1}</span>
      <input class="input pl-name" data-field="player-name" data-id="${p.id}" value="${esc(p.name)}" maxlength="40" aria-label="Oyuncu adı">
      <span class="team-dot" ${t ? `style="${teamStyle(t)}" title="${esc(t.name)}"` : 'title="Takımsız"'}></span>
      <div class="pots" role="group" aria-label="Torba">${[0, 1, 2, 3, 4, 5]
        .map(
          (k) =>
            `<button class="pot${p.pot === k ? ' is-on' : ''}" data-action="player-pot" data-id="${p.id}" data-pot="${k}" aria-pressed="${p.pot === k}" title="${k ? `Torba ${k}` : 'Torba yok'}">${k || '–'}</button>`,
        )
        .join('')}</div>
      <button class="icon-btn icon-btn-sm" data-action="player-remove" data-id="${p.id}" title="Sil" aria-label="${esc(p.name)} sil">${ICONS.x}</button>
    </li>`;
  }

  function teamSizes(n) {
    if (n < 3) return '';
    const sizes = state.teams.map((_, i) => Math.floor(n / 3) + (i < n % 3 ? 1 : 0));
    return `<p class="team-sizes">${state.teams.length} takım: <strong>${sizes.join(' · ')}</strong> kişi</p>`;
  }

  function potSummary() {
    const counts = {};
    for (const p of state.players) if (p.pot) counts[p.pot] = (counts[p.pot] || 0) + 1;
    const keys = Object.keys(counts).sort();
    if (!keys.length) return '';
    const uneven = keys.some((k) => counts[k] % 3);
    return `<div class="pot-summary">
      ${keys.map((k) => `<span class="pill${counts[k] % 3 ? ' pill-warn' : ''}">Torba ${k}: ${counts[k]}</span>`).join('')}
      ${uneven ? '<span class="small muted">Her torbada 3 kişi (ya da 3\'ün katı) olursa kura tam dengeli olur.</span>' : ''}
    </div>`;
  }

  function renderTeams() {
    const unassigned = state.players.filter((p) => !T.teamOfPlayer(state, p.id));
    const hasTeams = state.teams.some((t) => t.playerIds.length);
    return `<section class="card">
      <header class="card-head"><h2><span class="step">2</span>Takımlar ve kura</h2>${
        state.started
          ? ''
          : `<button class="btn btn-primary" data-action="draw-teams" ${state.players.length < 3 ? 'disabled' : ''}>${hasTeams ? 'Yeniden çek' : 'Kurayı çek'}</button>`
      }</header>
      <p class="hint">${
        state.started
          ? 'Turnuva başladı. Gerekirse (ör. sakatlıkta) oyuncuyu renkli noktaya tıklayarak başka takıma taşıyabilirsiniz.'
          : 'Takım adını ve yelek rengini seçin. Kuradan sonra oyuncunun yanındaki renkli noktaya tıklayarak onu başka takıma taşıyabilirsiniz.'
      }</p>
      <div class="team-grid">${state.teams.map(teamCard).join('')}</div>
      ${
        unassigned.length && hasTeams
          ? `<div class="unassigned"><span class="field-label">Takımsız (${unassigned.length})</span><ul class="team-players">${unassigned.map((p, i) => teamPlayer(p, null, i, 0)).join('')}</ul></div>`
          : ''
      }
    </section>`;
  }

  function teamCard(t, teamIndex) {
    const players = t.playerIds.map(player).filter(Boolean);
    const clash = state.teams.some((o) => o !== t && o.color === t.color);
    return `<div class="team-card" style="${teamStyle(t)}">
      <div class="team-card-head"><input class="input team-name" data-field="team-name" data-team="${t.id}" value="${esc(t.name)}" maxlength="24" aria-label="Takım adı"></div>
      <div class="swatches" role="group" aria-label="Yelek rengi">${Object.entries(COLORS)
        .map(
          ([key, c]) =>
            `<button class="swatch-btn${t.color === key ? ' is-on' : ''}" style="--sw:${c.hex}" data-action="team-color" data-team="${t.id}" data-color="${key}" title="${c.label}" aria-label="${c.label}" aria-pressed="${t.color === key}"></button>`,
        )
        .join('')}</div>
      ${clash ? '<p class="team-warn">Başka bir takım da bu renkte.</p>' : ''}
      <ol class="team-players">${players.map((p, i) => teamPlayer(p, t, i, teamIndex)).join('') || '<li class="empty">Kura bekleniyor</li>'}</ol>
      <div class="team-foot">${players.length} oyuncu</div>
    </div>`;
  }

  function teamPlayer(p, t, i, teamIndex) {
    const others = state.teams.filter((x) => x !== t);
    return `<li class="${ui.revealDraw ? 'reveal' : ''}" style="--i:${i * 3 + teamIndex}">
      <span class="tp-name" data-pname="${p.id}">${esc(p.name)}</span>
      ${p.pot ? `<span class="tp-pot">T${p.pot}</span>` : ''}
      <span class="move">${others
        .map(
          (o) =>
            `<button class="move-dot" style="${teamStyle(o)}" data-action="move-player" data-id="${p.id}" data-team="${o.id}" title="${esc(o.name)} takımına taşı" aria-label="${esc(p.name)}: ${esc(o.name)} takımına taşı"></button>`,
        )
        .join('')}</span>
    </li>`;
  }

  function stepper(key, label, hint = '') {
    const [lo, hi] = T.LIMITS[key];
    const v = state.settings[key];
    return `<div class="field">
      <span class="field-label">${label}${hint ? `<small>${hint}</small>` : ''}</span>
      <div class="stepper">
        <button class="step-btn" data-action="setting-step" data-key="${key}" data-delta="-1" ${v <= lo ? 'disabled' : ''} aria-label="${label}: azalt">−</button>
        <span class="step-value">${v} <small>dk</small></span>
        <button class="step-btn" data-action="setting-step" data-key="${key}" data-delta="1" ${v >= hi ? 'disabled' : ''} aria-label="${label}: artır">+</button>
      </div>
    </div>`;
  }

  function timeField(key, label, hint) {
    return `<div class="field">
      <span class="field-label">${label}<small>${hint}</small></span>
      <span class="time-wrap">
        <input class="input input-time" type="time" data-field="setting-time" data-key="${key}" value="${esc(state.settings[key])}" aria-label="${label}">
        <button class="icon-btn icon-btn-sm" data-action="clear-time" data-key="${key}" title="Temizle" aria-label="${label}: temizle">${ICONS.x}</button>
      </span>
    </div>`;
  }

  function renderFormat() {
    const s = state.settings;
    const togglable = canTogglePlayoff();
    return `<section class="card">
      <header class="card-head"><h2><span class="step">3</span>Format ve süreler</h2></header>
      <div class="format-grid">
        <div class="fields">
          <label class="field field-name"><span class="field-label">Turnuva adı</span><input class="input" data-field="tournament-name" value="${esc(state.name)}" maxlength="40"></label>
          <div class="field">
            <span class="field-label">Lig<small>Her takım ${s.leagueRounds * 2} maç oynar</small></span>
            <div class="seg">${[1, 2, 3]
              .map((r) => `<button data-action="setting-rounds" data-value="${r}" class="${s.leagueRounds === r ? 'is-on' : ''}" ${state.started ? 'disabled' : ''}>${r} devre</button>`)
              .join('')}</div>
          </div>
          ${stepper('leagueMin', 'Lig maçı')}
          <div class="field">
            <span class="field-label">Playoff<small>Lig 2.si – 3.sü, kazanan finale çıkar</small></span>
            <div class="seg">
              <button data-action="set-playoff" data-value="1" class="${s.playoffEnabled ? 'is-on' : ''}" ${togglable ? '' : 'disabled'}>Açık</button>
              <button data-action="set-playoff" data-value="0" class="${s.playoffEnabled ? '' : 'is-on'}" ${togglable ? '' : 'disabled'}>Kapalı</button>
            </div>
          </div>
          ${s.playoffEnabled ? stepper('playoffMin', 'Playoff maçı') : ''}
          ${stepper('finalMin', 'Final')}
          ${stepper('changeMin', 'Maç arası değişim')}
          ${stepper('breakMin', 'Lig sonrası ara')}
          ${timeField('plannedStart', 'Başlangıç saati', 'Boşsa ilk maçın başladığı an')}
          ${timeField('pitchEnd', 'Saha bitiş saati', 'Aşılacaksa uyarı verir')}
        </div>
        <div class="plan" id="plan-preview">${renderPlanBody()}</div>
      </div>
      <footer class="setup-foot">${
        state.started
          ? '<span class="muted">Turnuva sürüyor. Süre değişiklikleri henüz başlamamış maçlara uygulanır.</span><button class="btn" data-action="tab" data-tab="dashboard">Tabloya git</button>'
          : '<span class="muted">Başlatınca fikstür oluşur. Süreleri sonradan da değiştirebilirsiniz.</span><button class="btn btn-primary btn-lg" data-action="start-tournament">Turnuvayı başlat</button>'
      }</footer>
    </section>`;
  }

  function renderPlanBody() {
    const st = previewState();
    const sc = T.schedule(st);
    const list = T.activeMatches(st);
    const [minPlay, maxPlay] = T.playTimeRange(state.settings);
    const spare = sc.pitchEnd == null ? null : minuteOf(sc.pitchEnd) - minuteOf(sc.plannedEnd);
    const fromNow = !state.started && !state.settings.plannedStart;
    return `<h3>Plan${fromNow ? ' <span class="muted small">(şimdi başlarsanız)</span>' : ''}</h3>
      <div class="stats">
        <div class="stat"><span class="stat-label">Toplam süre</span><span class="stat-value">${fmtDuration(sc.plannedEnd - sc.start)}</span></div>
        <div class="stat"><span class="stat-label">Saat</span><span class="stat-value">${fmtTime(sc.start)}–${fmtTime(sc.plannedEnd)}</span></div>
        <div class="stat"><span class="stat-label">Takım başı oyun</span><span class="stat-value">${minPlay}–${maxPlay} dk</span></div>
      </div>
      ${
        spare == null
          ? ''
          : spare < 0
            ? `<div class="alert alert-warn"><div><strong>Plan, saha bitişini ${-spare} dk aşıyor.</strong> Maç sürelerini kısaltın ya da playoff'u kapatın.</div></div>`
            : `<div class="alert alert-ok"><div>Saha bitişine <strong>${spare} dk</strong> pay kalıyor (penaltı, uzayan değişimler için).</div></div>`
      }
      <ol class="timeline">${list
        .map((m) => {
          const it = sc.items.find((x) => x.id === m.id);
          return `<li class="tl-${m.stage}">
            <span class="tl-time">${fmtTime(it.plannedStart)}</span>
            <span class="tl-title">${matchTitle(m, st.matches)}</span>
            <span class="tl-teams">${teamTag(m.home, m, 'home')}<span class="muted">–</span>${teamTag(m.away, m, 'away')}</span>
            <span class="tl-dur">${T.matchMinutes(st, m)} dk</span>
          </li>`;
        })
        .join('')}</ol>`;
  }

  function refreshPlan() {
    const el = $('#plan-preview');
    if (el) el.innerHTML = renderPlanBody();
  }

  function renderData() {
    return `<section class="card">
      <header class="card-head"><h2>Veri</h2></header>
      <p class="hint">Her değişiklik bu tarayıcıya otomatik kaydedilir; sayfayı kapatıp açsanız da kaldığınız yerden devam eder. Yine de turnuva öncesinde ve sonrasında yedek almak iyi olur.</p>
      <div class="btn-row">
        <button class="btn" data-action="export">Yedek indir</button>
        <button class="btn" data-action="import">Yedek yükle</button>
        <span class="spacer"></span>
        <button class="btn btn-danger-ghost" data-action="reset-results" ${state.started ? '' : 'disabled'}>Sonuçları sıfırla</button>
        <button class="btn btn-danger-ghost" data-action="reset-all">Her şeyi sil</button>
      </div>
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
        <button class="btn btn-ghost" data-action="dialog-cancel">${esc(o.cancel || 'Vazgeç')}</button>
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
    const side = (t, n) => `<div class="edit-side" style="${teamStyle(t)}">
      <span class="tteam"><span class="swatch"></span>${esc(t.name)}</span>
      <div class="stepper">
        <button class="step-btn" data-action="goal-undo" data-match="${m.id}" data-team="${t.id}" ${n ? '' : 'disabled'} aria-label="${esc(t.name)}: gol sil">−</button>
        <span class="step-value big">${n}</span>
        <button class="step-btn" data-action="goal-add" data-match="${m.id}" data-team="${t.id}" aria-label="${esc(t.name)}: gol ekle">+</button>
      </div>
    </div>`;
    return `<div class="dialog-body">
      <h2>${matchTitle(m)} · sonucu düzenle</h2>
      <div class="edit-score">${side(home, s.home)}${side(away, s.away)}</div>
      ${
        m.goals.length
          ? `<ol class="edit-goals">${m.goals
              .map((g) => {
                const t = team(g.team);
                return `<li style="${teamStyle(t)}">
                  <span class="swatch"></span>
                  <span class="gl-min">${goalMinute(g) || '–'}</span>
                  <select class="input" data-field="goal-scorer" data-match="${m.id}" data-goal="${g.id}" aria-label="Golü atan">${options(g.playerId)}</select>
                  <button class="icon-btn icon-btn-sm" data-action="goal-remove" data-match="${m.id}" data-goal="${g.id}" aria-label="Golü sil">${ICONS.x}</button>
                </li>`;
              })
              .join('')}</ol>`
          : ''
      }
      ${
        m.stage !== 'league' && s.home === s.away
          ? `<div class="pens-edit">
              <span class="field-label">Berabere: penaltılar</span>
              <label>${esc(home.name)}<input class="input input-num" type="number" min="0" max="30" data-field="edit-pens" data-side="home" value="${esc(dialog.pens.home)}"></label>
              <label>${esc(away.name)}<input class="input input-num" type="number" min="0" max="30" data-field="edit-pens" data-side="away" value="${esc(dialog.pens.away)}"></label>
            </div>`
          : ''
      }
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
    if (!prefs.sound) return;
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
        $('[data-timer]', clock).textContent = fmtClock(rem);
        $('[data-timer-bar]', clock).style.width = `${clamp((1 - rem / total) * 100, 0, 100)}%`;
        $('[data-timer-state]', clock).textContent = over ? 'Süre doldu' : running ? `${T.matchMinutes(state, m)} dakikalık maç` : 'Duraklatıldı';
      }
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

    'player-pot'(el) {
      const p = player(el.dataset.id);
      if (p) commit(() => (p.pot = Number(el.dataset.pot)));
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

    'move-player'(el) {
      commit(() => T.movePlayer(state, el.dataset.id, el.dataset.team));
    },

    'team-color'(el) {
      const t = team(el.dataset.team);
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
      if (m.status === 'live') Object.assign(ui, { goalPicker: goal.id, showAllScorers: false, finishing: false });
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
      ui.goalPicker = el.dataset.goal;
      ui.showAllScorers = false;
      render();
    },

    'scorer-more'() {
      ui.showAllScorers = true;
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
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
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
        refreshPlan();
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
    if (el.dataset.field === 'player-name' || el.dataset.field === 'team-name') {
      const item = el.dataset.field === 'player-name' ? player(el.dataset.id) : team(el.dataset.team);
      if (item && !item.name.trim()) {
        item.name = el.dataset.field === 'player-name' ? 'İsimsiz' : 'Takım';
        el.value = item.name;
      } else if (item) {
        item.name = item.name.trim();
      }
      saveState();
    } else if (el.dataset.field === 'goal-scorer') {
      const g = match(el.dataset.match)?.goals.find((x) => x.id === el.dataset.goal);
      if (g) commit(() => (g.playerId = el.value || null));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.target.classList?.contains('pl-name')) {
      e.preventDefault();
      if (e.target.id === 'new-player') return actions['player-add']();
      const inputs = $$('.pl-name');
      inputs[inputs.indexOf(e.target) + 1]?.focus();
      return;
    }
    if (dialog.kind || e.target.closest('input, textarea, select, button, [contenteditable]')) return;
    if (e.code === 'Space' && ui.tab === 'dashboard' && liveMatch()) {
      e.preventDefault();
      actions['timer-toggle']();
    } else if (e.key === 'Escape' && ui.goalPicker) {
      ui.goalPicker = null;
      render();
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

  // İkinci bir pencerede (ör. projektör) açık olan tablo da güncel kalsın.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState();
    if (dialog.kind === 'edit' && !match(dialog.matchId)) closeDialog(false);
    if (ui.goalPicker && !liveMatch()?.goals.some((g) => g.id === ui.goalPicker)) ui.goalPicker = null;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAwake(!!liveMatch());
      tick();
    }
  });
  document.addEventListener('fullscreenchange', renderChrome);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderChrome);

  $('.brand-mark').innerHTML = ICONS.ball;
  T.resolveKnockouts(state);
  render();
  setInterval(tick, 250);
  setInterval(() => {
    if (ui.tab === 'dashboard' && state.started) refreshSchedule();
  }, 5000);
})();
