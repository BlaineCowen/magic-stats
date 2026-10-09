/** Parse API timestamps, including Polymarket's '2026-09-26 11:00:00+00'. */
export function parseTs(s?: string | null): number | null {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const t = Date.parse(iso.replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(t) ? null : t;
}

/** Local time plus UTC, so venue cutoffs can't be misread across time zones. */
export function fmtBoth(s?: string | null): string {
  const t = parseTs(s);
  if (t == null) return s ? `${s} (unparsed)` : "—";
  const d = new Date(t);
  return `${d.toLocaleString()} · ${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function fmtAgo(s?: string | null): string {
  const t = parseTs(s);
  if (t == null) return "—";
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fmtPct(v?: number | null): string {
  return v == null ? "—" : `${v.toFixed(2)}%`;
}

export function fmtPrice(v?: number | null): string {
  return v == null ? "—" : v.toFixed(3);
}

export function daysApart(a?: string | null, b?: string | null): number | null {
  const ta = parseTs(a);
  const tb = parseTs(b);
  return ta == null || tb == null ? null : Math.abs(ta - tb) / 86_400_000;
}
