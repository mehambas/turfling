const MINUTE = 60 * 1000;
const STAGE_MINUTES = { league: 'leagueMin', playoff: 'playoffMin', final: 'finalMin' };

// Maç saati yöneticinin cihazına göre tutulur; clockOffset onu sunucu saatine çevirir.
// Anahtar maç süresini de içerir: süresi değişen maçta son dakika yeniden bildirilir.
export function timerAlerts(state, clockOffset) {
  const m = Array.isArray(state?.matches) ? state.matches.find((x) => x?.status === 'live') : null;
  if (!m) return { match: null, alerts: [] };
  const minutes = m.durationMin ?? state.settings?.[STAGE_MINUTES[m.stage]];
  const elapsed = m.elapsedMs ?? 0;
  if (!Number.isFinite(m.runningSince) || !Number.isFinite(minutes) || !Number.isFinite(elapsed) || !Number.isFinite(clockOffset)) {
    return { match: m.id, alerts: [] };
  }
  const end = m.runningSince + clockOffset + minutes * MINUTE - elapsed;
  const alert = (kind, at) => ({ kind, at, match: m.id, key: `${m.id}:${minutes}:${kind}` });
  const alerts = [alert('end', end)];
  if (minutes > 1) alerts.unshift(alert('last', end - MINUTE));
  return { match: m.id, alerts };
}

export function timerNotice(state, alert) {
  const m = Array.isArray(state?.matches) ? state.matches.find((x) => x?.id === alert.match) : null;
  if (m?.status !== 'live') return null;
  const name = (id) => (Array.isArray(state.teams) ? state.teams.find((t) => t?.id === id)?.name : null) ?? id;
  let home = 0;
  let away = 0;
  for (const g of Array.isArray(m.goals) ? m.goals : []) {
    if (g?.team === m.home) home++;
    else if (g?.team === m.away) away++;
  }
  return {
    title: alert.kind === 'last' ? 'Son 1 dakika' : 'Süre doldu',
    body: `${name(m.home)} ${home}–${away} ${name(m.away)}`,
    tag: `sure-${m.id}`,
  };
}
