(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tournament.js'));
  else root.TournamentDemo = factory(root.Tournament);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';
  // Add the approved portfolio hostname here after the product name is chosen.
  const PORTFOLIO_HOSTS = [];
  function available(location) {
    return PORTFOLIO_HOSTS.includes(location.hostname) ||
      (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('demo') === '1');
  }
  function canLoad(state, connected) {
    return !connected && !state.started && !state.players.length && !state.playerPool.length &&
      !state.archives.length && !state.matches.length && state.teams.every((t) => !t.playerIds.length);
  }
  function create() {
    const state = T.createState();
    state.name = 'Örnek Turnuva';
    T.addPlayers(state, Array.from({ length: 15 }, (_, i) => `Örnek Oyuncu ${i + 1}`));
    state.players.forEach((p, i) => { p.pot = Math.floor(i / 3); p.goalkeeper = i < 3; });
    T.syncPool(state);
    T.applyDraw(state);
    state.matches = T.generateMatches(state.settings);
    state.started = true;
    const start = Date.now() - 60 * T.MINUTE;
    [[2, 1], [1, 1], [3, 0]].forEach(([home, away], i) => {
      const match = state.matches[i];
      const at = start + i * 15 * T.MINUTE;
      T.startMatch(state, match, at);
      for (const [teamId, count] of [[match.home, home], [match.away, away]]) {
        const team = state.teams.find((t) => t.id === teamId);
        for (let j = 0; j < count; j++) T.setScorer(T.addGoal(match, teamId, at + (j + 2) * T.MINUTE), team.playerIds[j % team.playerIds.length]);
      }
      T.finishMatch(match, null, at + state.settings.leagueMin * T.MINUTE);
    });
    return state;
  }
  return { available, canLoad, create };
});
