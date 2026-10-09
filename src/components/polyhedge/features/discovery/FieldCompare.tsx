import type { ReactNode } from "react";
import type { ArbKalshiSnapshot, ArbPolySnapshot } from "@/lib/polyhedge/types";
import { daysApart, fmtBoth, fmtPrice } from "./format";

const norm = (s?: string | null) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Row = { label: string; k: ReactNode; p: ReactNode; mismatch?: boolean };

export function FieldCompare({ k, p }: { k: ArbKalshiSnapshot; p: ArbPolySnapshot }) {
  const gap = daysApart(k.expected_expiration_time ?? k.close_time, p.end_date);
  const start = p.game_start_time ?? p.event_start_time ?? null;
  const sources = (k.settlement_sources ?? [])
    .map((s) => s.name ?? s.url ?? "")
    .filter((s) => s !== "");
  const rows: Row[] = [
    {
      label: "Event",
      k: `${k.event_title ?? ""} ${k.event_sub_title ?? ""}`.trim(),
      p: p.event_title ?? "—",
    },
    {
      label: "Outcome",
      k: k.outcome_label,
      p: p.outcome_label,
      mismatch: norm(k.outcome_label) !== norm(p.outcome_label),
    },
    { label: "Polymarket question", k: "—", p: p.question ?? "—" },
    {
      label: "Resolves by",
      k: (
        <>
          {fmtBoth(k.expected_expiration_time)}
          <div className="ph-muted-2">close {fmtBoth(k.close_time)}</div>
        </>
      ),
      p: fmtBoth(p.end_date),
      mismatch: gap != null && gap > 2,
    },
    {
      label: "Live event start",
      k: "— (Kalshi publishes the expected finish, not the start)",
      p: start ? (
        <>
          {fmtBoth(start)}
          {p.clear_book_on_start ? (
            <div className="ph-warn">Polymarket clears its order book at start</div>
          ) : null}
        </>
      ) : (
        "none listed"
      ),
      mismatch: start != null,
    },
    {
      label: "Live delay",
      k: "—",
      p: p.seconds_delay ? `${p.seconds_delay}s secondsDelay` : "none",
      mismatch: Boolean(p.seconds_delay),
    },
    {
      label: "Resolution source",
      k: sources.length > 0 ? sources.join(", ") : "none named",
      p:
        p.resolution_source === undefined || p.resolution_source === ""
          ? "none named"
          : p.resolution_source,
    },
    {
      label: "Exclusive outcomes",
      k: `mutually_exclusive = ${String(k.mutually_exclusive ?? "?")}`,
      p: `negRisk = ${String(p.neg_risk ?? "?")}`,
      mismatch:
        k.mutually_exclusive != null &&
        p.neg_risk != null &&
        Boolean(k.mutually_exclusive) !== Boolean(p.neg_risk),
    },
    {
      label: "Early close",
      k: k.can_close_early ? (k.early_close_condition ?? "yes") : "no",
      p: "—",
    },
    {
      label: "Instrument",
      k: k.market_ticker,
      p: (
        <span className="ph-muted-2">
          cond {p.condition_id?.slice(0, 12)}… · YES {p.yes_token_id?.slice(0, 10)}… · NO{" "}
          {p.no_token_id?.slice(0, 10)}…
        </span>
      ),
    },
    {
      label: "Top of book (ask)",
      k: `YES ${fmtPrice(k.yes_ask)} / NO ${fmtPrice(k.no_ask)}`,
      p: `YES ${fmtPrice(p.yes_ask)} / NO ${fmtPrice(p.no_ask)}`,
    },
  ];
  return (
    <table className="ph-compare">
      <thead>
        <tr>
          <th />
          <th>Kalshi</th>
          <th>Polymarket</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={r.mismatch ? "ph-mismatch" : undefined}>
            <th>{r.label}</th>
            <td>{r.k}</td>
            <td>{r.p}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
