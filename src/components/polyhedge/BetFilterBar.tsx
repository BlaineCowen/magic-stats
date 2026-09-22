"use client";

import { cn } from "@/components/polyhedge/cn";
import type {
  BetFilterState,
  PnlMode,
} from "@/lib/polyhedge/useBetFilter";

interface Props {
  state: BetFilterState;
  set: (patch: Partial<BetFilterState>) => void;
  toggleSource: (src: string) => void;
  /** Sources to render chips for. Defaults to the 4 known engine sources. */
  availableSources?: string[];
  /** Total rows visible after filtering, for the count display. */
  visible?: number;
  /** Total rows before filtering. */
  total?: number;
}

const SOURCES: { id: string; label: string; chipClass: string }[] = [
  { id: "lead_lag",    label: "Sports",  chipClass: "ph-chip-sports" },
  { id: "manual_arbs", label: "Manual",  chipClass: "ph-chip-manual" },
  { id: "temp_arbs",   label: "Weather", chipClass: "ph-chip-weather" },
  { id: "rt_middles",  label: "RT",      chipClass: "ph-chip-rt" },
];

const PNL_MODES: { id: PnlMode; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "winners",  label: "Winners" },
  { id: "losers",   label: "Losers" },
];

export function BetFilterBar({
  state,
  set,
  toggleSource,
  availableSources,
  visible,
  total,
}: Props) {
  const allowed = availableSources
    ? SOURCES.filter((s) => availableSources.includes(s.id))
    : SOURCES;
  return (
    <div className="ph-filter-bar">
      {allowed.map((s) => (
        <button
          key={s.id}
          type="button"
          className={cn("ph-chip", s.chipClass)}
          data-active={state.sources.has(s.id)}
          onClick={() => toggleSource(s.id)}
        >
          {s.label}
        </button>
      ))}
      <input
        className="ph-input ph-search"
        placeholder="Search label or instrument…"
        value={state.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <div className="ph-segmented">
        {PNL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            data-active={state.pnl === m.id}
            onClick={() => set({ pnl: m.id })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {visible != null && total != null && (
        <span className="ph-filter-count">
          {visible === total ? `${total} rows` : `${visible} / ${total}`}
        </span>
      )}
    </div>
  );
}
