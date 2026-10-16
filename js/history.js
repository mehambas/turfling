(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tournament.js'), require('./views.js'));
  else root.HistoryViews = factory(root.Tournament, root.Views);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, V) {
  'use strict';
  const { esc } = V;
  const date = (t) => esc(t.settings.plannedDate || (t.matches.find((m) => m.startedAt)?.startedAt
    ? new Date(t.matches.find((m) => m.startedAt).startedAt).toLocaleDateString('tr-TR') : 'Tarih belirtilmedi'));
  const playerButton = (p) => `<button class="history-link" data-action="history-player" data-id="${esc(p.id)}">${esc(p.name)}</button>`;
  const metrics = (items) => `<div class="history-metrics">${items.map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div>`;
  function statsTable(players) {
    return `<div class="history-scroll"><table class="history-table"><thead><tr><th>Oyuncu</th><th>Turnuva</th><th>Maç</th><th title="Galibiyet">G</th><th title="Beraberlik">B</th><th title="Mağlubiyet">M</th><th>Gol</th><th>Gol / maç</th></tr></thead><tbody>${players.map((p) => `<tr><td>${playerButton(p)}</td><td>${p.tournaments}</td><td>${p.played}</td><td>${p.won}</td><td>${p.drawn}</td><td>${p.lost}</td><td><strong>${p.goals}</strong></td><td>${p.played ? (p.goals / p.played).toFixed(2) : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function render(state, ui) {
    if (ui.historyTournament) {
      const t = ui.historyTournament === state.id ? state : state.archives.find((t) => t.id === ui.historyTournament);
      if (t) return tournament(t);
    }
    const stats = T.historyStats(state);
    if (ui.historyPlayer) {
      const p = stats.players.find((p) => p.id === ui.historyPlayer);
      if (p) return profile(state, stats, p);
    }
    const list = [...state.archives].reverse();
    return `<div class="page-head"><div><h1 class="page-title">Geçmiş</h1><p class="page-sub">Takımlar değişir, oyuncuların geçmişi birikir.</p></div><button class="btn btn-primary" data-action="new-tournament">Yeni turnuva</button></div>
      <div class="stack">${metrics([[stats.tournaments, 'Tamamlanan turnuva'], [stats.matches, 'Oynanan maç'], [stats.goals, 'Toplam gol'], [stats.players.filter((p) => p.played).length, 'Oynayan kişi']])}
      <section class="card setup-card"><h2 class="card-title">Turnuvalar</h2>
      ${state.started && !list.some((t) => t.id === state.id) ? `<div class="history-item"><div><strong>${esc(state.name)}</strong><p class="sc-hint">${date(state)} · Mevcut turnuva</p></div><button class="btn btn-sm" data-action="history-tournament" data-id="${esc(state.id)}">İncele</button><button class="btn btn-sm" data-action="archive-tournament">Arşivle</button></div>` : ''}
      ${list.map((t) => { const actual = t.id === state.id ? state : t; const champ = actual.teams.find((x) => x.id === T.champion(actual)); return `<div class="history-item"><div><strong>${esc(t.name)}</strong><p class="sc-hint">${date(t)} · ${t.players.length} kişi · ${esc(champ?.name || 'Şampiyon belirlenmedi')}</p></div><button class="btn btn-sm" data-action="history-tournament" data-id="${esc(t.id)}">İncele</button></div>`; }).join('')}
      ${!list.length && !state.started ? '<p class="sc-hint">İlk turnuvanızı tamamlayınca burada arşivleyebilirsiniz.</p>' : ''}</section>
      <section class="card setup-card"><h2 class="card-title">Oyuncuların toplamları</h2><p class="sc-hint">Mevcut turnuvanın biten maçları da dahildir. G / B / M normal süre sonucudur; seri penaltılar gol sayılmaz.</p>
      ${stats.players.length ? statsTable(stats.players.sort((a, b) => b.goals - a.goals || b.won - a.won || a.name.localeCompare(b.name, 'tr'))) : '<p class="sc-hint">Oyuncu havuzu henüz boş.</p>'}
      ${stats.unknownGoals ? `<p class="sc-foot">${stats.unknownGoals} golün sahibi bilinmiyor; bu goller yalnız genel toplama dahildir.</p>` : ''}</section></div>`;
  }
  function profile(state, stats, p) {
    const pairs = stats.pairs.filter((r) => r.ids.includes(p.id)).sort((a, b) => b.together - a.together || b.against - a.against);
    const records = new Map(state.archives.map((t) => [t.id, t]));
    if (state.started) records.set(state.id, state);
    return `<div class="page-head"><div><button class="btn btn-sm" data-action="history-back">← Geçmiş</button><h1 class="page-title">${esc(p.name)}</h1></div>${state.playerPool.length > 1 ? `<button class="btn btn-sm" data-action="merge-player" data-id="${p.id}">Mükerrer kaydı birleştir</button>` : ''}</div><div class="stack">
      ${metrics([[p.tournaments, 'Turnuva'], [p.played, 'Maç'], [p.won, 'Galibiyet'], [p.goals, 'Gol']])}
      <section class="card setup-card"><p>${p.drawn} beraberlik · ${p.lost} mağlubiyet · ${p.penaltyWins} penaltıyla kazanılan maç · ${p.ownGoals} kendi kalesine gol</p><p class="sc-hint">Galibiyet oranı: ${p.played ? Math.round(p.won / p.played * 100) : 0}% · Maç başına gol: ${p.played ? (p.goals / p.played).toFixed(2) : '–'}</p></section>
      <section class="card setup-card"><h2 class="card-title">Kimlerle oynadı?</h2><div class="history-scroll"><table class="history-table"><thead><tr><th>Oyuncu</th><th>Aynı takımda turnuva</th><th>Birlikte maç</th><th>Rakip maç</th><th>Karşılıklı G / B / M</th></tr></thead><tbody>${pairs.map((r) => {
        const index = r.ids.indexOf(p.id), other = stats.players.find((x) => x.id === r.ids[1 - index]);
        return `<tr><td>${other ? playerButton(other) : 'Bilinmeyen oyuncu'}</td><td>${r.tournaments}</td><td>${r.together}</td><td>${r.against}</td><td>${r.won[index]} / ${r.drawn} / ${r.won[1 - index]}</td></tr>`;
      }).join('') || '<tr><td colspan="5">Henüz eşleşme geçmişi yok.</td></tr>'}</tbody></table></div></section>
      <section class="card setup-card"><h2 class="card-title">Katıldığı turnuvalar</h2>${[...records.values()].reverse().filter((t) => t.players.some((x) => x.id === p.id)).map((t) => `<div class="history-item"><span>${esc(t.name)} · ${date(t)}</span><button class="btn btn-sm" data-action="history-tournament" data-id="${esc(t.id)}">İncele</button></div>`).join('') || '<p class="sc-hint">Henüz turnuvaya katılmadı.</p>'}</section></div>`;
  }
  function tournament(t) {
    const views = V.create(() => t);
    return `<div class="page-head"><div><button class="btn btn-sm" data-action="history-back">← Geçmiş</button><h1 class="page-title">${esc(t.name)}</h1><p class="page-sub">${date(t)} · ${t.players.length} katılımcı</p></div></div><div class="stack">
      ${t.matches.some((m) => m.lineupsInferred) ? '<p class="page-note">İlk kayıtlardaki maç kadroları turnuva kadrosundan alındı. İstisna varsa maçın “Kadro / düzeltme” düğmesinden değiştirebilirsiniz.</p>' : ''}
      <section class="card setup-card"><h2 class="card-title">O günkü takımlar</h2><div class="history-teams">${t.teams.map((team) => `<div><h3>${esc(team.name)}</h3><p>${team.playerIds.map((id) => esc(t.players.find((p) => p.id === id)?.name || 'Bilinmeyen')).join(', ')}</p></div>`).join('')}</div></section>
      ${views.renderStandings()}
      ${t.matches.filter((m) => m.status === 'done').map((m) => `<section class="card setup-card">${views.renderMatchSummary(m.id)}<button class="btn btn-sm" data-action="history-match" data-tournament="${esc(t.id)}" data-id="${esc(m.id)}">Kadro / düzeltme</button></section>`).join('')}
      </div>`;
  }
  function matchEditor(t, m, readonly, error = '') {
    const lineups = T.matchLineups(t, m);
    const teamName = (id) => t.teams.find((x) => x.id === id)?.name || id;
    const options = (selected, ownGoal = false) => `<option value="">Bilinmiyor</option>${t.players.map((p) => `<option value="${esc(p.id)}"${p.id === selected && !ownGoal ? ' selected' : ''}>${esc(p.name)}</option><option value="og:${esc(p.id)}"${p.id === selected && ownGoal ? ' selected' : ''}>${esc(p.name)} (k.k.)</option>`).join('')}`;
    const s = T.score(m);
    return `<div class="dialog-body history-editor"><h2>${esc(teamName(m.home))} ${s.home} – ${s.away} ${esc(teamName(m.away))}</h2><p class="sc-hint">Kadrolar otomatik gelir. Sadece bu maçtaki değişiklikleri belirtin. Oyuncu maçın bir bölümünde bile oynadıysa kadroda kalsın.</p>
      <h3>Maç kadrosu</h3><div class="history-roster">${t.players.map((p) => `<label><span>${esc(p.name)}</span><select data-field="history-lineup" data-id="${esc(p.id)}" ${readonly ? 'disabled' : ''}><option value="">Oynamadı</option>${[m.home, m.away].map((id) => `<option value="${id}"${lineups[id]?.includes(p.id) ? ' selected' : ''}>${esc(teamName(id))}</option>`).join('')}</select></label>`).join('')}</div>
      <h3>Goller</h3><p class="sc-hint">Gol sahibini ve kendi kalesine gol bilgisini düzeltebilirsiniz.</p>
      ${m.goals.map((g) => `<div class="history-goal"><span>${esc(teamName(g.team))}</span><select aria-label="Gol sahibi" data-field="history-scorer" data-id="${esc(g.id)}" ${readonly ? 'disabled' : ''}>${options(g.playerId, g.ownGoal)}</select>${!readonly && m.status === 'done' ? `<button class="btn btn-sm" data-action="history-goal-remove" data-id="${esc(g.id)}" aria-label="Golü sil">Sil</button>` : ''}</div>`).join('') || '<p class="sc-hint">Gol yok.</p>'}
      ${!readonly && m.status === 'done' ? `<div class="btn-row">${[m.home, m.away].map((id) => `<button class="btn btn-sm" data-action="history-goal-add" data-team="${id}">${esc(teamName(id))} + gol</button>`).join('')}</div>` : ''}
      ${m.status === 'done' && m.stage !== 'league' && s.home === s.away ? `<h3>Seri penaltılar</h3>${['home', 'away'].map((side) => `<label class="history-goal"><span>${esc(teamName(m[side]))}</span><input type="number" min="0" step="1" data-field="history-pens" data-side="${side}" value="${m.pens?.[side] ?? ''}" ${readonly ? 'disabled' : ''}></label>`).join('')}` : ''}
      ${error ? `<p class="sc-foot is-warn" role="alert">${esc(error)}</p>` : ''}
      <div class="dialog-actions"><button class="btn" data-action="dialog-cancel">${readonly ? 'Kapat' : 'Vazgeç'}</button>${!readonly ? '<button class="btn btn-primary" data-action="history-save">Kaydet</button>' : ''}</div></div>`;
  }
  return { render, matchEditor, statsTable };
});
