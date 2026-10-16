(() => {
  'use strict';

  const T = window.Tournament;
  const STORAGE_KEY = 'halisaha-turnuva';
  const PREFS_KEY = 'halisaha-turnuva-prefs';
  const MINUTE = T.MINUTE;

  const { COLORS, ICONS, esc, clamp, teamStyle, swatch, fmtClock, fmtTime, goalMinute, keepAwake } = Views;

  const PITCH_LINES =
    '<svg class="pitch-lines wide-only" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><line x1="400" y1="0" x2="400" y2="520"/><circle cx="400" cy="260" r="86"/><circle class="spot" cx="400" cy="260" r="4"/><rect x="-2" y="150" width="96" height="220"/><rect x="706" y="150" width="96" height="220"/></svg>' +
    '<svg class="pitch-lines narrow-only" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><line x1="0" y1="280" x2="400" y2="280"/><circle cx="200" cy="280" r="70"/><rect x="110" y="-2" width="180" height="80"/><rect x="110" y="482" width="180" height="80"/></svg>';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const isScreen = () => location.hash === '#ekran';
  // iPhone'da push yalnız ana ekrana eklenmiş uygulamada var.
  const needsInstall = navigator.standalone === false;

  let storageWarned = false;
  let state = loadState();
  let live = null;
  const prefs = loadPrefs();
  const ui = {
    tab: state.started ? 'dashboard' : 'setup',
    goalPicker: null,
    showAllScorers: false,
    finishing: false,
    revealDraw: false,
    fixtureFilter: 'all',
    colorMenu: null,
    moveMenu: null,
    sheet: false,
    sheetMatch: null,
    poolOpen: true,
    scorersOpen: false,
    rulesOpen: false,
  };
  const dialog = { kind: null, opts: null, resolve: null, matchId: null, pens: { home: '', away: '' }, error: '' };
  const alerts = { id: null, key: null, reg: null, on: false, busy: false };
  let viewHtml = '';
  let sideHtml = '';

  const WIDE = matchMedia(Views.WIDE_QUERY);

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        try {
          if (parsed.version !== 2 && !localStorage.getItem('halisaha-turnuva-ilk-yedek')) localStorage.setItem('halisaha-turnuva-ilk-yedek', raw);
        } catch (err) { console.warn('İlk sürüm yedeği yazılamadı', err); }
        return T.migrate(parsed);
      }
    } catch (err) {
      console.warn('Kayıt okunamadı', err);
    }
    return T.createState();
  }

  function saveState({ sync = true } = {}) {
    T.syncPool(state);
    if (state.archives.some((t) => t.id === state.id)) T.archiveTournament(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Kayıt yazılamadı', err);
      if (!storageWarned) toast('Tarayıcı kayda izin vermiyor: sayfa kapanırsa veriler kaybolur. Yedek indirin.', 'warn');
      storageWarned = true;
    }
    if (sync) live?.changed();
  }

  function loadPrefs() {
    const base = { sound: true, theme: null, alerts: null };
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

  const V = Views.create(() => state);
  const showSheet = Views.sheetView($('#sheet'), {
    returnFocus: '[data-action="screen-fixtures"]',
    onDismiss: () => Object.assign(ui, { sheet: false, sheetMatch: null }),
  });
  const { team, player, liveMatch, nextMatch, findStage, estimates, tournamentName, lastFinished } = V;
  const { matchTitle, matchLabel, placeholder, teamName, lastResult, championData, renderStandings, fixtureGroups } = V;
  const match = (id) => state.matches.find((m) => m.id === id) || null;

  function fmtDuration(ms) {
    const total = Math.round(ms / MINUTE);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `${h} sa${m ? ` ${m} dk` : ''}` : `${m} dk`;
  }

  const minuteOf = (ts) => Math.floor(ts / MINUTE);

  function restingHtml(m) {
    const tag = (label, t) => `${label} ${swatch(t, { own: true })}<strong>${esc(t.name)}</strong>`;
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
    if (!T.hasFinal(state.settings)) return false;
    if (!state.started) return true;
    return findStage('playoff')?.status === 'pending' && findStage('final')?.status === 'pending';
  }

  function canToggleFinal() {
    if (!state.started) return true;
    return findStage('final')?.status === 'pending' && (!T.hasPlayoff(state.settings) || findStage('playoff')?.status === 'pending');
  }

  function announceChampion(before) {
    const id = T.champion(state);
    if (id && id !== before) toast(`Şampiyon: ${team(id)?.name || ''}`, 'ok');
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
    document.body.classList.toggle('is-wide', screen && WIDE.matches);
    if (screen) {
      document.title = `${tournamentName()} · Yayın`;
      $('#view').className = 'screen';
      setView(renderScreen());
    } else {
      renderChrome();
      $('#view').className = `view view-${ui.tab}${readOnly() ? ' is-readonly' : ''}`;
      if (ui.tab === 'dashboard') setView(renderDashboard());
      else if (ui.tab === 'fixtures') setView(renderFixtures());
      else if (ui.tab === 'history') setView(HistoryViews.render(state, ui));
      else setView(renderSetup());
    }
    renderSheet();
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
    renderLiveChrome();
  }

  const liveStatus = () => live?.status() ?? { mode: 'off' };
  const readOnly = () => liveStatus().mode === 'follower';
  const liveAvailable = () => /^https?:$/.test(location.protocol);
  // iPhone'da ana ekrana eklenen uygulama Safari'nin kayıtlarını görmez; yayın orada boş görünür.
  const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  const READONLY_ACTIONS = new Set([
    'tab',
    'toggle-sound',
    'toggle-theme',
    'toggle-fullscreen',
    'screen-fixtures',
    'sheet-close',
    'scorers-toggle',
    'rules-toggle',
    'scroll-to',
    'fixture-filter',
    'export',
    'picker-close',
    'dialog-ok',
    'dialog-cancel',
    'live-open',
    'live-copy',
    'live-share',
    'live-stop',
    'live-takeover',
    'alerts-toggle',
    'match',
    'sheet-back',
    'history-player',
    'history-tournament',
    'history-back',
    'history-match',
  ]);

  function liveLinks() {
    const c = live?.config;
    if (!c) return null;
    return { viewer: `${location.origin}/izle#${c.id}`, admin: `${location.origin}/#yonet/${c.id}.${c.token}` };
  }

  function liveLabel(s) {
    if (s.mode === 'error') return ['error', 'Yayın hatası'];
    if (s.mode === 'follower') return ['follower', 'Salt okunur'];
    if (s.offline) return ['offline', s.pending ? `Çevrimdışı · ${s.pending} değişiklik bekliyor` : 'Çevrimdışı'];
    if (s.connecting) return ['connecting', 'Bağlanıyor…'];
    return ['on', 'Yayında'];
  }

  function liveErrorText(error) {
    if (error === 'upgrade_required') return 'Geçmişi korumak için sayfayı yenileyip güncel sürüme geçin.';
    if (error === 'too_large') return 'Arşiv gönderim sınırına ulaştı. Tüm verileri Yedek → İndir ile kaydedin.';
    if (error === 'unauthorized' || error === 'not_found') return 'Yayın bulunamadı ya da yönetici linki geçersiz.';
    if (error === 'too_large') return 'Turnuva verisi yayın için fazla büyük.';
    return 'Sunucu değişikliği kabul etmedi.';
  }

  let liveBarHtml = '';
  let liveCardHtml = '';

  function renderLiveChrome() {
    const s = liveStatus();
    const pill = $('#live-pill');
    pill.hidden = s.mode === 'off';
    if (!pill.hidden) {
      const [kind, label] = liveLabel(s);
      const count = s.mode === 'admin' && s.offline && s.pending ? `<span class="live-pill-count narrow-only">${s.pending}</span>` : '';
      pill.className = `live-pill is-${kind}`;
      pill.innerHTML = `<span class="live-pill-dot"></span><span class="live-pill-text wide-only">${label}</span>${count}`;
      pill.title = `Canlı yayın: ${label}`;
      pill.setAttribute('aria-label', pill.title);
    }

    let bar = '';
    if (s.mode === 'follower') {
      bar = `<div class="live-bar-in">
        <span class="live-bar-icon">${ICONS.lock}</span>
        <p><strong>Yönetim başka bir cihazda.</strong> <span>Bu ekran salt okunur, skoru o cihaz giriyor.</span></p>
        <button class="btn btn-sm btn-primary" data-action="live-takeover">Devral</button>
      </div>`;
    } else if (s.mode === 'error') {
      bar = `<div class="live-bar-in is-error">
        <span class="live-bar-icon">${ICONS.broadcast}</span>
        <p><strong>Canlı yayına gönderilemiyor.</strong> <span>${liveErrorText(s.error)}</span></p>
        <button class="btn btn-sm" data-action="live-stop">Bu cihazda kapat</button>
      </div>`;
    }
    const watch = s.mode === 'admin' || s.mode === 'follower';
    const screen = $('.tool-screen');
    screen.setAttribute('href', watch ? liveLinks().viewer : '#ekran');
    screen.title = watch ? 'İzleyici sayfası (TV / projektör)' : 'Yayın ekranı (TV / projektör)';
    screen.setAttribute('aria-label', watch ? 'İzleyici sayfasını yeni pencerede aç' : 'Yayın ekranını yeni pencerede aç');

    const barEl = $('#live-bar');
    barEl.hidden = !bar;
    if (bar !== liveBarHtml) barEl.innerHTML = liveBarHtml = bar;
    $('#view').classList.toggle('is-readonly', s.mode === 'follower');
  }

  function renderLiveCard() {
    const s = liveStatus();
    const [kind, label] = liveLabel(s);
    const head = `<div class="sc-head"><h2 class="card-title" id="h-live">Canlı yayın</h2>${s.mode === 'off' ? '' : `<span class="live-state is-${kind}">${label}</span>`}</div>`;
    let body;
    if (!liveAvailable() || !live) {
      body = '<p class="sc-hint">Canlı yayın, uygulama internetteki adresinden açıldığında kullanılabilir.</p>';
    } else if (s.mode === 'off') {
      body = `<p class="sc-hint">İzleyiciler skoru tek bir linkle kendi telefonlarından ya da TV'den canlı izler. Skoru bu cihaz girer.</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="live-start">${ICONS.broadcast}Yayını başlat</button></div>
        <details class="live-join"${installed() ? ' open' : ''}>
          <summary>Başka cihazda başlatılan yayına bağlan</summary>
          <p class="sc-hint">Yayını daha önce tarayıcıda ya da başka bir cihazda başlattıysan burada yeniden başlatma, izleyici linki değişir. Onun yerine yönetici linkini yapıştır: Kurulum → Canlı yayın → Yönetici linki → Kopyala.</p>
          <div class="live-join-row">
            <input class="input-pill" id="live-join-link" type="url" placeholder="Yönetici linki" autocomplete="off" aria-label="Yönetici linki">
            <button class="btn btn-sm" data-action="live-join">Bağlan</button>
          </div>
        </details>`;
    } else {
      const links = liveLinks();
      const buttons = (key) =>
        `<button class="btn btn-sm" data-action="live-copy" data-link="${key}">${ICONS.copy}Kopyala</button>${
          navigator.share ? `<button class="btn btn-sm" data-action="live-share" data-link="${key}">${ICONS.share}Paylaş</button>` : ''
        }`;
      body = `<div class="live-link">
          <span class="sc-label">İzleyici linki</span>
          <a class="live-url" href="${esc(links.viewer)}" target="_blank" rel="noopener">${esc(links.viewer.replace(/^https?:\/\//, ''))}</a>
          <div class="btn-row">${buttons('viewer')}</div>
        </div>
        <div class="live-link">
          <span class="sc-label">Yönetici linki</span>
          <p class="sc-hint">Bu linki açan cihaz yönetimi devralıp skoru girebilir. Yalnız güvendiğin kişiye gönder.</p>
          <div class="btn-row">${buttons('admin')}</div>
        </div>
        ${renderAlerts()}
        <div class="sc-foot live-foot"><span>Yeni turnuvalar da aynı linkten yayınlanır.</span><button class="btn btn-sm btn-text-danger" data-action="live-stop">Bu cihazda kapat</button></div>`;
    }
    liveCardHtml = `<section class="card setup-card share-card" id="yayin" aria-labelledby="h-live">${head}${body}</section>`;
    return liveCardHtml;
  }

  function renderAlerts() {
    if (!alerts.key || !(alerts.reg || needsInstall)) return '';
    return `<div class="live-link">
        <span class="sc-label">Süre bildirimi</span>
        <p class="sc-hint">${alerts.on ? 'Açık: son dakikada ve süre bitince bu cihaza bildirim gelir, telefon kilitliyken de.' : 'Son dakikada ve süre bitince bu cihaza bildirim gelsin, telefon kilitliyken de.'}</p>
        <div class="btn-row"><button class="btn btn-sm" data-action="alerts-toggle">${alerts.on ? `${ICONS.bellOff}Bildirimi kapat` : `${ICONS.bell}Bildirimi aç`}</button></div>
      </div>`;
  }

  function refreshLiveCard() {
    const card = $('#yayin');
    if (!card) return;
    const before = liveCardHtml;
    const html = renderLiveCard();
    if (html !== before) card.outerHTML = html;
  }

  function onLiveChange() {
    if ((live?.config?.id ?? null) !== alerts.id) initAlerts();
    renderLiveChrome();
    refreshLiveCard();
  }

  function adoptRemote(remote) {
    state = T.migrate(remote);
    T.resolveKnockouts(state);
    saveState({ sync: false });
    dropStale();
    render();
  }

  function dropStale() {
    if ((dialog.kind === 'edit' || dialog.kind === 'summary') && !match(dialog.matchId)) closeDialog(false);
    if (dialog.kind === 'goal' && (readOnly() || match(dialog.matchId)?.status !== 'live')) closeDialog(false);
    if (ui.goalPicker && !liveMatch()?.goals.some((g) => g.id === ui.goalPicker)) ui.goalPicker = null;
  }

  const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  async function alertsRequest(c, method, body) {
    const res = await fetch(`/api/t/${c.id}/admin-push`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${c.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`push ${res.status}`);
  }

  async function initAlerts() {
    const c = live?.config;
    Object.assign(alerts, { id: c?.id ?? null, key: null, reg: null, on: false });
    if (!c || !('serviceWorker' in navigator)) return;
    try {
      const res = await fetch('/api/push-key', { cache: 'no-store' });
      if (!res.ok) return;
      const key = fromB64url((await res.json()).key);
      let reg = null;
      let sub = null;
      if (!needsInstall && 'PushManager' in window) {
        reg = await navigator.serviceWorker.ready;
        sub = await reg.pushManager.getSubscription();
      }
      if (alerts.id !== c.id) return;
      const on = !!sub && prefs.alerts === c.id && window.Notification?.permission === 'granted';
      Object.assign(alerts, { key, reg, on });
      // Push servisi aboneliği yenilemiş ya da sunucu kaydı kaybetmiş olabilir; her açılışta güncel abonelik gönderilir.
      if (on) alertsRequest(c, 'POST', { device: c.device, subscription: sub }).catch(() => {});
      refreshLiveCard();
    } catch {}
  }

  function saveAlerts(id) {
    prefs.alerts = id;
    savePrefs();
  }

  async function dropAlerts(c) {
    const sub = alerts.on && (await alerts.reg.pushManager.getSubscription());
    if (sub) await alertsRequest(c, 'DELETE', { endpoint: sub.endpoint });
  }

  function liveNotice(n) {
    if (n.kind !== 'lost') return;
    toast(
      n.lost
        ? `Yönetim başka bir cihaza geçmiş. Bu cihazdaki son ${n.lost} değişiklik yayına gitmedi.`
        : 'Yönetim başka bir cihaza geçti. Bu cihaz artık salt okunur.',
      'warn',
    );
  }

  async function handleAdminHash() {
    const link = LiveSync.parseAdminHash(location.hash);
    if (!link) return;
    // Yönetici anahtarı adres çubuğunda, geçmişte ya da ekran paylaşımında görünmesin.
    history.replaceState(null, '', location.pathname + location.search);
    joinLive(link);
  }

  async function joinLive(link) {
    if (!live) return toast('Canlı yayın bu adreste kullanılamıyor', 'warn');
    const c = live.config;
    if (c && c.id === link.id && c.token === link.token) return toast('Bu cihaz zaten yayına bağlı', 'ok');
    if (state.started || state.players.length) {
      const ok = await confirmDialog({
        title: 'Canlı yayına bağlanılsın mı?',
        body: 'Bu cihazdaki turnuva verileri yayındaki turnuvayla değiştirilir. İstersen önce Kurulum → Yedek → İndir.',
        ok: 'Bağlan',
      });
      if (!ok) return;
    }
    live.join(link.id, link.token);
    toast('Yayına bağlanıldı. Skoru girmek için yönetimi devral.', 'ok');
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
    return `<section class="pitch-card live-card${picker ? ' has-picker' : ''}" aria-label="Canlı maç">
      ${PITCH_LINES}
      <div class="pc-body">
        ${cardTop(m, '<span class="tag-live">Canlı</span>')}
        <div class="lc-board">
          ${liveTeam(m, home, 'home')}
          <div class="lc-score" role="img" aria-label="Skor: ${esc(home.name)} ${s.home}, ${esc(away.name)} ${s.away}"><span>${s.home}</span><span class="lc-dash">–</span><span>${s.away}</span></div>
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
              <button class="lc-btn lc-toggle" data-action="timer-toggle">${running ? `${ICONS.pause}Duraklat` : `${ICONS.play}Devam et`}</button>
            </div>
          </div>
          ${goalButton(home, 'home')}
          ${goalButton(away, 'away')}
        </div>
        ${ui.finishing ? renderPensForm(m) : ''}
        <footer class="lc-foot">
          <button class="lc-cancel" data-action="cancel-match">Maçı iptal et</button>
          <button class="btn btn-sm" data-action="history-match" data-tournament="${state.id}" data-id="${m.id}">Kadro</button>
          ${ui.finishing ? '' : '<button class="btn btn-lime btn-lg lc-finish" data-action="finish-match">Maçı bitir</button>'}
        </footer>
      </div>
    </section>`;
  }

  function liveTeam(m, t, side) {
    const goals = m.goals.filter((g) => g.team === t.id);
    return `<div class="lc-team lc-${side}" style="${teamStyle(t)}">
      <span class="lc-name">${swatch(t)}<span class="lc-name-text">${esc(t.name)}</span></span>
      ${goals.length ? `<div class="lc-chips wide-only">${goals.map((g) => goalChip(g, false)).join('')}</div>` : ''}
    </div>`;
  }

  // Kendi kalesine atabilecek olan rakip takımdır; "Diğer…" yalnız o maçta oynamayan takımdan yardıma gelen içindir.
  function scorerGroups(m, teamId) {
    const lineups = T.matchLineups(state, m);
    const roster = (t) => (t ? (lineups[t.id] || []).map(player).filter(Boolean) : []);
    const opp = team(m.home === teamId ? m.away : m.home);
    const rest = state.teams.find((t) => t.id !== m.home && t.id !== m.away);
    const playing = new Set(Object.values(lineups).flat());
    return { own: roster(team(teamId)), opp, against: roster(opp), rest, guests: state.players.filter((p) => !playing.has(p.id)) };
  }

  function goalChip(g, withDot) {
    const p = player(g.playerId);
    const min = goalMinute(g);
    const og = p && g.ownGoal;
    const label = p ? `${esc(p.name)}${og ? ' (k.k.)' : ''} ${min}` : `? ${min}`;
    const aria = p ? `Gol: ${p.name}${og ? ', kendi kalesine' : ''}, ${min}. Düzenle veya sil` : `Gol ${min}: golü atan seçilmedi`;
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
    const chip = (p, ownGoal = false) => {
      const on = g.playerId === p.id && !!g.ownGoal === ownGoal;
      return `<button class="pk-player${on ? ' is-on' : ''}" data-action="scorer-pick" data-goal="${g.id}" data-player="${p.id}"${ownGoal ? ' data-own="1"' : ''} aria-pressed="${on}">${on ? ICONS.check : ''}${esc(p.name)}</button>`;
    };
    const { own, guests, opp, against } = scorerGroups(m, g.team);
    const more = ui.showAllScorers
      ? guests.map((p) => chip(p)).join('')
      : guests.length
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
        <button class="pk-remove wide-only" data-action="goal-remove" data-goal="${g.id}">${ICONS.trash}Golü sil</button>
        <button class="pk-close narrow-only" data-action="picker-close" aria-label="Kapat">${ICONS.x}</button>
      </div>
      <span class="picker-label narrow-only">Golü atan</span>
      <div class="pk-players" role="group" aria-label="Golü atan">
        ${own.map((p) => chip(p)).join('')}${more}
        <button class="pk-later wide-only" data-action="picker-close">Kapat</button>
      </div>
      ${ownGoalPicks(opp, against, (p) => chip(p, true), 'picker-label pk-og-label')}
      <div class="pk-foot narrow-only">
        <button class="pk-delete" data-action="goal-remove" data-goal="${g.id}">${ICONS.trash}Golü sil</button>
        <button class="btn btn-primary btn-lg" data-action="picker-close">Tamam</button>
      </div>
    </section>`;
  }

  function renderPensForm(m) {
    const h = team(m.home);
    const a = team(m.away);
    const field = (t, id) =>
      `<label style="${teamStyle(t)}">${swatch(t)}${esc(t.name)}<input class="input-num" id="${id}" type="number" min="0" max="30" inputmode="numeric"></label>`;
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
    if (!m) return V.awaitingChampion() ? renderTieCard() : '';
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

  function renderTieCard() {
    return `<section class="pitch-card next-card" aria-label="Şampiyon belirlenecek">
      ${PITCH_LINES}
      <div class="pc-body">
        <div class="lc-top"><div class="lc-top-l"><span class="tag-next">Lig bitti</span></div></div>
        <h1 class="champ-name">Şampiyon belirlenecek</h1>
        ${renderLotsAlert()}
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

  function renderChampion(id) {
    const { t, players, best, line } = championData(id);
    return `<section class="pitch-card champion" style="${teamStyle(t)}" aria-label="Şampiyon">
      ${PITCH_LINES}
      <div class="pc-body">
        <span class="champ-icon">${ICONS.trophy}</span>
        <span class="champ-kicker">Şampiyon</span>
        <h1 class="champ-name">${swatch(t, { big: true })}${esc(t.name)}</h1>
        <p class="champ-line">${line}</p>
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
    const canCut = sc.playoffSaving > 0 && T.hasPlayoff(state.settings) && canTogglePlayoff();
    return `<section class="card alert-card" role="status">
      <strong>Süre yetmeyebilir</strong>
      <p>Tahmini bitiş ${fmtTime(sc.estEnd)}, saha saatini ${overMin} dk aşıyor.${canCut ? ` Playoff kaldırılırsa tahmini bitiş ${fmtTime(sc.estEnd - sc.playoffSaving)} olur.` : ''}</p>
      ${canCut ? '<button class="btn btn-sm btn-card" data-action="disable-playoff">Playoff\'u kaldır</button>' : ''}
    </section>`;
  }

  function renderScorers() {
    const { list } = T.topScorers(state);
    const leaders = list.filter((s) => s.goals === list[0]?.goals);
    const shown = leaders.slice(0, 5);
    const rows = shown.map((s) => {
      const t = team(s.team);
      const tag = t ? `class="tn" style="${teamStyle(t)}"` : 'class="tn is-tbd"';
      return `<li><span ${tag}>${swatch(t)}<span class="tn-name">${esc(s.name)}</span></span><strong>${s.goals}</strong></li>`;
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
    const skipped = (m) => !active.includes(m);
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
        ${groups.map((g) => fixtureCard(g, st, est, { readonly: preview, active })).join('') || '<p class="page-note">Bu filtrede maç yok.</p>'}
      </div>`;
  }

  function fixtureCard(g, st, est, opts) {
    return `<section class="card fx-card" aria-label="${g.title}">
      <h2 class="fx-title">${g.title}</h2>
      <div class="fx-rows">${g.matches.map((m) => fixtureRow(m, st, est[m.id], { ...opts, skipped: !opts.active.includes(m) })).join('')}</div>
    </section>`;
  }

  function fixtureRow(m, st, it, { readonly = false, skipped = false } = {}) {
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
        <span class="fx-act">${readonly ? '' : `<button class="btn-live" data-action="tab" data-tab="dashboard"><span class="dot"></span>Canlı</button><button class="btn btn-sm" data-action="history-match" data-tournament="${state.id}" data-id="${m.id}">Kadro</button>`}</span>
      </div>`;
    }
    let time = '';
    if (skipped) time = 'Kaldırıldı';
    else if (m.status === 'done') time = fmtTime(m.startedAt);
    else if (it) time = `~${fmtTime(it.estStart)}`;
    const score = m.status === 'done' ? `${s.home} – ${s.away}${m.pens ? `<small>pen. ${m.pens.home}–${m.pens.away}</small>` : ''}` : '–';
    const scoreEl =
      m.status === 'done'
        ? `<button class="fx-score row-hit" data-action="match" data-match="${m.id}" aria-label="${label} özeti: ${lastResult(m)}">${score}</button>`
        : `<span class="fx-score">${score}</span>`;
    let act = '';
    if (!readonly) {
      if (skipped) {
        if (m.stage === 'final' && canToggleFinal()) act = '<button class="btn btn-sm" data-action="set-final" data-value="1">Geri ekle</button>';
        else if (m.stage === 'playoff' && canTogglePlayoff()) act = '<button class="btn btn-sm" data-action="set-playoff" data-value="1">Geri ekle</button>';
      } else if (m.status === 'done') {
        act = canEdit(m)
          ? `<button class="icon-btn icon-soft" data-action="edit-match" data-id="${m.id}" aria-label="${label}: sonucu düzenle" title="Sonucu düzenle">${ICONS.edit}</button>`
          : '';
      } else {
        if (m.stage === 'playoff' && canTogglePlayoff()) {
          act += '<button class="btn btn-sm" data-action="disable-playoff" title="Playoff kaldırılırsa final lig 1.si – 2.si oynanır">Kaldır</button>';
        }
        if (m.stage === 'final' && canToggleFinal()) {
          act += '<button class="btn btn-sm" data-action="disable-final" title="Final kaldırılırsa lig 1.si şampiyon olur">Kaldır</button>';
        }
        if (!liveMatch() && m.home && m.away) {
          act += `<button class="icon-btn icon-soft" data-action="start-match" data-id="${m.id}" aria-label="${label}: başlat" title="Bu maçı başlat">${ICONS.play}</button>`;
        }
      }
    }
    if (!readonly && !skipped && m.home && m.away) act += `<button class="btn btn-sm" data-action="history-match" data-tournament="${state.id}" data-id="${m.id}">Kadro</button>`;
    return `<div class="fx-row is-${skipped ? 'skipped' : m.status} is-${m.stage}">
      <span class="fx-label">${label}</span>
      <span class="fx-time">${time}</span>
      <span class="fx-team fx-home">${side('home')}</span>
      ${scoreEl}
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
        <div class="setup-side">${renderPlayers()}${renderData()}${renderLiveCard()}</div>
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
      <details class="pool-picker" ${ui.poolOpen ? 'open' : ''}><summary>Oyuncu havuzundan seç</summary>
        <p class="sc-hint">Bu turnuvaya katılacakları ekleyin. Katılmayanların geçmişi korunur.</p>
        ${state.playerPool.filter((p) => !state.players.some((x) => x.id === p.id)).map((p) => `<div class="history-item"><span>${esc(p.name)}</span><button class="btn btn-sm" data-action="pool-select" data-id="${p.id}">Ekle</button></div>`).join('') || '<p class="sc-hint">Havuzdaki herkes bu turnuvada seçili.</p>'}
      </details>
    </section>`;
  }

  function playerRow(p) {
    const pots = [0, 1, 2, 3, 4, 5]
      .map((k) => `<option value="${k}"${p.pot === k ? ' selected' : ''}>${k ? `T${k}` : '–'}</option>`)
      .join('');
    return `<li class="pl-row">
      <input class="pl-input pl-name" data-field="player-name" data-id="${p.id}" value="${esc(p.name)}" maxlength="40" aria-label="Oyuncu adı">
      <span class="pot"><select data-field="player-pot" data-id="${p.id}" aria-label="${esc(p.name)}: torba" title="Torba: benzer seviyedekileri aynı torbaya koyun">${pots}</select>${ICONS.chevron}</span>
      <label class="keeper-choice" title="Kaleci"><input type="checkbox" data-field="player-keeper" data-id="${p.id}" aria-label="${esc(p.name)}: kaleci" ${p.goalkeeper ? 'checked' : ''}>K</label>
      <button class="icon-btn icon-ghost icon-sm" data-action="player-remove" data-id="${p.id}" aria-label="${esc(p.name)}: katılımcılardan çıkar" title="Katılımcılardan çıkar">${ICONS.x}</button>
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
      <p class="sc-hint">Oyuncu havuzu, mevcut turnuva ve tüm arşiv birlikte yedeklenir.</p>
      <div class="btn-row">
        <button class="btn btn-sm" data-action="export">${ICONS.download}İndir</button>
        <button class="btn btn-sm" data-action="import">${ICONS.upload}Yükle</button>
        <span class="spacer"></span>
        ${state.started ? '<button class="btn btn-sm btn-text-danger" data-action="reset-results">Sonuçları sıfırla</button>' : ''}
        <button class="btn btn-primary btn-sm" data-action="new-tournament">Yeni turnuva</button>
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
          : 'Oyuncuyu başka takıma almak için adının yanındaki oklara dokunun. Başka takımın kullandığı renk ya da arma seçilemez.'
      }</p>
    </section>`;
  }

  function teamCard(t, teamIndex) {
    const players = t.playerIds.map(player).filter(Boolean);
    const open = ui.colorMenu === t.id;
    const c = COLORS[t.color] || COLORS.red;
    const crest = Crests.byId(t.crest);
    return `<div class="tc" style="${teamStyle(t)}">
      <div class="tc-head">
        <input class="tc-name" data-field="team-name" data-team="${t.id}" value="${esc(t.name)}" maxlength="24" aria-label="Takım adı">
        <button class="tc-color${open ? ' is-open' : ''}" data-action="color-menu" data-team="${t.id}" data-popover aria-haspopup="true" aria-expanded="${open}" aria-label="Yelek rengi: ${c.label}${crest ? `, arma: ${crest.label}` : ''}, değiştir" title="Yelek rengi ve arma">${swatch(t)}${ICONS.chevron}</button>
        ${open ? colorMenu(t) : ''}
      </div>
      <ol class="tc-players">${players.map((p, i) => teamPlayer(p, t, i, teamIndex)).join('') || '<li class="tc-empty">Kura bekleniyor</li>'}</ol>
    </div>`;
  }

  function colorMenu(t) {
    const colors = Object.entries(COLORS).map(([key, c]) => {
      const owner = state.teams.find((o) => o !== t && o.color === key);
      const on = t.color === key;
      const extra = owner ? ` aria-disabled="true" title="${esc(owner.name)} kullanıyor"` : ` title="${c.label}"`;
      return `<button class="pop-color${on ? ' is-on' : ''}${owner ? ' is-taken' : ''}" role="option" aria-selected="${on}" data-action="team-color" data-team="${t.id}" data-color="${key}" style="--sw:${c.hex}"${extra}><span class="sw"></span>${c.label}</button>`;
    });
    const crests = [{ id: '', label: 'Arma yok' }, ...Crests.LIST].map((c) => {
      const owner = c.id && state.teams.find((o) => o !== t && o.crest === c.id);
      const on = (t.crest || '') === c.id;
      const extra = owner ? ` aria-disabled="true" title="${esc(owner.name)} kullanıyor"` : ` title="${c.label}"`;
      const icon = c.id ? `<span class="crest">${Crests.svg(c.id)}</span>` : '<span class="sw"></span>';
      return `<button class="pop-crest${on ? ' is-on' : ''}${owner ? ' is-taken' : ''}" role="option" aria-selected="${on}" aria-label="${c.label}" data-action="team-crest" data-team="${t.id}" data-crest="${c.id}"${extra}>${icon}</button>`;
    });
    return `<div class="pop pop-colors" data-popover>
      <div class="pop-color-list" role="listbox" aria-label="Yelek rengi">${colors.join('')}</div>
      <span class="pop-label" id="crest-label-${t.id}">Arma</span>
      <div class="pop-crests" role="listbox" aria-labelledby="crest-label-${t.id}">${crests.join('')}</div>
    </div>`;
  }

  function teamPlayer(p, t, i, teamIndex) {
    const open = ui.moveMenu === p.id;
    const others = state.teams.filter((x) => x !== t);
    const menu = open
      ? `<div class="pop pop-move" role="menu" aria-label="Takım değiştir" data-popover><span class="pop-label">Takım değiştir</span>${others
          .map((o) => `<button class="pop-item" role="menuitem" data-action="move-player" data-id="${p.id}" data-team="${o.id}" style="${teamStyle(o)}">${swatch(o)}${esc(o.name)}</button>`)
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

  function timeField(key, label, hint, type = 'time') {
    return `<div class="box box-time">
      <label class="box-label" for="time-${key}">${label}</label>
      <input class="time-input" id="time-${key}" type="${type}" required data-field="setting-time" data-key="${key}" value="${esc(state.settings[key])}">
      <span class="box-hint">${hint}</span>
      <button class="icon-btn icon-ghost icon-sm box-clear" data-action="clear-time" data-key="${key}" aria-label="${label}: temizle" title="Temizle">${ICONS.x}</button>
    </div>`;
  }

  function renderFormat() {
    const s = state.settings;
    const fin = T.hasFinal(s);
    const togglable = canTogglePlayoff();
    const finalOff = canToggleFinal() ? '' : 'disabled';
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
            <button data-action="set-playoff" data-value="1" aria-pressed="${T.hasPlayoff(s)}" ${off}>Açık</button>
            <button data-action="set-playoff" data-value="0" aria-pressed="${!T.hasPlayoff(s)}" ${off}>Kapalı</button>
          </div>${fin ? '' : '<span class="box-note">Final yokken playoff oynanmaz</span>'}</div>
          <div class="box"><span class="box-label">Final</span><div class="seg seg-box" role="group" aria-label="Final">
            <button data-action="set-final" data-value="1" aria-pressed="${fin}" ${finalOff}>Açık</button>
            <button data-action="set-final" data-value="0" aria-pressed="${!fin}" ${finalOff}>Kapalı</button>
          </div>${fin ? '' : '<span class="box-note">Lig 1.si şampiyon olur</span>'}</div>
        </div>
        <div class="fmt-row fmt-row-steps">
          ${stepper('leagueMin', 'Lig maçı')}
          ${T.hasPlayoff(s) ? stepper('playoffMin', 'Playoff maçı') : ''}
          ${fin ? stepper('finalMin', 'Final') : ''}
          ${stepper('changeMin', 'Maç arası')}
          ${fin ? stepper('breakMin', 'Lig sonrası ara') : ''}
        </div>
        <div class="fmt-row fmt-row-2">
          ${timeField('plannedDate', 'Tarih', 'İzleyici ekranında görünür', 'date')}
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
    return V.renderScreen({ full: !!document.fullscreenElement });
  }

  function renderSheet() {
    const open = ui.sheet && isScreen();
    if (!showSheet(open ? V.renderSheet({ scorersOpen: ui.scorersOpen, rulesOpen: ui.rulesOpen, matchId: ui.sheetMatch }) : '')) ui.sheet = false;
  }

  function closeSheet() {
    if (!ui.sheet) return;
    Object.assign(ui, { sheet: false, sheetMatch: null });
    renderSheet();
  }

  function renderDialog() {
    const el = $('#dialog');
    if (!dialog.kind) {
      if (el.open) el.close();
      el.innerHTML = '';
      return;
    }
    const html = { confirm: confirmHtml, goal: goalHtml, summary: summaryHtml, 'history-match': historyMatchHtml, 'merge-player': mergePlayerHtml }[dialog.kind] || editHtml;
    el.innerHTML = html();
    if (!el.open) el.showModal();
  }

  function historyTarget({ draft = true } = {}) {
    const t = dialog.tournamentId === state.id ? state : state.archives.find((t) => t.id === dialog.tournamentId);
    return { t, m: draft && dialog.draftMatch ? dialog.draftMatch : t?.matches.find((m) => m.id === dialog.matchId) };
  }

  function historyMatchHtml() {
    const { t, m } = historyTarget();
    return t && m ? HistoryViews.matchEditor(t, m, readOnly(), dialog.error) : '<div class="dialog-body"><p>Maç bulunamadı.</p><button class="btn" data-action="dialog-cancel">Kapat</button></div>';
  }

  function mergePlayerHtml() {
    const source = state.playerPool.find((p) => p.id === dialog.sourcePlayer);
    const stats = T.historyStats(state);
    return `<div class="dialog-body"><h2>Oyuncu kayıtlarını birleştir</h2><p>${esc(source?.name)} yanlışlıkla iki kez kaydedildiyse diğer kaydını seçin. İki kaydın maç ve golleri seçilen kişide toplanır. İşlemden önce tüm verilerin yedeği indirilir.</p><label class="history-goal"><span>Korunacak kişi</span><select id="merge-target">${stats.players.filter((p) => p.id !== dialog.sourcePlayer).map((p) => `<option value="${p.id}">${esc(p.name)} · ${p.played} maç</option>`).join('')}</select></label>${dialog.error ? `<p class="sc-foot is-warn" role="alert">${esc(dialog.error)}</p>` : ''}<div class="dialog-actions"><button class="btn" data-action="dialog-cancel">Vazgeç</button><button class="btn btn-primary" data-action="merge-confirm">Birleştir</button></div></div>`;
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

  function summaryHtml() {
    const m = match(dialog.matchId);
    if (!m) return '';
    return `<div class="dialog-body summary-dialog">
      ${V.renderMatchSummary(m.id)}
      <div class="dialog-actions">
        ${canEdit(m) ? `<button class="btn" data-action="edit-match" data-id="${m.id}">${ICONS.edit}Sonucu düzenle</button>` : ''}
        <button class="btn btn-primary" data-action="dialog-cancel">Kapat</button>
      </div>
    </div>`;
  }

  function ownGoalPicks(opp, against, chip, labelClass) {
    if (!against.length) return '';
    return `<span class="${labelClass}" style="${teamStyle(opp)}">Kendi kalesine · ${swatch(opp)}${esc(opp.name)}</span>
      <div class="pk-players" role="group" aria-label="Kendi kalesine">${against.map(chip).join('')}</div>`;
  }

  function goalHtml() {
    const m = match(dialog.matchId);
    const t = team(dialog.opts.team);
    const s = T.score(m);
    const chip = (p, ownGoal = false) =>
      `<button class="pk-player" data-action="goal-confirm" data-player="${p.id}"${ownGoal ? ' data-own="1"' : ''}><span class="tn-name">${esc(p.name)}</span></button>`;
    const { own, guests, opp, against } = scorerGroups(m, t.id);
    const more = ui.showAllScorers
      ? guests.map((p) => chip(p)).join('')
      : guests.length
        ? '<button class="pk-player pk-more" data-action="scorer-more">Diğer…</button>'
        : '';
    return `<div class="dialog-body goal-dialog" style="${teamStyle(t)}">
      <div>
        <span class="gd-meta">${goalMinute(dialog.opts)} · ${s.home}–${s.away}</span>
        <h2>${swatch(t)}${esc(t.name)} golü</h2>
      </div>
      <span class="gd-label">Kim attı?</span>
      <div class="pk-players" role="group" aria-label="Golü atan">
        ${own.map((p) => chip(p)).join('')}${more}
        <button class="pk-player gd-unknown" data-action="goal-confirm" data-player="">Bilinmiyor</button>
      </div>
      ${ownGoalPicks(opp, against, (p) => chip(p, true), 'gd-label gd-og')}
      <div class="dialog-actions"><button class="btn" data-action="dialog-cancel">Vazgeç</button></div>
    </div>`;
  }

  function editHtml() {
    const m = match(dialog.matchId);
    if (!m) return '';
    const s = T.score(m);
    const home = team(m.home);
    const away = team(m.away);
    const options = (g) => {
      const { own, opp, against, rest, guests } = scorerGroups(m, g.team);
      const opt = (p, ownGoal) =>
        `<option value="${ownGoal ? 'og:' : ''}${p.id}"${g.playerId === p.id && !!g.ownGoal === ownGoal ? ' selected' : ''}>${esc(p.name)}${ownGoal ? ' (k.k.)' : ''}</option>`;
      const group = (label, list, ownGoal = false) =>
        list.length ? `<optgroup label="${esc(label)}">${list.map((p) => opt(p, ownGoal)).join('')}</optgroup>` : '';
      return `<option value="">Bilinmiyor</option>${group(team(g.team)?.name, own)}${group(`Kendi kalesine · ${opp?.name}`, against, true)}${group(rest?.name, guests)}`;
    };
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
          <span class="pot pot-wide"><select data-field="goal-scorer" data-match="${m.id}" data-goal="${g.id}" aria-label="Golü atan">${options(g)}</select>${ICONS.chevron}</span>
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
    Object.assign(dialog, { kind: null, opts: null, resolve: null, matchId: null, error: '', draftMatch: null, originalMatch: null });
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
    // Yayın ekranı çoğu zaman aynı bilgisayarda açık; düdük iki kez çalmasın. Salt okunur cihaz da yöneten cihazla birlikte çalmasın.
    if (!prefs.sound || isScreen() || readOnly()) return;
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
  const SOUND_COUNTDOWN = [{ at: 0, dur: 0.08, freq: 880, vol: 0.25 }];
  const COUNTDOWN_S = 10;
  const BUZZ_LAST_MINUTE = [200, 100, 200];
  const BUZZ_END = [500, 200, 500];

  // iOS'ta titreşim yok; Android'de sayfaya en az bir kez dokunulmuş olmalı.
  function buzz(pattern) {
    if (!isScreen()) navigator.vibrate?.(pattern);
  }

  const lastRemaining = new Map();
  function tick() {
    const now = Date.now();
    const clock = V.tickClocks(now);
    if (clock) {
      const { m, rem, running } = clock;
      const prev = lastRemaining.get(m.id);
      if (prev != null && running) {
        if (prev > MINUTE && rem <= MINUTE && rem > 0) {
          play(SOUND_LAST_MINUTE);
          buzz(BUZZ_LAST_MINUTE);
        }
        const sec = Math.ceil(rem / 1000);
        if (sec >= 1 && sec <= COUNTDOWN_S && sec < Math.ceil(prev / 1000)) play(SOUND_COUNTDOWN);
        if (prev > 0 && rem <= 0) {
          play(SOUND_END);
          buzz(BUZZ_END);
        }
      }
      lastRemaining.set(m.id, rem);
      $('.live-card')?.classList.toggle('is-over', rem <= 0);
    }
    for (const el of $$('[data-until]')) {
      const left = Number(el.dataset.until) - now;
      el.textContent = left > 0 ? `${el.dataset.label}: ${fmtClock(left)}` : `${el.dataset.label} süresi doldu`;
      el.classList.toggle('is-over', left <= 0);
    }
  }

  async function addPlayers(names) {
    const wanted = names.map((x) => x.trim()).filter(Boolean);
    let allowDuplicate = false;
    const matches = state.playerPool.filter((p) => wanted.some((name) => name.replace(/\s+/g, ' ').toLocaleLowerCase('tr') === p.name.toLocaleLowerCase('tr')));
    if (matches.length) {
      const ok = await confirmDialog({ title: 'Havuzda aynı isim var', body: `${matches.map((p) => p.name).join(', ')} havuzda bulunuyor. Mevcut kişiyi “Oyuncu havuzundan seç” listesinden ekleyin. Bu farklı bir kişiyse yeni kayıt oluşturabilirsiniz.`, ok: 'Farklı kişi, yeni ekle', cancel: 'Havuzdan seçeceğim' });
      if (!ok) return;
      allowDuplicate = wanted.length === 1;
    }
    let added = 0;
    commit(() => {
      added = T.addPlayers(state, wanted, { allowDuplicate });
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
    const before = T.champion(state);
    commit(() => T.finishMatch(m, pens, Date.now()), { rerender: false });
    ui.finishing = false;
    ui.goalPicker = null;
    render();
    announceChampion(before);
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
    'merge-player'(el) {
      Object.assign(dialog, { kind: 'merge-player', sourcePlayer: el.dataset.id, error: '' }); renderDialog();
    },
    'merge-confirm'() {
      const id = $('#merge-target')?.value;
      const result = T.mergePlayers(state, dialog.sourcePlayer, id);
      if (result.error) { dialog.error = result.error; return renderDialog(); }
      actions.export();
      state = result.state;
      ui.historyPlayer = id;
      saveState(); closeDialog(true); render();
    },
    'pool-select'(el) {
      commit(() => T.selectPlayer(state, el.dataset.id));
    },
    'history-player'(el) {
      Object.assign(ui, { tab: 'history', historyPlayer: el.dataset.id, historyTournament: null }); render();
    },
    'history-tournament'(el) {
      Object.assign(ui, { tab: 'history', historyTournament: el.dataset.id, historyPlayer: null }); render();
    },
    'history-back'() {
      Object.assign(ui, { historyTournament: null, historyPlayer: null }); render();
    },
    'history-match'(el) {
      Object.assign(dialog, { kind: 'history-match', tournamentId: el.dataset.tournament, matchId: el.dataset.id, error: '', draftMatch: null });
      const { m } = historyTarget();
      if (!m) return closeDialog(false);
      dialog.originalMatch = JSON.stringify(m);
      dialog.draftMatch = structuredClone(m);
      renderDialog();
    },
    'history-goal-add'(el) {
      const { m } = historyTarget();
      if (m?.status !== 'done') return;
      T.addGoal(m, el.dataset.team);
      renderDialog();
    },
    'history-goal-remove'(el) {
      const { m } = historyTarget();
      if (m?.status !== 'done') return;
      T.removeGoal(m, el.dataset.id);
      renderDialog();
    },
    'history-save'() {
      const { t, m } = historyTarget({ draft: false });
      if (!t || !m || !dialog.draftMatch) return;
      if (JSON.stringify(m) !== dialog.originalMatch) {
        dialog.error = 'Bu maç başka bir işlemle değişti. Pencereyi kapatıp güncel kaydı yeniden açın.';
        return renderDialog();
      }
      const trial = structuredClone(t);
      const candidate = structuredClone(dialog.draftMatch);
      const score = T.score(candidate);
      if (score.home !== score.away || candidate.stage === 'league') candidate.pens = null;
      trial.matches[trial.matches.findIndex((x) => x.id === m.id)] = candidate;
      const error = T.resultError(trial);
      if (error) { dialog.error = error; return renderDialog(); }
      Object.assign(m, candidate);
      T.resolveKnockouts(t);
      if (t !== state) t.correctedAt = Date.now();
      saveState(); closeDialog(true); render();
    },
    'archive-tournament'() {
      if (!T.archiveTournament(state)) return toast('Arşivlemek için tüm maçları bitirin ve şampiyonu belirleyin.', 'warn');
      saveState(); render(); toast('Turnuva arşivlendi', 'ok');
    },
    async 'new-tournament'() {
      if (state.started && (T.activeMatches(state).some((m) => m.status !== 'done') || !T.champion(state))) return toast('Önce mevcut turnuvayı tamamlayın. Geçmiş maçlarınız korunacak.', 'warn');
      const ok = await confirmDialog({ title: 'Yeni turnuva oluşturulsun mu?', body: state.started ? 'Mevcut turnuva arşive kaydedilecek. Katılımcıları havuzdan seçip torbaları düzenleyerek yeni kura çekebilirsiniz.' : 'Hazırlıktaki kadro temizlenecek. Oyuncu havuzu ve turnuva arşivi korunacak.', ok: 'Yeni turnuva oluştur' });
      if (!ok) return;
      actions.export();
      const next = T.nextTournament(state);
      if (!next) return;
      state = next;
      Object.assign(ui, { tab: 'setup', poolOpen: true, historyTournament: null, historyPlayer: null, goalPicker: null, finishing: false });
      saveState(); render();
    },
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
      ui.sheet = true;
      renderSheet();
    },

    'sheet-close': closeSheet,

    'scorers-toggle'() {
      ui.scorersOpen = !ui.scorersOpen;
      renderSheet();
    },

    'rules-toggle'(el) {
      ui.rulesOpen = Views.toggleRules(el);
    },

    'scroll-to'(el) {
      document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    'fixture-filter'(el) {
      ui.fixtureFilter = el.dataset.value;
      render();
    },

    async 'player-add'() {
      const input = $('#new-player');
      if (!input || !input.value.trim()) return input?.focus();
      await addPlayers([input.value]);
    },

    async 'player-remove'(el) {
      const p = player(el.dataset.id);
      if (!p) return;
      let removed;
      commit(() => { removed = T.removePlayer(state, p.id); });
      if (!removed) toast('Oyuncunun maç kaydı var. Gerekirse ilgili maçın kadrosunu değiştirin.', 'warn');
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

    'team-crest'(el) {
      const t = team(el.dataset.team);
      if (!t) return;
      ui.colorMenu = null;
      commit(() => {
        if (el.dataset.crest) t.crest = el.dataset.crest;
        else delete t.crest;
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
      if (!T.hasFinal(state.settings)) return toast('Final yokken playoff oynanmaz', 'warn');
      if (!canTogglePlayoff()) return toast('Playoff başladıktan sonra değiştirilemez', 'warn');
      commit(() => (state.settings.playoffEnabled = el.dataset.value === '1'));
    },

    'set-final'(el) {
      if (!canToggleFinal()) return toast('Final ya da playoff başladıktan sonra değiştirilemez', 'warn');
      const before = T.champion(state);
      commit(() => (state.settings.finalEnabled = el.dataset.value === '1'));
      announceChampion(before);
    },

    async 'disable-final'() {
      if (!canToggleFinal()) return;
      const ok = await confirmDialog({
        title: 'Final kaldırılsın mı?',
        body: `${T.hasPlayoff(state.settings) ? 'Playoff da oynanmaz. ' : ''}Lig bitince puan durumunda 1. olan takım şampiyon olur. İsterseniz fikstürden geri ekleyebilirsiniz.`,
        ok: 'Kaldır',
      });
      if (!ok) return;
      const before = T.champion(state);
      commit(() => (state.settings.finalEnabled = false));
      announceChampion(before);
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

    'goal-add'(el) {
      const m = match(el.dataset.match) || liveMatch();
      if (!m) return;
      if (m.status !== 'live') return commit(() => T.addGoal(m, el.dataset.team, Date.now()));
      // Gol ancak golcü (ya da "Bilinmiyor") seçilince kaydedilir; yanlışlıkla basılan "+ Gol" iz bırakmaz.
      Object.assign(ui, { goalPicker: null, showAllScorers: false, finishing: false });
      Object.assign(dialog, { kind: 'goal', matchId: m.id, opts: { team: el.dataset.team, ms: T.elapsedMs(m) } });
      render();
    },

    'goal-confirm'(el) {
      const m = match(dialog.matchId);
      const { team: teamId, ms } = dialog.opts;
      closeDialog(false);
      if (m?.status !== 'live') return;
      commit(() => {
        const g = T.addGoal(m, teamId, Date.now());
        g.ms = ms;
        if (!T.assignScorer(state, m, g, el.dataset.player, el.dataset.own === '1')) toast('Oyuncunun takım bilgisi diğer golleriyle çelişiyor. Gol sahibi seçilmedi.', 'warn');
      });
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
      if (g && el.dataset.player) commit(() => {
        if (!T.assignScorer(state, m, g, el.dataset.player, el.dataset.own === '1')) toast('Oyuncunun takım bilgisi diğer golleriyle çelişiyor.', 'warn');
      });
      else render();
    },

    'scorer-edit'(el) {
      const same = ui.goalPicker === el.dataset.goal;
      Object.assign(ui, { goalPicker: same ? null : el.dataset.goal, showAllScorers: false });
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
      const champ = T.hasFinal(state.settings) ? null : T.champion(state);
      if (champ) toast(`Kura sonucu: şampiyon ${team(champ).name}`, 'ok');
      else toast(`Kura sonucu: ${T.computeStandings(state).rows.map((r, i) => `${i + 1}. ${team(r.team).name}`).join(', ')}`, 'ok');
    },

    'lots-set'(el) {
      const group = T.blockingTies(state).find((g) => g.includes(el.dataset.first));
      if (!group) return;
      const before = T.champion(state);
      commit(() => {
        for (const id of group) state.lots[id] = id === el.dataset.first ? 0 : 1;
      });
      announceChampion(before);
    },

    match(el) {
      const m = match(el.dataset.match);
      if (!m) return;
      if (isScreen()) {
        ui.sheetMatch = m.id;
        renderSheet();
        $('#sheet [data-action="sheet-back"]')?.focus({ preventScroll: true });
        return;
      }
      Object.assign(dialog, { kind: 'summary', matchId: m.id, error: '' });
      renderDialog();
    },

    'sheet-back'() {
      const id = ui.sheetMatch;
      ui.sheetMatch = null;
      renderSheet();
      $(`#sheet [data-action="match"][data-match="${id}"]`)?.focus({ preventScroll: true });
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
      if (state.archives.some((t) => t.id === state.id)) return toast('Bu turnuva arşivde. Devam etmek için “Yeni turnuva”yı kullanın.', 'warn');
      const ok = await confirmDialog({
        title: 'Sonuçlar sıfırlansın mı?',
        body: 'Oynanan tüm maçlar, skorlar ve goller silinir. Oyuncular, takımlar ve ayarlar kalır.',
        ok: 'Sıfırla',
        danger: true,
      });
      if (!ok) return;
      actions.export();
      Object.assign(ui, { tab: 'setup', finishing: false, goalPicker: null });
      commit(() => {
        state.matches = [];
        state.started = false;
        state.lots = {};
      });
    },

    async 'live-start'() {
      try {
        await live.start();
        toast('Yayın başladı. İzleyici linkini paylaşabilirsin.', 'ok');
      } catch {
        toast('Yayın başlatılamadı. İnternet bağlantısını kontrol edin.', 'warn');
      }
    },

    async 'live-copy'(el) {
      const url = liveLinks()?.[el.dataset.link];
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        toast(el.dataset.link === 'admin' ? 'Yönetici linki kopyalandı' : 'İzleyici linki kopyalandı', 'ok');
      } catch {
        toast('Kopyalanamadı', 'warn');
      }
    },

    async 'live-share'(el) {
      const url = liveLinks()?.[el.dataset.link];
      if (!url) return;
      try {
        await navigator.share({ title: el.dataset.link === 'admin' ? `${tournamentName()} · yönetim` : tournamentName(), url });
      } catch {}
    },

    async 'live-stop'() {
      const ok = await confirmDialog({
        title: 'Bu cihazda yayın kapatılsın mı?',
        body: 'Bu cihaz artık yayına göndermez; izleyiciler son hâli görmeye devam eder. Yeniden bağlanmak için yönetici linki gerekir.',
        ok: 'Kapat',
        danger: true,
      });
      if (!ok) return;
      saveAlerts(null);
      dropAlerts(live.config).catch(() => {});
      live.stop();
    },

    async 'live-takeover'() {
      const ok = await confirmDialog({
        title: 'Yönetim devralınsın mı?',
        body: 'Skoru bundan sonra bu cihaz girer; şu an yöneten cihaz salt okunur olur.',
        ok: 'Devral',
      });
      if (!ok) return;
      try {
        await live.takeover();
        toast('Yönetim bu cihazda', 'ok');
      } catch {
        toast('Devralınamadı. İnternet bağlantısını kontrol edin.', 'warn');
      }
    },

    'live-join'() {
      let link = null;
      try {
        link = LiveSync.parseAdminHash(new URL($('#live-join-link')?.value.trim() || '', location.origin).hash);
      } catch {}
      if (!link) return toast('Bu bir yönetici linki değil', 'warn');
      joinLive(link);
    },

    async 'alerts-toggle'() {
      if (needsInstall) return toast('Bildirim için önce Paylaş → Ana Ekrana Ekle ile uygulamayı ekle, ana ekrandan açıp yönetici linkiyle yayına bağlan.', 'warn');
      const c = live?.config;
      if (!c || !alerts.reg || alerts.busy) return;
      alerts.busy = true;
      try {
        if (alerts.on) {
          await dropAlerts(c);
          saveAlerts(null);
        } else {
          // iOS izni yalnız dokunuşun hemen ardından sorar; izin isteğinden önce başka bir bekleme olmamalı.
          if ((await Notification.requestPermission()) !== 'granted') return toast('Bildirim izni verilmedi. Telefonun ayarlarından açabilirsin.', 'warn');
          const pm = alerts.reg.pushManager;
          const sub = (await pm.getSubscription()) || (await pm.subscribe({ userVisibleOnly: true, applicationServerKey: alerts.key }));
          await alertsRequest(c, 'POST', { device: c.device, subscription: sub });
          saveAlerts(c.id);
        }
        alerts.on = !alerts.on;
        toast(alerts.on ? 'Süre bildirimi açık' : 'Süre bildirimi kapalı', 'ok');
      } catch {
        toast('Bildirim ayarı değişmedi. İnternet bağlantısını kontrol edip tekrar dene.', 'warn');
      } finally {
        alerts.busy = false;
        refreshLiveCard();
      }
    },

    'live-open'() {
      ui.tab = 'setup';
      ui.goalPicker = null;
      render();
      $('#yayin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (readOnly() && !READONLY_ACTIONS.has(el.dataset.action)) return toast('Yönetim başka bir cihazda. Değiştirmek için önce devral.', 'warn');
    ensureAudio();
    await fn(el, e);
  });

  document.addEventListener('toggle', (e) => {
    if (e.target.matches?.('.pool-picker') && e.target.isConnected) ui.poolOpen = e.target.open;
  }, true);

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (readOnly()) return;
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
    if (readOnly()) return;
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
    } else if (field === 'player-keeper') {
      const p = player(el.dataset.id);
      if (p) commit(() => (p.goalkeeper = el.checked));
    } else if (field === 'history-lineup') {
      const { t, m } = historyTarget();
      if (!t || !m) return;
      if (!T.setLineup(t, m, el.dataset.id, el.value)) toast('Bu oyuncunun gol kaydı var. Önce gol sahibini düzeltin.', 'warn');
      renderDialog();
    } else if (field === 'history-scorer') {
      const { t, m } = historyTarget();
      const g = m?.goals.find((g) => g.id === el.dataset.id);
      if (!g) return;
      const own = el.value.startsWith('og:'), id = own ? el.value.slice(3) : el.value;
      if (!T.assignScorer(t, m, g, id, own)) {
        toast('Oyuncunun diğer golleriyle çelişen bir takım seçildi.', 'warn');
      }
      renderDialog();
    } else if (field === 'history-pens') {
      const { m } = historyTarget();
      if (!m) return;
      m.pens ||= { home: null, away: null };
      m.pens[el.dataset.side] = el.value === '' ? null : Number(el.value);
    } else if (field === 'goal-scorer') {
      const m = match(el.dataset.match);
      const g = m?.goals.find((x) => x.id === el.dataset.goal);
      const ownGoal = el.value.startsWith('og:');
      if (g) commit(() => {
        if (!T.assignScorer(state, m, g, ownGoal ? el.value.slice(3) : el.value, ownGoal)) toast('Oyuncunun takım bilgisi diğer golleriyle çelişiyor.', 'warn');
      });
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
      if (ui.goalPicker) {
        ui.goalPicker = null;
        render();
        return;
      }
    }
    if (isScreen() || e.target.closest?.('input, textarea, select, button, [contenteditable]')) return;
    if (e.code === 'Space' && ui.tab === 'dashboard' && liveMatch() && !readOnly()) {
      e.preventDefault();
      actions['timer-toggle']();
    }
  });

  document.addEventListener('paste', (e) => {
    if (e.target.id !== 'new-player' || readOnly()) return;
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
    const ok = await confirmDialog({ title: 'Yedek yüklensin mi?', body: 'Oyuncu havuzu, mevcut turnuva ve arşiv bu yedekle değiştirilecek. Önce mevcut verilerinizin yedeği indirilecek.', ok: 'Yükle', danger: true });
    if (!ok) return;
    actions.export();
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

  const sheetEl = $('#sheet');
  sheetEl.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSheet();
  });
  sheetEl.addEventListener('click', (e) => {
    if (e.target === sheetEl) closeSheet();
  });

  // Yayın ekranı ve ikinci pencereler skoru localStorage üzerinden alır.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState();
    dropStale();
    render();
  });

  window.addEventListener('hashchange', () => {
    if (LiveSync.parseAdminHash(location.hash)) return handleAdminHash();
    ui.sheet = false;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAwake(isScreen() || !!liveMatch());
      tick();
      live?.wake();
    }
  });
  window.addEventListener('online', () => live?.wake());
  document.addEventListener('fullscreenchange', () => {
    if (isScreen()) render();
  });
  WIDE.addEventListener('change', () => {
    if (isScreen()) render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!isScreen()) renderChrome();
  });

  function refreshView() {
    let html = null;
    if (isScreen()) {
      html = renderScreen();
      renderSheet();
    } else if (!state.started) return;
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

  $('.brand-mark').innerHTML = ICONS.brand;
  $('.tool-screen').innerHTML = ICONS.tv;
  T.resolveKnockouts(state);
  if (liveAvailable() && !isScreen()) {
    live = LiveSync.admin({ getState: () => state, onAdopt: adoptRemote, onNotice: liveNotice, onChange: onLiveChange });
    initAlerts();
  }
  if (liveAvailable() && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  render();
  handleAdminHash();
  setInterval(tick, 250);
  setInterval(refreshView, 5000);
})();
