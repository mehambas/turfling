(() => {
  'use strict';

  const T = window.Tournament;
  const CACHE_PREFIX = 'halisaha-izle-';
  const WIDE = matchMedia(Views.WIDE_QUERY);
  // Tahmini saatler zamanla kayar; yayına yeni bir şey gelmese de ekran tazelenir.
  const REFRESH_MS = 15000;
  const GOAL_FLAG_MS = 5000;

  const $ = (sel) => document.querySelector(sel);
  const id = /^#([a-z2-9]{10})$/.exec(location.hash)?.[1] || null;
  const cacheKey = CACHE_PREFIX + id;
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
  const ui = { sheet: false, scorersOpen: false };
  const V = Views.create(() => state);
  const showSheet = Views.sheetView(sheet);

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
    document.body.classList.toggle('is-wide', wide);
    document.body.classList.toggle('is-screen', wide);
    document.title = state ? `${V.tournamentName()} · Canlı` : 'Halı Saha Turnuvası · Canlı';
    const html = V.renderWatch({ wide, notice, updating: !connected, organizerAway: !organizerOnline, full: !!document.fullscreenElement, flags });
    if (html !== viewHtml) $('#view').innerHTML = viewHtml = html;
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
    $('[data-action="sheet-open"], [data-action="screen-fixtures"]')?.focus();
  }

  const actions = {
    'sheet-open'() {
      ui.sheet = true;
      render();
    },
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
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) {
      e.preventDefault();
      actions[el.dataset.action]();
    } else if (e.target === sheet) {
      closeSheet();
    }
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
