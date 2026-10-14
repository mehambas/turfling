const name = (list, id) => (Array.isArray(list) ? list.find((x) => x?.id === id)?.name : null);

// Yalnız canlı maçta yeni çıkan goller bildirilir; bitmiş bir maçın düzeltilmesi ya da yayının ilk hâli bildirim değildir.
export function goalNotices(before, after) {
  if (!before) return [];
  const known = new Set(before.matches.flatMap((m) => (Array.isArray(m?.goals) ? m.goals.map((g) => g?.id) : [])));
  const notices = [];
  for (const m of after.matches) {
    if (m?.status !== 'live' || !Array.isArray(m.goals)) continue;
    let home = 0;
    let away = 0;
    for (const g of m.goals) {
      if (!g?.team || (g.team !== m.home && g.team !== m.away)) continue;
      if (g.team === m.home) home++;
      else away++;
      if (known.has(g.id)) continue;
      const player = name(after.players, g.playerId);
      const scorer = player && g.ownGoal ? `${player} (kendi kalesine)` : player;
      const line = `${name(after.teams, m.home) ?? m.home} ${home}–${away} ${name(after.teams, m.away) ?? m.away}`;
      notices.push({ title: `Gol! ${name(after.teams, g.team) ?? g.team}`, body: scorer ? `${scorer} · ${line}` : line });
    }
  }
  return notices;
}

// Canlıyken biten maç bildirilir; iptal edilen ya da sonradan düzeltilen maç değil.
// Final bir kazananla bittiyse iki bildirim yerine yalnız şampiyon bildirilir.
export function resultNotices(before, after) {
  if (!before) return [];
  const wasLive = new Set(before.matches.filter((m) => m?.status === 'live').map((m) => m.id));
  const team = (id) => name(after.teams, id) ?? id;
  const notices = [];
  for (const m of after.matches) {
    if (m?.status !== 'done' || !wasLive.has(m.id) || !m.home || !m.away) continue;
    let home = 0;
    let away = 0;
    for (const g of Array.isArray(m.goals) ? m.goals : []) {
      if (g?.team === m.home) home++;
      else if (g?.team === m.away) away++;
    }
    const pens = Number.isFinite(m.pens?.home) && Number.isFinite(m.pens?.away) ? m.pens : null;
    const line = `${team(m.home)} ${home}–${away} ${team(m.away)}${pens ? ` · pen. ${pens.home}–${pens.away}` : ''}`;
    const [a, b] = home !== away || !pens ? [home, away] : [pens.home, pens.away];
    const winner = a > b ? m.home : b > a ? m.away : null;
    if (m.stage === 'final' && winner) notices.push({ title: `Şampiyon: ${team(winner)}`, body: `Final · ${line}` });
    else notices.push({ title: 'Maç bitti', body: line });
  }
  return notices;
}
