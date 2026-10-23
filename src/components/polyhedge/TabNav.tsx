"use client";

import { cn } from "@/components/polyhedge/cn";

export type Tab =
  | "overview"
  | "live-sports"
  | "manual-arbs"
  | "discovery"
  | "weather"
  | "rt-middles"
  | "open-bets"
  | "settled"
  | "pnl"
  | "maker";

// Main tabs first; the older strategies (stopped, paper or rarely used) sit after a divider, dimmed.
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "maker", label: "Maker Bot" },
  { id: "pnl", label: "P&L" },
  { id: "manual-arbs", label: "Arbs" },
  { id: "discovery", label: "Discovery" },
];
const OLDER: { id: Tab; label: string }[] = [
  { id: "open-bets", label: "Open Bets" },
  { id: "settled", label: "Settled" },
  { id: "live-sports", label: "Live Sports" },
  { id: "rt-middles", label: "RT Middles" },
  { id: "weather", label: "Weather" },
];
export const ALL_TABS: Tab[] = [...TABS, ...OLDER].map((t) => t.id);

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
}

export function TabNav({ active, onChange }: Props) {
  return (
    <nav className="ph-tabs" style={{ padding: "0 16px" }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cn("ph-tab", active === t.id && "ph-active")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <span className="ph-tab-divider" aria-hidden />
      {OLDER.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cn("ph-tab", "ph-tab-old", active === t.id && "ph-active")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
