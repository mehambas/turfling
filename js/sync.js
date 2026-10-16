(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LiveSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG_KEY = 'halisaha-turnuva-yayin';
  const TIME_FIELDS = ['startedAt', 'runningSince', 'endedAt'];
  const PING_MS = 25000;
  const BEAT_MS = 25000;
  const DEAD_MS = 60000;
  const MAX_RETRY_MS = 30000;

  function randomDevice() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function parseAdminHash(hash) {
    const m = /^#yonet\/([a-z2-9]{10})\.([A-Za-z0-9_-]{20,})$/.exec(hash || '');
    return m ? { id: m[1], token: m[2] } : null;
  }

  // Zamanlar durumu en son gönderen yöneticinin saatine göre; telefon saatleri arasındaki fark
  // çalışan maçın süresini kaydırmasın diye bu cihazın saatine çevrilir.
  function localize(snapshot, receivedAt) {
    const state = structuredClone(snapshot.state);
    const delta = (snapshot.clockOffset || 0) - (snapshot.serverTime - receivedAt);
    for (const m of state.matches || []) {
      for (const key of TIME_FIELDS) if (typeof m[key] === 'number') m[key] += delta;
    }
    return state;
  }

  function libraryOf(state) {
    return Array.isArray(state?.playerPool) && Array.isArray(state?.archives)
      ? { playerPool: state.playerPool, archives: state.archives } : null;
  }

  function libraryDelta(previous, next) {
    if (!next || JSON.stringify(previous) === JSON.stringify(next)) return null;
    const old = new Map((previous?.archives || []).map((t) => [t.id, t]));
    const ids = new Set(next.archives.map((t) => t.id));
    const patch = {
      ...(!previous ? { replace: true } : {}),
      ...(JSON.stringify(previous?.playerPool) !== JSON.stringify(next.playerPool) ? { playerPool: next.playerPool } : {}),
      upsertArchives: next.archives.filter((t) => JSON.stringify(old.get(t.id)) !== JSON.stringify(t)),
      deleteArchiveIds: [...old.keys()].filter((id) => !ids.has(id)),
    };
    return patch.replace || patch.playerPool || patch.upsertArchives.length || patch.deleteArchiveIds.length ? patch : null;
  }

  function libraryBatch(patch) {
    if (!patch) return null;
    const batch = { ...patch, upsertArchives: [] };
    let bytes = new TextEncoder().encode(JSON.stringify(batch)).byteLength;
    for (const record of patch.upsertArchives) {
      const size = new TextEncoder().encode(JSON.stringify(record)).byteLength + 1;
      if (batch.upsertArchives.length && bytes + size > 512 * 1024) break;
      batch.upsertArchives.push(record);
      bytes += size;
    }
    return batch;
  }

  function applyLibraryPatch(previous, patch) {
    if (!patch) return previous;
    const records = new Map((patch.replace ? [] : previous?.archives || []).map((t) => [t.id, t]));
    for (const id of patch.deleteArchiveIds) records.delete(id);
    for (const record of patch.upsertArchives) records.set(record.id, record);
    return { playerPool: patch.playerPool ?? previous?.playerPool ?? [], archives: [...records.values()] };
  }

  function channel(url, { onMessage, onStatus = () => {}, WebSocketImpl = globalThis.WebSocket } = {}) {
    let ws = null;
    let open = false;
    let closed = false;
    let attempt = 0;
    let lastSeen = 0;
    let retryTimer = null;

    const setOpen = (value) => {
      if (open === value) return;
      open = value;
      onStatus(value);
    };

    function connect() {
      clearTimeout(retryTimer);
      if (closed) return;
      const socket = new WebSocketImpl(url);
      ws = socket;
      socket.onopen = () => {
        if (ws !== socket) return;
        attempt = 0;
        lastSeen = Date.now();
        setOpen(true);
      };
      socket.onmessage = (e) => {
        if (ws !== socket) return;
        lastSeen = Date.now();
        if (e.data === 'pong') return;
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg && (msg.type === 'state' || msg.type === 'deleted')) onMessage(msg, lastSeen);
      };
      socket.onclose = () => {
        if (ws !== socket) return;
        ws = null;
        setOpen(false);
        if (!closed) retryTimer = setTimeout(connect, Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt++));
      };
      socket.onerror = () => {
        try {
          socket.close();
        } catch {}
      };
    }

    function restart() {
      const old = ws;
      ws = null;
      try {
        old?.close();
      } catch {}
      setOpen(false);
      connect();
    }

    // Telefon uykudan dönünce bağlantı kapanmış ama haber verilmemiş olabilir.
    const pingTimer = setInterval(() => {
      if (!open) return;
      if (Date.now() - lastSeen > DEAD_MS) return restart();
      try {
        ws.send('ping');
      } catch {}
    }, PING_MS);

    connect();
    return {
      get open() {
        return open;
      },
      wake() {
        if (open || closed) return;
        attempt = 0;
        restart();
      },
      send(text) {
        try {
          if (open) ws.send(text);
        } catch {}
      },
      close() {
        closed = true;
        clearInterval(pingTimer);
        clearTimeout(retryTimer);
        const old = ws;
        ws = null;
        try {
          old?.close();
        } catch {}
        setOpen(false);
      },
    };
  }

  function admin({
    getState,
    onAdopt,
    onNotice = () => {},
    onChange = () => {},
    storage = globalThis.localStorage,
    fetchImpl = (...args) => globalThis.fetch(...args),
    WebSocketImpl = globalThis.WebSocket,
    origin = globalThis.location?.origin || '',
    debounceMs = 300,
    retryMs = 2000,
    beatMs = BEAT_MS,
  }) {
    let cfg = read();
    let chan = null;
    let timer = null;
    let inflight = false;
    let netError = false;
    let everConnected = false;
    let fatal = null;
    let retryDelay = 0;
    let beatTimer = null;
    let confirmedLibrary = null;
    let confirmedLibraryRev = null;
    let libraryReady = false;
    let hydrateTimer = null;
    let messageQueue = Promise.resolve();

    function read() {
      try {
        const c = JSON.parse(storage.getItem(CONFIG_KEY) || 'null');
        return c && c.id && c.token && c.device ? { rev: 0, pending: 0, holder: null, ...c } : null;
      } catch {
        return null;
      }
    }

    function write() {
      try {
        if (cfg) storage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        else storage.removeItem(CONFIG_KEY);
      } catch {}
    }

    const isHolder = () => !!cfg && cfg.holder === cfg.device;
    const emit = () => onChange(status());

    function status() {
      if (!cfg) return { mode: 'off' };
      const connected = !!chan?.open;
      const info = { id: cfg.id, pending: cfg.pending, connected, offline: netError || (everConnected && !connected), connecting: !everConnected && !netError };
      if (fatal) return { ...info, mode: 'error', error: fatal };
      return { ...info, mode: isHolder() ? 'admin' : 'follower' };
    }

    async function call(method, path, body, auth = true) {
      const headers = {};
      if (body) headers['content-type'] = 'application/json';
      if (auth) headers.authorization = `Bearer ${cfg.token}`;
      const res = await fetchImpl(origin + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      let data = null;
      try {
        data = await res.json();
      } catch {}
      return { ok: res.ok, status: res.status, data, receivedAt: Date.now() };
    }

    function adopt(snapshot, receivedAt) {
      confirmedLibrary = structuredClone(libraryOf(snapshot.state));
      confirmedLibraryRev = snapshot.libraryRev ?? 0;
      libraryReady = true;
      cfg.rev = snapshot.rev;
      cfg.holder = snapshot.holder;
      cfg.pending = 0;
      write();
      if (snapshot.state) onAdopt(localize(snapshot, receivedAt));
    }

    function lose(snapshot, receivedAt) {
      const lost = cfg.pending;
      adopt(snapshot, receivedAt);
      onNotice({ kind: 'lost', lost });
    }

    function schedule(ms = debounceMs) {
      clearTimeout(timer);
      timer = setTimeout(flush, ms);
    }

    function retryLater() {
      retryDelay = Math.min(MAX_RETRY_MS, retryDelay ? retryDelay * 2 : retryMs);
      schedule(retryDelay);
    }

    async function flush() {
      clearTimeout(timer);
      timer = null;
      if (!cfg || !cfg.pending || inflight || fatal || !isHolder()) return;
      inflight = true;
      const id = cfg.id;
      const session = cfg;
      // Yeniden açılan cihazın bekleyen yerel değişiklikleri korunur; önce sunucuda
      // zaten bulunan kütüphane öğrenilir, böylece tamamı tekrar gönderilmez.
      if (!libraryReady && cfg.rev > 0) {
        let snapshot;
        try { snapshot = await call('GET', `/api/t/${id}/admin`); } catch {}
        if (cfg !== session || !isHolder()) { inflight = false; return emit(); }
        if (!snapshot?.ok) {
          inflight = false;
          if (snapshot && snapshot.status < 500) fatal = snapshot.data?.error || `http_${snapshot.status}`;
          else { netError = true; retryLater(); }
          return emit();
        }
        if (snapshot.data.holder && snapshot.data.holder !== cfg.device) {
          inflight = false;
          lose(snapshot.data, snapshot.receivedAt);
          return emit();
        }
        confirmedLibrary = structuredClone(libraryOf(snapshot.data.state));
        confirmedLibraryRev = snapshot.data.libraryRev ?? 0;
        libraryReady = true;
        cfg.rev = snapshot.data.rev;
        write();
      }
      const sent = cfg.pending;
      const { playerPool, archives, ...currentState } = getState();
      const sentLibrary = structuredClone(libraryOf(getState()));
      const patch = libraryBatch(libraryDelta(confirmedLibrary, sentLibrary));
      const acknowledgedLibrary = applyLibraryPatch(confirmedLibrary, patch);
      const moreLibrary = !!libraryDelta(acknowledgedLibrary, sentLibrary);
      let res = null;
      try {
        res = await call('PUT', `/api/t/${id}`, {
          device: cfg.device, baseRev: cfg.rev, sentAt: Date.now(), state: currentState,
          libraryProtocol: 1, ...(patch ? { library: patch } : {}),
        });
      } catch {}
      inflight = false;
      if (cfg !== session) return emit();
      if (!isHolder()) return emit();

      if (!res) {
        netError = true;
        retryLater();
      } else if (res.ok) {
        confirmedLibrary = acknowledgedLibrary;
        confirmedLibraryRev = res.data.libraryRev ?? 0;
        libraryReady = true;
        netError = false;
        retryDelay = 0;
        cfg.rev = res.data.rev;
        if (!moreLibrary) cfg.pending = Math.max(0, cfg.pending - sent);
        write();
        if (cfg.pending) schedule();
      } else if (res.status === 409 && res.data && (res.data.holder === cfg.device || res.data.holder == null)) {
        // Yönetim bizde ama sunucu bir sürüm önde: önceki gönderim ulaşmış, cevabı yolda kaybolmuş.
        netError = false;
        cfg.rev = res.data.rev;
        write();
        schedule(0);
      } else if (res.status === 409 && res.data) {
        netError = false;
        lose(res.data, res.receivedAt);
      } else if (res.status >= 500) {
        netError = true;
        retryLater();
      } else {
        netError = false;
        fatal = res.data?.error || `http_${res.status}`;
      }
      emit();
    }

    function onMessage(msg, receivedAt) {
      if (msg.type === 'deleted') {
        disconnect();
        fatal = 'not_found';
        if (cfg) { cfg.pending = 0; write(); }
        emit();
        return;
      }
      const session = cfg;
      if (!session || msg.rev < cfg.rev) return;
      // Yetki kaybı, özel arşivin indirilmesini beklemez.
      if (msg.holder != null && msg.holder !== cfg.device && isHolder()) {
        const lost = cfg.pending;
        cfg.holder = msg.holder;
        cfg.pending = 0;
        write();
        onNotice({ kind: 'lost', lost });
        emit();
      }
      messageQueue = messageQueue.then(async () => {
        if (cfg !== session || msg.rev < cfg.rev || (isHolder() && cfg.pending)) return;
        let snapshot = msg, at = receivedAt;
        if (!libraryReady || confirmedLibraryRev !== (msg.libraryRev ?? 0)) {
          const res = await call('GET', `/api/t/${cfg.id}/admin`);
          if (cfg !== session) return;
          if (!res.ok) {
            if (res.status === 401 || res.status === 404) { fatal = res.data?.error || `http_${res.status}`; emit(); return; }
            throw new Error('private_snapshot_failed');
          }
          snapshot = res.data;
          at = res.receivedAt;
        } else if (snapshot.state && confirmedLibrary) {
          snapshot = { ...snapshot, state: { ...snapshot.state, ...confirmedLibrary } };
        }
        if (cfg !== session || snapshot.rev < cfg.rev || (isHolder() && cfg.pending)) return;
        netError = false;
        clearTimeout(hydrateTimer);
        adopt(snapshot, at);
        emit();
      }).catch(() => {
        if (cfg !== session) return;
        netError = true;
        clearTimeout(hydrateTimer);
        hydrateTimer = setTimeout(() => onMessage(msg, receivedAt), retryMs);
        emit();
      });
    }

    // İzleyiciler skorun güncel olup olmadığını bu haberden anlar: gelmezse yönetici cihazı bağlı değildir.
    function beat() {
      if (isHolder()) chan?.send(JSON.stringify({ type: 'beat', device: cfg.device, token: cfg.token }));
    }

    function connect() {
      chan?.close();
      const url = `${origin.replace(/^http/, 'ws')}/api/t/${cfg.id}/ws`;
      chan = channel(url, {
        WebSocketImpl,
        onMessage,
        onStatus(isOpen) {
          if (isOpen) {
            everConnected = true;
            netError = false;
            beat();
            if (cfg?.pending) schedule(0);
          }
          emit();
        },
      });
      clearInterval(beatTimer);
      beatTimer = setInterval(beat, beatMs);
    }

    function disconnect() {
      chan?.close();
      chan = null;
      clearInterval(beatTimer);
      beatTimer = null;
      clearTimeout(timer);
      timer = null;
      netError = false;
      everConnected = false;
      fatal = null;
      retryDelay = 0;
      clearTimeout(hydrateTimer);
      hydrateTimer = null;
      confirmedLibrary = null;
      confirmedLibraryRev = null;
      libraryReady = false;
      messageQueue = Promise.resolve();
    }

    if (cfg) {
      connect();
      if (cfg.pending) schedule(0);
    }

    return {
      status,
      get config() {
        return cfg ? { ...cfg } : null;
      },

      changed() {
        if (!cfg || !isHolder()) return;
        cfg.pending = (cfg.pending || 0) + 1;
        write();
        schedule();
        emit();
      },

      async start() {
        const res = await call('POST', '/api/t', null, false);
        if (!res.ok || !res.data?.id) throw new Error(res.data?.error || `http_${res.status}`);
        const device = cfg?.device || randomDevice();
        disconnect();
        cfg = { id: res.data.id, token: res.data.adminToken, device, rev: 0, pending: 1, holder: device };
        write();
        connect();
        schedule(0);
        emit();
      },

      join(id, token) {
        if (cfg && cfg.id === id && cfg.token === token) return false;
        const device = cfg?.device || randomDevice();
        disconnect();
        cfg = { id, token, device, rev: 0, pending: 0, holder: null };
        write();
        connect();
        emit();
        return true;
      },

      async takeover() {
        if (!cfg) return;
        const res = await call('POST', `/api/t/${cfg.id}/takeover`, { device: cfg.device });
        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            fatal = res.data?.error || `http_${res.status}`;
            emit();
          }
          throw new Error(res.data?.error || `http_${res.status}`);
        }
        fatal = null;
        if (res.data.state) {
          adopt(res.data, res.receivedAt);
        } else {
          Object.assign(cfg, { holder: cfg.device, rev: res.data.rev, pending: 1 });
          write();
          schedule(0);
        }
        emit();
      },

      async remove() {
        if (!cfg) return;
        const res = await call('DELETE', `/api/t/${cfg.id}`);
        if (!res.ok && res.status !== 404) throw new Error(res.data?.error || `http_${res.status}`);
        disconnect();
        cfg = null;
        write();
        emit();
      },

      stop() {
        disconnect();
        cfg = null;
        write();
        emit();
      },

      wake() {
        if (!cfg) return;
        chan?.wake();
        if (cfg.pending) schedule(0);
      },

      flush,
    };
  }

  return { CONFIG_KEY, parseAdminHash, localize, channel, libraryDelta, admin };
});
