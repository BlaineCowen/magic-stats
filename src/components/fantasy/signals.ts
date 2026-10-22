import type { Projection } from "@/lib/nfl/fantasy";

export type Signal = { text: string; good: boolean };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The plain-English reasons a player is on the breakout list, from the same
 * numbers the model sees. Thresholds are "worth mentioning", not model cutoffs.
 */
export function signals(p: Projection): Signal[] {
  const out: Signal[] = [];
  if (p.xfp_l3 != null && p.xfp_pg != null && p.xfp_l3 - p.xfp_pg >= 1.5)
    out.push({
      text: `Usage up: ${p.xfp_l3.toFixed(1)} expected pts a game over the last 3, ${p.xfp_pg.toFixed(1)} for the season`,
      good: true,
    });
  if (p.luck_pg != null && p.luck_pg <= -2)
    out.push({
      text: `Unlucky: scoring ${Math.abs(p.luck_pg).toFixed(1)} a game under what his usage is worth`,
      good: true,
    });
  if (p.snap_l3 != null && p.snap_pct != null && p.snap_l3 - p.snap_pct >= 0.08)
    out.push({ text: `Snaps up to ${pct(p.snap_l3)}`, good: true });
  if (
    p.tgt_share_l3 != null &&
    p.tgt_share != null &&
    p.tgt_share_l3 - p.tgt_share >= 0.04
  )
    out.push({
      text: `Target share up to ${pct(p.tgt_share_l3)}`,
      good: true,
    });
  if (
    p.car_share_l3 != null &&
    p.car_share != null &&
    p.car_share_l3 - p.car_share >= 0.08
  )
    out.push({ text: `Carry share up to ${pct(p.car_share_l3)}`, good: true });
  if ((p.vacated_tgt ?? 0) >= 0.1)
    out.push({
      text: `${pct(p.vacated_tgt!)} of the team's targets open up with teammates out`,
      good: true,
    });
  if ((p.vacated_car ?? 0) >= 0.2)
    out.push({
      text: `${pct(p.vacated_car!)} of the team's carries open up with teammates out`,
      good: true,
    });
  if (p.separation != null && p.separation >= 3.2)
    out.push({
      text: `Gets open: ${p.separation.toFixed(1)} yards of separation`,
      good: true,
    });
  if (p.yac_oe != null && p.yac_oe >= 1)
    out.push({
      text: `+${p.yac_oe.toFixed(1)} yards after catch over expected`,
      good: true,
    });
  if (p.ryoe_att != null && p.ryoe_att >= 0.4)
    out.push({
      text: `+${p.ryoe_att.toFixed(1)} rush yards over expected per carry`,
      good: true,
    });
  if ((p.implied_total ?? 0) >= 26)
    out.push({
      text: `Team expected to score ${p.implied_total!.toFixed(1)}`,
      good: true,
    });
  if (p.years_exp != null && p.years_exp <= 1)
    out.push({
      text: p.years_exp === 0 ? "Rookie" : "Second year",
      good: true,
    });
  if (!p.indoor && (p.wind_mph ?? 0) >= 15)
    out.push({
      text: `Windy: ${Math.round(p.wind_mph!)} mph forecast`,
      good: false,
    });
  return out;
}

export const fmtPct = (v: number | null) =>
  v == null ? "–" : `${Math.round(v * 100)}%`;

export const matchup = (p: Projection) => `${p.home ? "vs" : "@"} ${p.opp}`;
