import { fileURLToPath } from 'node:url';
import { unstable_startWorker } from 'wrangler';

const config = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

export async function startWorker() {
  const worker = await unstable_startWorker({
    config,
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
