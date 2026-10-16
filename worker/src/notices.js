import I18n from '../../js/i18n.js';
import Tournament from '../../js/tournament.js';

const name = (list, id) => (Array.isArray(list) ? list.find((x) => x?.id === id)?.name : null);

// Yalnız canlı maçta yeni çıkan goller bildirilir; bitmiş bir maçın düzeltilmesi ya da yayının ilk hâli bildirim değildir.
export function goalNotices(before, after, lang = 'tr') {
  if (!before) return [];
  if (before.id && after.id && before.id !== after.id) return [];
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
      const scorer = player && g.ownGoal ? I18n.translate(lang, '{player} (kendi kalesine)', { player }) : player;
      const line = `${name(after.teams, m.home) ?? m.home} ${home}–${away} ${name(after.teams, m.away) ?? m.away}`;
      notices.push({ title: I18n.translate(lang, 'Gol! {team}', { team: name(after.teams, g.team) ?? g.team }), body: scorer ? `${scorer} · ${line}` : line });
    }
  }
  return notices;
}

// Final yoksa şampiyon lig bitince ya da eşitlik kurayla çözülünce belli olur.
function leagueChampion(state) {
  try {
    if (state?.settings?.finalEnabled !== false) return null;
    const s = Tournament.migrate(state);
    const id = Tournament.champion(s);
    return id ? { id, pts: Tournament.computeStandings(s, { includeLive: false }).rows[0].pts } : null;
  } catch {
    return null;
  }
}

// Canlıyken biten maç bildirilir; iptal edilen ya da sonradan düzeltilen maç değil.
// Final bir kazananla bittiyse iki bildirim yerine yalnız şampiyon bildirilir; final yoksa ligin son maçı için de öyle.
export function resultNotices(before, after, lang = 'tr') {
  if (!before) return [];
  if (before.id && after.id && before.id !== after.id) return [];
  const wasLive = new Set(before.matches.filter((m) => m?.status === 'live').map((m) => m.id));
  const team = (id) => name(after.teams, id) ?? id;
  const champ = leagueChampion(before) ? null : leagueChampion(after);
  let leagueLine = null;
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
    const line = `${team(m.home)} ${home}–${away} ${team(m.away)}${pens ? I18n.translate(lang, ' · pen. {home}–{away}', pens) : ''}`;
    const [a, b] = home !== away || !pens ? [home, away] : [pens.home, pens.away];
    const winner = a > b ? m.home : b > a ? m.away : null;
    if (m.stage === 'final' && winner) notices.push({ title: I18n.translate(lang, 'Şampiyon: {team}', { team: team(winner) }), body: I18n.translate(lang, 'Final · {line}', { line }) });
    else if (champ && m.stage === 'league') leagueLine = line;
    else notices.push({ title: I18n.translate(lang, 'Maç bitti'), body: line });
  }
  if (champ) {
    const standing = I18n.translate(lang, 'Ligi {pts} puanla birinci bitirdi', { pts: champ.pts });
    notices.push({
      title: I18n.translate(lang, 'Şampiyon: {team}', { team: team(champ.id) }),
      body: leagueLine ? I18n.translate(lang, '{standing} · Son maç: {line}', { standing, line: leagueLine }) : standing,
    });
  }
  return notices;
}
