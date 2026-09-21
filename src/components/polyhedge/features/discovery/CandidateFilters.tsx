import type { ArbCandidateStatus, ArbFilters } from "@/lib/polyhedge/types";

const STATUSES: (ArbCandidateStatus | "")[] = [
  "pending",
  "stale",
  "approved",
  "rejected",
  "expired",
  "",
];

export function CandidateFilters({
  value,
  onChange,
  seriesOptions,
}: {
  value: ArbFilters;
  onChange: (f: ArbFilters) => void;
  seriesOptions: string[];
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "8px 12px" }}>
      <label className="ph-muted-2">
        Status{" "}
        <select
          className="ph-input"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as ArbCandidateStatus | "" })}
        >
          {STATUSES.map((s) => (
            <option key={s === "" ? "all" : s} value={s}>
              {s === "" ? "all" : s}
            </option>
          ))}
        </select>
      </label>
      <label className="ph-muted-2">
        Series{" "}
        <select
          className="ph-input"
          value={value.series}
          onChange={(e) => onChange({ ...value, series: e.target.value })}
        >
          <option value="">all</option>
          {seriesOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="ph-muted-2">
        <input
          type="checkbox"
          checked={value.hideBlocked}
          onChange={(e) => onChange({ ...value, hideBlocked: e.target.checked })}
        />{" "}
        hide blocked
      </label>
    </div>
  );
}
