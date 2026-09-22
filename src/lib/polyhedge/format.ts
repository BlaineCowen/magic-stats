export type Sign = "pos" | "neg" | "neu" | "dim";

export function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(2);
}

export function pct(v: number | null | undefined, places = 1): string {
  if (v == null) return "—";
  return v.toFixed(places) + "%";
}

export function ago(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return seconds.toFixed(0) + "s";
  if (seconds < 3600) return (seconds / 60).toFixed(1) + "m";
  return (seconds / 3600).toFixed(1) + "h";
}

export function sign(v: number | null | undefined): Sign {
  if (v == null) return "dim";
  if (v > 0) return "pos";
  if (v < 0) return "neg";
  return "neu";
}

export function signedPct(v: number | null | undefined, places = 1): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(places) + "%";
}

export function dollars(v: number | null | undefined, places = 2): string {
  if (v == null) return "—";
  return "$" + v.toFixed(places);
}

export function daysToClose(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days < 1) return (days * 24).toFixed(1) + "h";
  if (days < 30) return days.toFixed(1) + "d";
  if (days < 365) return (days / 30).toFixed(1) + "mo";
  return (days / 365).toFixed(1) + "y";
}

export function combinedCostClass(
  combined: number | null | undefined,
): string {
  if (combined == null) return "";
  if (combined < 1.0) return "ph-cost-good";
  if (combined < 1.05) return "ph-cost-warn";
  return "ph-cost-bad";
}

export function clsForSign(v: number | null | undefined): string {
  switch (sign(v)) {
    case "pos":
      return "ph-pos";
    case "neg":
      return "ph-neg";
    case "neu":
      return "ph-text";
    default:
      return "ph-muted";
  }
}

export function statusClass(status: string | null | undefined): string {
  switch (status) {
    case "settled":
      return "ph-pos";
    case "skipped":
    case "abandoned":
      return "ph-muted";
    case "open":
      return "ph-warn";
    case "pending":
      return "ph-accent-strong";
    case "error":
      return "ph-neg";
    default:
      return "ph-muted";
  }
}

export function tempRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low == null && high != null) return `≤${high}°`;
  if (high == null && low != null) return `≥${low}°`;
  if (low != null && high != null) return `${low}-${high}°`;
  return "?";
}

export function formatRunAt(
  runAt: string | null | undefined,
): string | null {
  if (!runAt) return null;
  const d = new Date(runAt + "Z");
  if (Number.isNaN(d.getTime())) return null;
  return "Run " + d.toLocaleString();
}

export function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function fmt3(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(3);
}
