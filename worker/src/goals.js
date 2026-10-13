// Yalnız canlı maçta yeni çıkan goller bildirilir; bitmiş bir maçın düzeltilmesi ya da yayının ilk hâli bildirim değildir.
export function goalNotices(before, after) {
  if (!before) return [];
  const known = new Set(before.matches.flatMap((m) => (Array.isArray(m?.goals) ? m.goals.map((g) => g?.id) : [])));
  const name = (list, id) => (Array.isArray(list) ? list.find((x) => x?.id === id)?.name : null);
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
