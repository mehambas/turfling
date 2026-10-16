const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tournament.js');
const demo = require('../js/demo.js');

test('demo stays off workers.dev, even with query override; local preview is explicit', () => {
  assert.equal(demo.available({ hostname: 'hali-saha.mehambas91.workers.dev', search: '?demo=1' }), false);
  assert.equal(demo.available({ hostname: 'localhost', search: '' }), false);
  assert.equal(demo.available({ hostname: 'localhost', search: '?demo=1' }), true);
  assert.equal(demo.available({ hostname: 'turfling.hamzabasaran.com', search: '' }), true);
});

test('demo has valid rosters, results and scorers, and cannot replace existing data', () => {
  const state = demo.create();
  assert.equal(T.isValidState(state), true);
  assert.equal(state.players.length, 15);
  assert.equal(state.matches.filter((m) => m.status === 'done').length, 3);
  assert.equal(T.topScorers(state).list.reduce((n, p) => n + p.goals, 0), 8);
  assert.equal(demo.canLoad(T.createState(), false), true);
  assert.equal(demo.canLoad(T.createState(), true), false);
  assert.equal(demo.canLoad(state, false), false);
  for (const field of ['players', 'playerPool', 'archives', 'matches']) {
    const existing = T.createState();
    existing[field].push({ id: 'existing' });
    assert.equal(demo.canLoad(existing, false), false);
  }
});
