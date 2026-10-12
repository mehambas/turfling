import { fileURLToPath } from 'node:url';
import { unstable_startWorker } from 'wrangler';

const config = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

export async function startWorker({ presenceMs } = {}) {
  const worker = await unstable_startWorker({
    config,
    bindings: presenceMs ? { PRESENCE_MS: { type: 'plain_text', value: String(presenceMs) } } : undefined,
    dev: { server: { port: 0 }, inspector: false, persist: false, logLevel: 'none', watch: false },
  });
  const base = String(await worker.url).replace(/\/$/, '');
  return { base, dispose: () => worker.dispose() };
}

export const sampleState = (extra = {}) => ({
  version: 1,
  name: 'Test',
  players: [{ id: 'p1', name: 'Ali' }],
  teams: [
    { id: 'A', name: 'Kırmızılar', color: 'red', playerIds: ['p1'] },
    { id: 'B', name: 'Maviler', color: 'blue', playerIds: [] },
    { id: 'C', name: 'Sarılar', color: 'yellow', playerIds: [] },
  ],
  settings: {},
  started: true,
  matches: [],
  lots: {},
  ...extra,
});

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

export async function waitFor(check, label = 'koşul', timeout = 4000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Zaman aşımı: ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}
