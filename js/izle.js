(() => {
  'use strict';

  const T = window.Tournament;
  const t = I18n.t;
  const CACHE_PREFIX = 'halisaha-izle-';
  const WIDE = matchMedia(Views.WIDE_QUERY);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const INSTALLED = matchMedia('(display-mode: standalone)');
  // Tahmini saatler zamanla kayar; yayına yeni bir şey gelmese de ekran tazelenir.
  const REFRESH_MS = 15000;
  const GOAL_FLAG_MS = 5000;
  const PUSH_PREFIX = 'halisaha-bildirim-';
  const TOAST_MS = 4000;
  const PUSH_TEXT = {
    install: t('Bildirim için önce Paylaş → Ana Ekrana Ekle ile uygulamayı ekleyin, sonra ana ekrandan açın.'),
    denied: t('Bildirim izni verilmedi. Telefonun ayarlarından açabilirsiniz.'),
    on: t('Gol ve sonuç bildirimleri açık'),
    off: t('Gol ve sonuç bildirimleri kapalı'),
    failed: t('Bildirim ayarı değişmedi. İnternet bağlantısını kontrol edip tekrar deneyin.'),
  };
  const TABS = { mac: t('Maç'), fikstur: t('Fikstür'), puan: I18n.tc('tab', 'Puan') };
  const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
  const EASE_PUSH = 'cubic-bezier(0.32, 0.72, 0, 1)';

  const $ = (sel) => document.querySelector(sel);
  const id = /^#([a-z2-9]{10})$/.exec(location.hash)?.[1] || null;
  const cacheKey = CACHE_PREFIX + id;
  const view = $('#view');
  const sheet = $('#sheet');

  let state = null;
  let notice = id ? 'connecting' : 'notfound';
  let connected = false;
  let organizerOnline = true;
  let heard = false;
  let chan = null;
  let viewHtml = '';
  let seenGoals = null;
  const flags = new Set();
  const push = { key: null, reg: null, on: false, busy: false };
  // iPhone'da push yalnız ana ekrana eklenmiş uygulamada var; Safari'deki zil bunu anlatır.
  const needsInstall = navigator.standalone === false;
  const ui = { sheet: false, sheetMatch: null, scorersOpen: false, rulesOpen: false, tab: 'mac' };
  const V = Views.create(() => state);
  const showSheet = Views.sheetView(sheet, {
    returnFocus: '[data-action="screen-fixtures"]',
    onDismiss: () => Object.assign(ui, { sheet: false, sheetMatch: null }),
  });

  let nav = null;
  // Her sekme kendi sayfa yığınını tutar: takım ve maç sayfaları birbirinin üstüne açılabilir.
  const stacks = Object.fromEntries(Object.keys(TABS).map((tab) => [tab, []]));
  const opened = [];
  const openers = new WeakMap();
  const filled = new WeakMap();
  let skipPop = 0;

  // Son bilinen hâl saklanır: sahada internet yokken sayfa yeniden açılırsa boş ekran yerine o görünür.
  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (saved?.state) state = T.migrate(saved.state);
    } catch {}
  }

  function writeCache() {
    try {
      if (state) localStorage.setItem(cacheKey, JSON.stringify({ state }));
      else localStorage.removeItem(cacheKey);
    } catch {}
  }

  function adopt(snapshot, receivedAt) {
    notice = 'empty';
    organizerOnline = snapshot.holderOnline !== false;
    state = snapshot.state ? T.migrate(LiveSync.localize(snapshot, receivedAt)) : null;
    if (state) T.resolveKnockouts(state);
    noteGoals();
    writeCache();
    render();
  }

  // Sayfa açıldıktan sonraki ilk hâl yalnız başlangıç noktası; ondan sonra gelen her yeni gol işaretlenir.
  function noteGoals() {
    const goals = state ? state.matches.flatMap((m) => m.goals) : [];
    const live = state && V.liveMatch();
    const fresh = seenGoals && live ? live.goals.filter((g) => !seenGoals.has(g.id)) : [];
    seenGoals = new Set(goals.map((g) => g.id));
    for (const g of fresh) {
      flags.add(g.id);
      setTimeout(() => {
        flags.delete(g.id);
        render();
      }, GOAL_FLAG_MS);
    }
    // iOS'ta titreşim yok; Android'de sayfaya en az bir kez dokunulmuş olmalı.
    if (fresh.length && document.visibilityState === 'visible') navigator.vibrate?.([200, 100, 200]);
  }

  function notFound() {
    chan?.close();
    state = null;
    notice = 'notfound';
    writeCache();
    render();
  }

  function connect() {
    chan = LiveSync.channel(`${location.origin.replace(/^http/, 'ws')}/api/t/${id}/ws`, {
      onMessage(msg, receivedAt) {
        if (msg.type === 'deleted') return notFound();
        heard = true;
        adopt(msg, receivedAt);
      },
      onStatus(open) {
        connected = open;
        render();
      },
    });
    // WebSocket bilinmeyen bir yayını sessizce yeniden dener; yanlış linki ancak bu istek ortaya çıkarır.
    fetch(`/api/t/${id}`, { cache: 'no-store' })
      .then(async (res) => {
        const receivedAt = Date.now();
        if (res.status === 404) return notFound();
        if (!res.ok) return;
        const snapshot = await res.json();
        if (!heard) adopt(snapshot, receivedAt);
      })
      .catch(() => {});
  }

  function render() {
    const wide = WIDE.matches;
    const tabs = !wide && !!state?.started;
    document.body.classList.toggle('is-wide', wide);
    document.body.classList.toggle('is-screen', wide);
    document.body.classList.toggle('is-tabs', tabs);
    document.title = state ? t('{name} · Canlı', { name: V.tournamentName() }) : t('Turfling Canlı');
    const bell = !push.key ? null : needsInstall ? 'off' : push.reg ? (push.on ? 'on' : 'off') : null;
    const opts = { wide, notice, updating: !connected, organizerAway: !organizerOnline, full: !!document.fullscreenElement, flags, bell };
    if (tabs) {
      ui.sheet = false;
      renderTabs(opts);
    } else {
      nav = null;
      const html = V.renderWatch(opts);
      if (html !== viewHtml) view.innerHTML = viewHtml = html;
    }
    renderSheet();
    V.tickClocks();
    Views.keepAwake(wide || !!(state && V.liveMatch()));
  }

  function renderSheet() {
    if (!showSheet(ui.sheet ? V.renderSheet({ scorersOpen: ui.scorersOpen, rulesOpen: ui.rulesOpen, matchId: ui.sheetMatch }) : '')) ui.sheet = false;
  }

  function closeSheet() {
    if (!ui.sheet) return;
    Object.assign(ui, { sheet: false, sheetMatch: null });
    render();
  }

  // Telefonda alt sekmeler: her sekme kendi sayfasını, açıksa bir takım sayfasını tutar.
  function buildShell() {
    viewHtml = '';
    const root = (tab, label) =>
      tab === 'mac'
        ? '<div class="iz-page is-mac"><div class="iz-page-body"></div><div class="iz-dim"></div></div>'
        : `<div class="iz-page"><div class="iz-bar"><span class="iz-bar-title">${label}</span></div><div class="iz-scroll"></div><div class="iz-dim"></div></div>`;
    view.innerHTML = `<div class="iz-app">${Object.entries(TABS)
      .map(([tab, label]) => `<section class="iz-sec" data-sec="${tab}" role="tabpanel" aria-label="${label}"${tab === ui.tab ? '' : ' hidden'}>${root(tab, label)}</section>`)
      .join('')}</div>
      <nav class="iz-tabbar" role="tablist" aria-label="${t('Bölümler')}">${V.renderTabBar(ui.tab)}</nav>`;
    nav = { tabbar: view.querySelector('.iz-tabbar'), sections: {}, roots: {} };
    for (const tab of Object.keys(TABS)) {
      nav.sections[tab] = view.querySelector(`[data-sec="${tab}"]`);
      nav.roots[tab] = nav.sections[tab].firstElementChild;
    }
    for (const [tab, stack] of Object.entries(stacks)) {
      const bad = stack.findIndex((e) => !pageExists(e));
      if (bad >= 0) stack.length = bad;
      for (const entry of stack) mountPage(tab, entry, { instant: true });
    }
  }

  // The page footer would sit behind the full-screen tabs, so the scrolling pages carry a copy at their end.
  const legal = document.querySelector('.legal-footer')?.outerHTML ?? '';

  function renderTabs(opts) {
    if (!nav) buildShell();
    fill(nav.roots.mac.querySelector('.iz-page-body'), V.renderWatch({ ...opts, links: true }));
    fill(nav.roots.fikstur.querySelector('.iz-scroll'), V.renderFixturePage({ rulesOpen: ui.rulesOpen }) + legal);
    fill(nav.roots.puan.querySelector('.iz-scroll'), V.renderStandingsPage() + legal);
    for (const [tab, stack] of Object.entries(stacks)) {
      const bad = stack.findIndex((e) => !pageExists(e));
      if (bad >= 0) while (stack.length > bad) closeTop(tab, { instant: true });
      const pages = pushedPages(tab);
      stack.forEach((e, i) => fillPage(pages[i], e));
    }
    nav.tabbar.classList.toggle('is-live', !!V.liveMatch());
  }

  // Yeni veri gelince yalnız değişen sayfa yenilenir; kaydırma yeri kapta kalır, odak aynı düğmeye döner.
  function fill(el, html) {
    if (filled.get(el) === html) return;
    const f = document.activeElement;
    const key = el.contains(f) && f.dataset.action ? actionSelector(f) : null;
    el.innerHTML = html;
    filled.set(el, html);
    if (key) el.querySelector(key)?.focus({ preventScroll: true });
  }

  function actionSelector(el) {
    const { action, team, match } = el.dataset;
    return `[data-action="${action}"]${team ? `[data-team="${team}"]` : ''}${match ? `[data-match="${match}"]` : ''}`;
  }

  const pageExists = (e) => (e.kind === 'team' ? !!V.team(e.id) : V.match(e.id)?.status === 'done');
  const samePage = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;

  function fillPage(page, e) {
    const title = e.kind === 'team' ? V.team(e.id).name : V.matchTitle(V.match(e.id));
    page.querySelector('.iz-bar-title').textContent = title;
    fill(page.querySelector('.iz-scroll'), e.kind === 'team' ? V.renderTeamPage(e.id) : V.renderMatchSummary(e.id, { links: true }));
  }

  const pushedPages = (tab) => [...nav.sections[tab].querySelectorAll(':scope > .iz-page.is-pushed')];
  const topPage = (tab) => pushedPages(tab).at(-1) || null;
  const dimOf = (page) => page.querySelector(':scope > .iz-dim');
  const scroller = (tab) => (tab === 'mac' ? nav.roots.mac : nav.roots[tab].querySelector('.iz-scroll'));

  function tween(el, from, to, opts) {
    el.getAnimations().forEach((a) => a.cancel());
    Object.assign(el.style, to);
    return el.animate([from, to], opts).finished.catch(() => {});
  }

  function selectTab(tab) {
    if (!nav || !TABS[tab]) return;
    if (tab === ui.tab) {
      if (stacks[tab].length) back(tab);
      else scroller(tab).scrollTo({ top: 0, behavior: REDUCED.matches ? 'auto' : 'smooth' });
      return;
    }
    nav.sections[ui.tab].hidden = true;
    ui.tab = tab;
    const sec = nav.sections[tab];
    sec.hidden = false;
    for (const b of nav.tabbar.querySelectorAll('.iz-tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    if (!REDUCED.matches) sec.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
  }

  function openPage(entry, opener) {
    if (!nav || !pageExists(entry)) return;
    const stack = stacks[ui.tab];
    if (samePage(stack.at(-1), entry)) return;
    // Bir alttaki sayfaya dönen bağlantı yeni sayfa açmaz, geri gider: takım → maç → aynı takım döngüsü birikmesin.
    if (samePage(stack.at(-2), entry)) return back(ui.tab);
    stack.push(entry);
    opened.push(ui.tab);
    // Android'in geri tuşu ve tarayıcının geri düğmesi de açılan sayfayı kapatsın.
    history.pushState({ izPage: true }, '');
    mountPage(ui.tab, entry, { opener });
  }

  function mountPage(tab, entry, { instant = false, opener = null } = {}) {
    const under = topPage(tab) || nav.roots[tab];
    under.insertAdjacentHTML(
      'afterend',
      `<div class="iz-page is-pushed"><div class="iz-bar"><button class="iz-back" data-action="back">${Views.ICONS.back}${t('Geri')}</button><span class="iz-bar-title"></span></div><div class="iz-scroll"></div><div class="iz-dim"></div></div>`,
    );
    const page = under.nextElementSibling;
    if (opener) openers.set(page, opener);
    fillPage(page, entry);
    V.tickClocks();
    under.inert = true;
    const dim = dimOf(under);
    if (instant) {
      if (!REDUCED.matches) {
        under.style.transform = 'translateX(-30%)';
        dim.style.opacity = '1';
      }
      return;
    }
    if (REDUCED.matches) {
      tween(page, { opacity: 0 }, { opacity: 1 }, { duration: 150, easing: 'linear' });
    } else {
      const o = { duration: 360, easing: EASE_PUSH };
      tween(page, { transform: 'translateX(100%)' }, { transform: 'translateX(0)' }, o);
      tween(under, { transform: 'translateX(0)' }, { transform: 'translateX(-30%)' }, o);
      tween(dim, { opacity: 0 }, { opacity: 1 }, o);
    }
    page.querySelector('.iz-back').focus({ preventScroll: true });
  }

  function closeTop(tab, { progress = 0, opts = null, instant = false } = {}) {
    const entry = stacks[tab].pop();
    const i = opened.lastIndexOf(tab);
    if (i >= 0) opened.splice(i, 1);
    const page = nav && topPage(tab);
    if (!page) return;
    const under = page.previousElementSibling;
    const dim = dimOf(under);
    under.inert = false;
    const done = () => {
      page.remove();
      under.style.transform = '';
      dim.style.opacity = '';
      if (tab !== ui.tab) return;
      const opener = openers.get(page);
      const fallback = entry.kind === 'team' ? `[data-action="team"][data-team="${entry.id}"]` : `[data-action="match"][data-match="${entry.id}"]`;
      (opener?.isConnected ? opener : under.querySelector(fallback))?.focus({ preventScroll: true });
    };
    if (instant || tab !== ui.tab) return done();
    if (REDUCED.matches) {
      under.style.transform = '';
      dim.style.opacity = '0';
      tween(page, { opacity: 1 }, { opacity: 0 }, { duration: 150, easing: 'linear' }).then(done);
      return;
    }
    const o = opts || { duration: 300, easing: EASE_PUSH };
    tween(page, { transform: `translateX(${progress * 100}%)` }, { transform: 'translateX(100%)' }, o).then(done);
    tween(under, { transform: `translateX(${-30 * (1 - progress)}%)` }, { transform: 'translateX(0)' }, o);
    tween(dim, { opacity: 1 - progress }, { opacity: 0 }, o);
  }

  function back(tab, anim) {
    closeTop(tab, anim);
    if (history.state?.izPage) {
      skipPop++;
      history.back();
    }
  }

  window.addEventListener('popstate', () => {
    if (skipPop) {
      skipPop--;
      return;
    }
    const tab = stacks[ui.tab].length ? ui.tab : opened.at(-1);
    if (tab) closeTop(tab);
  });

  // Ana ekrandaki uygulamada tarayıcının geri hareketi yok; sol kenardan sürükleyince takım sayfası kapanır.
  let drag = null;
  let suppressClick = false;
  view.addEventListener('pointerdown', (e) => {
    if (!INSTALLED.matches || !nav || !stacks[ui.tab].length || e.clientX > 24) return;
    const page = e.target.closest('.iz-page.is-pushed');
    if (page && page === topPage(ui.tab)) drag = { page, under: page.previousElementSibling, x0: e.clientX, x: e.clientX, t: e.timeStamp, v: 0, p: 0, active: false, id: e.pointerId };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (e.clientX - drag.x0 < 6) return;
      drag.active = true;
      view.setPointerCapture(e.pointerId);
      for (const el of [drag.page, drag.under, dimOf(drag.under)]) el.getAnimations().forEach((a) => a.cancel());
    }
    drag.v = (e.clientX - drag.x) / Math.max(1, e.timeStamp - drag.t);
    drag.x = e.clientX;
    drag.t = e.timeStamp;
    drag.p = Math.min(1, Math.max(0, (e.clientX - drag.x0) / window.innerWidth));
    drag.page.style.transform = `translateX(${drag.p * 100}%)`;
    drag.under.style.transform = `translateX(${-30 * (1 - drag.p)}%)`;
    dimOf(drag.under).style.opacity = String(1 - drag.p);
  });
  function endDrag() {
    const d = drag;
    drag = null;
    if (!d?.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (d.p > 0.4 || d.v > 0.35) {
      back(ui.tab, { progress: d.p, opts: { duration: Math.max(160, 300 * (1 - d.p)), easing: EASE } });
      return;
    }
    const o = { duration: 240, easing: EASE };
    tween(d.page, { transform: `translateX(${d.p * 100}%)` }, { transform: 'translateX(0)' }, o);
    tween(d.under, { transform: `translateX(${-30 * (1 - d.p)}%)` }, { transform: 'translateX(-30%)' }, o);
    tween(dimOf(d.under), { opacity: 1 - d.p }, { opacity: 1 }, o);
  }
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);

  view.addEventListener(
    'scroll',
    (e) => {
      const sc = e.target;
      if (!sc.classList?.contains('iz-scroll')) return;
      sc.previousElementSibling.classList.toggle('is-scrolled', sc.scrollTop > (sc.closest('.is-pushed') ? 52 : 44));
    },
    true,
  );

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.append(toast);
  let toastTimer = 0;

  function say(message) {
    toast.textContent = message;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), TOAST_MS);
  }

  const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  function pushWanted() {
    try {
      return localStorage.getItem(PUSH_PREFIX + id) === '1';
    } catch {
      return false;
    }
  }

  function savePush(on) {
    try {
      if (on) localStorage.setItem(PUSH_PREFIX + id, '1');
      else localStorage.removeItem(PUSH_PREFIX + id);
    } catch {}
  }

  async function pushRequest(method, body) {
    const res = await fetch(`/api/t/${id}/push`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`push ${res.status}`);
  }

  const sendSubscription = (sub) => pushRequest('POST', { ...sub.toJSON(), lang: I18n.lang() });

  async function initPush() {
    if (!id || !('serviceWorker' in navigator)) return;
    try {
      const res = await fetch('/api/push-key', { cache: 'no-store' });
      if (!res.ok) return;
      push.key = fromB64url((await res.json()).key);
      if (!needsInstall && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        push.on = !!sub && pushWanted() && window.Notification?.permission === 'granted';
        push.reg = reg;
        // Push servisi aboneliği yenilemiş ya da sunucu kaydı kaybetmiş olabilir; her açılışta güncel abonelik gönderilir.
        if (push.on) sendSubscription(sub).catch(() => {});
      }
      render();
    } catch {}
  }

  async function togglePush() {
    if (needsInstall) return say(PUSH_TEXT.install);
    if (!push.reg || push.busy) return;
    push.busy = true;
    try {
      if (push.on) {
        const sub = await push.reg.pushManager.getSubscription();
        if (sub) await pushRequest('DELETE', { endpoint: sub.endpoint });
      } else {
        // iOS izni yalnız dokunuşun hemen ardından sorar; izin isteğinden önce başka bir bekleme olmamalı.
        if ((await Notification.requestPermission()) !== 'granted') return say(PUSH_TEXT.denied);
        const pm = push.reg.pushManager;
        const sub = (await pm.getSubscription()) || (await pm.subscribe({ userVisibleOnly: true, applicationServerKey: push.key }));
        await sendSubscription(sub);
      }
      push.on = !push.on;
      savePush(push.on);
      say(push.on ? PUSH_TEXT.on : PUSH_TEXT.off);
      render();
    } catch {
      say(PUSH_TEXT.failed);
    } finally {
      push.busy = false;
    }
  }

  const actions = {
    'screen-fixtures'() {
      ui.sheet = true;
      render();
    },
    'sheet-close': closeSheet,
    'scorers-toggle'() {
      ui.scorersOpen = !ui.scorersOpen;
      render();
    },
    'rules-toggle'(el) {
      ui.rulesOpen = Views.toggleRules(el);
    },
    'toggle-fullscreen'() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    },
    tab(el) {
      selectTab(el.dataset.tab);
    },
    team(el) {
      openPage({ kind: 'team', id: el.dataset.team }, el);
    },
    match(el) {
      if (nav) return openPage({ kind: 'match', id: el.dataset.match }, el);
      ui.sheetMatch = el.dataset.match;
      renderSheet();
      sheet.querySelector('[data-action="sheet-back"]')?.focus({ preventScroll: true });
    },
    'sheet-back'() {
      const id = ui.sheetMatch;
      ui.sheetMatch = null;
      renderSheet();
      sheet.querySelector(`[data-action="match"][data-match="${id}"]`)?.focus({ preventScroll: true });
    },
    back() {
      if (stacks[ui.tab].length) back(ui.tab);
    },
    'push-toggle': togglePush,
  };

  document.addEventListener('click', (e) => {
    if (suppressClick) {
      e.preventDefault();
      return;
    }
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) {
      e.preventDefault();
      actions[el.dataset.action](el);
    } else if (e.target === sheet) {
      closeSheet();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.open && nav && stacks[ui.tab].length) back(ui.tab);
  });

  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSheet();
  });

  WIDE.addEventListener('change', render);
  document.addEventListener('fullscreenchange', render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    chan?.wake();
    render();
  });
  window.addEventListener('online', () => chan?.wake());
  window.addEventListener('hashchange', () => location.reload());

  if (id) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = `/izle.webmanifest?id=${id}&lang=${I18n.lang()}`;
    document.head.append(manifest);
    readCache();
  }
  render();
  if (id) connect();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  initPush();
  setInterval(() => V.tickClocks(), 250);
  setInterval(render, REFRESH_MS);
})();
