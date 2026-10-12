(() => {
  'use strict';

  const T = window.Tournament;
  const CACHE_PREFIX = 'halisaha-izle-';
  const WIDE = matchMedia(Views.WIDE_QUERY);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const INSTALLED = matchMedia('(display-mode: standalone)');
  // Tahmini saatler zamanla kayar; yayına yeni bir şey gelmese de ekran tazelenir.
  const REFRESH_MS = 15000;
  const GOAL_FLAG_MS = 5000;
  const TABS = { mac: 'Maç', fikstur: 'Fikstür', puan: 'Puan' };
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
  const ui = { sheet: false, scorersOpen: false, tab: 'mac' };
  const V = Views.create(() => state);
  const showSheet = Views.sheetView(sheet, {
    returnFocus: '[data-action="screen-fixtures"]',
    onDismiss: () => (ui.sheet = false),
  });

  let nav = null;
  const teams = {};
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
    document.title = state ? `${V.tournamentName()} · Canlı` : 'Halı Saha Turnuvası · Canlı';
    const opts = { wide, notice, updating: !connected, organizerAway: !organizerOnline, full: !!document.fullscreenElement, flags };
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
    if (!showSheet(ui.sheet ? V.renderSheet({ scorersOpen: ui.scorersOpen }) : '')) ui.sheet = false;
  }

  function closeSheet() {
    if (!ui.sheet) return;
    ui.sheet = false;
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
      <nav class="iz-tabbar" role="tablist" aria-label="Bölümler">${V.renderTabBar(ui.tab)}</nav>`;
    nav = { tabbar: view.querySelector('.iz-tabbar'), sections: {}, roots: {} };
    for (const tab of Object.keys(TABS)) {
      nav.sections[tab] = view.querySelector(`[data-sec="${tab}"]`);
      nav.roots[tab] = nav.sections[tab].firstElementChild;
    }
    for (const [tab, teamId] of Object.entries(teams)) mountTeam(tab, teamId, { instant: true });
  }

  function renderTabs(opts) {
    if (!nav) buildShell();
    fill(nav.roots.mac.querySelector('.iz-page-body'), V.renderWatch(opts));
    fill(nav.roots.fikstur.querySelector('.iz-scroll'), V.renderFixturePage());
    fill(nav.roots.puan.querySelector('.iz-scroll'), V.renderStandingsPage());
    for (const [tab, teamId] of Object.entries(teams)) {
      if (!V.team(teamId)) {
        closeTeam(tab, { instant: true });
        continue;
      }
      fillTeam(teamPage(tab), teamId);
    }
    nav.tabbar.classList.toggle('is-live', !!V.liveMatch());
  }

  // Yeni veri gelince yalnız değişen sayfa yenilenir; kaydırma yeri kapta kalır, odak aynı düğmeye döner.
  function fill(el, html) {
    if (filled.get(el) === html) return;
    const f = document.activeElement;
    const key = el.contains(f) && f.dataset.action ? `[data-action="${f.dataset.action}"]${f.dataset.team ? `[data-team="${f.dataset.team}"]` : ''}` : null;
    el.innerHTML = html;
    filled.set(el, html);
    if (key) el.querySelector(key)?.focus({ preventScroll: true });
  }

  function fillTeam(page, teamId) {
    page.querySelector('.iz-bar-title').textContent = V.team(teamId).name;
    fill(page.querySelector('.iz-scroll'), V.renderTeamPage(teamId));
  }

  const teamPage = (tab) => nav.sections[tab].querySelector('.iz-page.is-pushed');
  const scroller = (tab) => (tab === 'mac' ? nav.roots.mac : nav.roots[tab].querySelector('.iz-scroll'));

  function tween(el, from, to, opts) {
    el.getAnimations().forEach((a) => a.cancel());
    Object.assign(el.style, to);
    return el.animate([from, to], opts).finished.catch(() => {});
  }

  function selectTab(tab) {
    if (!nav || !TABS[tab]) return;
    if (tab === ui.tab) {
      if (teams[tab]) back(tab);
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

  function openTeam(teamId, opener) {
    if (!nav || teams[ui.tab] || !V.team(teamId)) return;
    teams[ui.tab] = teamId;
    opened.push(ui.tab);
    // Android'in geri tuşu ve tarayıcının geri düğmesi de takım sayfasını kapatsın.
    history.pushState({ izTeam: teamId }, '');
    mountTeam(ui.tab, teamId, { opener });
  }

  function mountTeam(tab, teamId, { instant = false, opener = null } = {}) {
    const root = nav.roots[tab];
    root.insertAdjacentHTML(
      'afterend',
      `<div class="iz-page is-pushed"><div class="iz-bar"><button class="iz-back" data-action="back">${Views.ICONS.back}Geri</button><span class="iz-bar-title"></span></div><div class="iz-scroll"></div></div>`,
    );
    const page = root.nextElementSibling;
    if (opener) openers.set(page, opener);
    fillTeam(page, teamId);
    V.tickClocks();
    root.inert = true;
    const dim = root.querySelector('.iz-dim');
    if (instant) {
      if (!REDUCED.matches) {
        root.style.transform = 'translateX(-30%)';
        dim.style.opacity = '1';
      }
      return;
    }
    if (REDUCED.matches) {
      tween(page, { opacity: 0 }, { opacity: 1 }, { duration: 150, easing: 'linear' });
    } else {
      const o = { duration: 360, easing: EASE_PUSH };
      tween(page, { transform: 'translateX(100%)' }, { transform: 'translateX(0)' }, o);
      tween(root, { transform: 'translateX(0)' }, { transform: 'translateX(-30%)' }, o);
      tween(dim, { opacity: 0 }, { opacity: 1 }, o);
    }
    page.querySelector('.iz-back').focus({ preventScroll: true });
  }

  function closeTeam(tab, { progress = 0, opts = null, instant = false } = {}) {
    const teamId = teams[tab];
    delete teams[tab];
    const i = opened.indexOf(tab);
    if (i >= 0) opened.splice(i, 1);
    const page = nav && teamPage(tab);
    if (!page) return;
    const root = nav.roots[tab];
    const dim = root.querySelector('.iz-dim');
    root.inert = false;
    const done = () => {
      page.remove();
      root.style.transform = '';
      dim.style.opacity = '';
      if (tab !== ui.tab) return;
      const opener = openers.get(page);
      (opener?.isConnected ? opener : root.querySelector(`[data-action="team"][data-team="${teamId}"]`))?.focus({ preventScroll: true });
    };
    if (instant || tab !== ui.tab) return done();
    if (REDUCED.matches) {
      root.style.transform = '';
      dim.style.opacity = '0';
      tween(page, { opacity: 1 }, { opacity: 0 }, { duration: 150, easing: 'linear' }).then(done);
      return;
    }
    const o = opts || { duration: 300, easing: EASE_PUSH };
    tween(page, { transform: `translateX(${progress * 100}%)` }, { transform: 'translateX(100%)' }, o).then(done);
    tween(root, { transform: `translateX(${-30 * (1 - progress)}%)` }, { transform: 'translateX(0)' }, o);
    tween(dim, { opacity: 1 - progress }, { opacity: 0 }, o);
  }

  function back(tab, anim) {
    closeTeam(tab, anim);
    if (history.state?.izTeam) {
      skipPop++;
      history.back();
    }
  }

  window.addEventListener('popstate', () => {
    if (skipPop) {
      skipPop--;
      return;
    }
    const tab = teams[ui.tab] ? ui.tab : opened[opened.length - 1];
    if (tab) closeTeam(tab);
  });

  // Ana ekrandaki uygulamada tarayıcının geri hareketi yok; sol kenardan sürükleyince takım sayfası kapanır.
  let drag = null;
  let suppressClick = false;
  view.addEventListener('pointerdown', (e) => {
    if (!INSTALLED.matches || !nav || !teams[ui.tab] || e.clientX > 24) return;
    const page = e.target.closest('.iz-page.is-pushed');
    if (page) drag = { page, root: nav.roots[ui.tab], x0: e.clientX, x: e.clientX, t: e.timeStamp, v: 0, p: 0, active: false, id: e.pointerId };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (e.clientX - drag.x0 < 6) return;
      drag.active = true;
      view.setPointerCapture(e.pointerId);
      for (const el of [drag.page, drag.root, drag.root.querySelector('.iz-dim')]) el.getAnimations().forEach((a) => a.cancel());
    }
    drag.v = (e.clientX - drag.x) / Math.max(1, e.timeStamp - drag.t);
    drag.x = e.clientX;
    drag.t = e.timeStamp;
    drag.p = Math.min(1, Math.max(0, (e.clientX - drag.x0) / window.innerWidth));
    drag.page.style.transform = `translateX(${drag.p * 100}%)`;
    drag.root.style.transform = `translateX(${-30 * (1 - drag.p)}%)`;
    drag.root.querySelector('.iz-dim').style.opacity = String(1 - drag.p);
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
    tween(d.root, { transform: `translateX(${-30 * (1 - d.p)}%)` }, { transform: 'translateX(-30%)' }, o);
    tween(d.root.querySelector('.iz-dim'), { opacity: 1 - d.p }, { opacity: 1 }, o);
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
    'toggle-fullscreen'() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    },
    tab(el) {
      selectTab(el.dataset.tab);
    },
    team(el) {
      openTeam(el.dataset.team, el);
    },
    back() {
      if (teams[ui.tab]) back(ui.tab);
    },
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
    if (e.key === 'Escape' && !sheet.open && nav && teams[ui.tab]) back(ui.tab);
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
    manifest.href = `/izle.webmanifest?id=${id}`;
    document.head.append(manifest);
    readCache();
  }
  render();
  if (id) connect();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(() => V.tickClocks(), 250);
  setInterval(render, REFRESH_MS);
})();
