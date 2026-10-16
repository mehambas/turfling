import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startWorker, sampleState, waitFor } from './helpers.js';

test('creation limit rejects excess requests with retry information; reading still works', async () => {
  const worker = await startWorker({ creationLimit: 2 });
  try {
    const created = [];
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${worker.base}/api/t`, { method: 'POST' });
      assert.equal(res.status, 201);
      created.push(await res.json());
    }
    const blocked = await fetch(`${worker.base}/api/t`, { method: 'POST' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '60');
    assert.equal((await blocked.json()).error, 'rate_limited');
    assert.equal((await fetch(`${worker.base}/api/t/${created[0].id}`)).status, 200);
  } finally { await worker.dispose(); }
});

test('only the admin may erase a tournament; existing sockets close and old links cannot read or write', async () => {
  const worker = await startWorker();
  let ws;
  try {
    const t = await (await fetch(`${worker.base}/api/t`, { method: 'POST' })).json();
    const url = `${worker.base}/api/t/${t.id}`;
    const headers = { authorization: `Bearer ${t.adminToken}`, 'content-type': 'application/json' };
    const body = JSON.stringify({ device: 'test-device-123', baseRev: 0, sentAt: Date.now(), state: sampleState() });
    assert.equal((await fetch(url, { method: 'PUT', headers, body })).status, 200);
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 401);
    assert.equal((await fetch(url, { method: 'DELETE', headers: { authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(url)).status, 200);
    const messages = [];
    ws = new WebSocket(url.replace(/^http/, 'ws') + '/ws');
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      messages.push(msg);
      if (msg.type === 'deleted') ws.close();
    });
    await waitFor(() => messages.length);
    const deleted = await fetch(url, { method: 'DELETE', headers });
    assert.equal(deleted.status, 200);
    await waitFor(() => messages.some((m) => m.type === 'deleted'));
    for (const suffix of ['', '/admin']) assert.equal((await fetch(url + suffix, { headers })).status, 404);
    assert.equal((await fetch(url, { method: 'PUT', headers, body })).status, 404);
    assert.equal((await fetch(url + '/takeover', { method: 'POST', headers, body: JSON.stringify({ device: 'test-device-123' }) })).status, 404);
  } finally { ws?.close(); await worker.dispose(); }
});

test('retention alarm erases inactive data even while admin heartbeats continue', async () => {
  const worker = await startWorker({ vars: { RETENTION_MS: 2500 } });
  let ws, heartbeat;
  try {
    const t = await (await fetch(`${worker.base}/api/t`, { method: 'POST' })).json();
    const url = `${worker.base}/api/t/${t.id}`;
    const headers = { authorization: `Bearer ${t.adminToken}`, 'content-type': 'application/json' };
    const device = 'retention-device';
    const body = (rev, state) => JSON.stringify({ device, baseRev: rev, sentAt: Date.now(), state });
    assert.equal((await fetch(url, { method: 'PUT', headers, body: body(0, sampleState()) })).status, 200);
    const messages = [];
    ws = new WebSocket(url.replace(/^http/, 'ws') + '/ws');
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      messages.push(msg);
      if (msg.type === 'deleted') ws.close();
    });
    await waitFor(() => messages.length);
    heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'beat', token: t.adminToken, device })); }, 150);
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal((await fetch(url, { method: 'PUT', headers, body: body(1, sampleState({ name: 'Changed' })) })).status, 200);
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(messages.some((m) => m.type === 'deleted'), false, 'a real change extends retention');
    // Identical writes and read-only access must not extend the deadline.
    assert.equal((await fetch(url, { method: 'PUT', headers, body: body(2, sampleState({ name: 'Changed' })) })).status, 200);
    assert.equal((await fetch(url + '/admin', { headers })).status, 200);
    await waitFor(() => messages.some((m) => m.type === 'deleted'), 'retention deletion broadcast', 2500);
    assert.equal((await fetch(url)).status, 404);
  } finally { clearInterval(heartbeat); ws?.close(); await worker.dispose(); }
});
