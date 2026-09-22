"use client";

import { cn } from "@/components/polyhedge/cn";

export type Tab =
  | "live-sports"
  | "manual-arbs"
  | "discovery"
  | "weather"
  | "rt-middles"
  | "open-bets"
  | "settled"
  | "pnl";

const TABS: { id: Tab; label: string }[] = [
  { id: "live-sports", label: "Live Sports" },
  { id: "manual-arbs", label: "Manual Arbs" },
  { id: "discovery", label: "Discovery" },
  { id: "weather", label: "Weather" },
  { id: "rt-middles", label: "RT Middles" },
  { id: "open-bets", label: "Open Bets" },
  { id: "settled", label: "Settled" },
  { id: "pnl", label: "P&L" },
];

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
    </nav>
  );
}
