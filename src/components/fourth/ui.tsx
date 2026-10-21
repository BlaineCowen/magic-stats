"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Decision, OptionKey } from "@/lib/fourth/engine";
import { cn } from "@/lib/utils";

/** Plain-language building blocks shared by every view: answer first, detail on click. */

export const CHOICE: Record<OptionKey, string> = {
  go: "Go for it",
  fg: "Field goal",
  punt: "Punt",
};

export const CHOICE_COLOR: Record<OptionKey, string> = {
  go: "#2563eb",
  fg: "#d97706",
  punt: "#64748b",
};

/** How much the call matters, in words a casual fan reads without a legend. */
export const STRENGTH: Record<
  Decision["strength"],
  { label: string; cls: string }
> = {
  "toss-up": { label: "Coin flip", cls: "bg-gray-100 text-gray-700" },
  lean: { label: "Slight edge", cls: "bg-sky-100 text-sky-800" },
  strong: { label: "Clear call", cls: "bg-blue-100 text-blue-800" },
  "very strong": { label: "Big call", cls: "bg-indigo-100 text-indigo-800" },
  "no-brainer": { label: "Obvious", cls: "bg-violet-100 text-violet-800" },
};

export const chance = (p: number | null | undefined) =>
  p == null ? "–" : `${Math.round(p * 100)}%`;

/** "x out of 10" reads easier than a percentage for odds of a single play. */
export const outOf10 = (p: number) =>
  `${Math.max(0, Math.min(10, Math.round(p * 10)))} out of 10`;

export function StrengthTag({ strength }: { strength: Decision["strength"] }) {
  const s = STRENGTH[strength];
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.cls)}
    >
      {s.label}
    </span>
  );
}

/** A section that opens on click. Closed by default so the answer stays on top. */
export function Expand({
  label,
  children,
  defaultOpen = false,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md py-1 text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <ChevronDown
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
        {label}
      </button>
      {open && (
        <div id={id} className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export type ChanceRow = { key: OptionKey; wp: number };

/**
 * The page's one recurring picture: each choice's chance to win, side by side.
 * Marks the best choice and, when given, the one the team actually made.
 */
export function ChanceBars({
  options,
  best,
  actual,
  size = "md",
}: {
  options: ChanceRow[];
  best: OptionKey;
  actual?: OptionKey;
  size?: "sm" | "md";
}) {
  const order: OptionKey[] = ["go", "fg", "punt"];
  const rows = order
    .map((k) => options.find((o) => o.key === k))
    .filter((o): o is ChanceRow => !!o);
  return (
    <div className={cn("space-y-2", size === "sm" && "space-y-1.5")}>
      {rows.map((o) => {
        const isBest = o.key === best;
        return (
          <div
            key={o.key}
            className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3"
          >
            <span
              className={cn(
                "text-sm",
                isBest ? "font-semibold text-gray-900" : "text-gray-600",
              )}
            >
              {CHOICE[o.key]}
            </span>
            <div className="relative">
              <div
                className={cn(
                  "rounded-full bg-gray-100",
                  size === "sm" ? "h-2.5" : "h-3.5",
                )}
              >
                <div
                  className={cn(
                    "rounded-full",
                    size === "sm" ? "h-2.5" : "h-3.5",
                  )}
                  style={{
                    width: `${Math.max(2, o.wp * 100)}%`,
                    background: CHOICE_COLOR[o.key],
                    opacity: isBest ? 1 : 0.45,
                  }}
                />
              </div>
              <div className="mt-0.5 flex gap-2 text-[11px] leading-tight">
                {isBest && (
                  <span className="font-semibold text-emerald-700">
                    Best call
                  </span>
                )}
                {actual === o.key && (
                  <span className="font-semibold text-gray-700">
                    What they did
                  </span>
                )}
              </div>
            </div>
            <span
              className={cn(
                "text-right tabular-nums",
                isBest ? "font-semibold text-gray-900" : "text-gray-600",
              )}
            >
              {chance(o.wp)}
            </span>
          </div>
        );
      })}
      <div className="text-xs text-gray-500">
        Chance to win the game after each choice
      </div>
    </div>
  );
}

/** One-line verdict a casual fan can repeat: "Go for it. 58% to win, against 47% for the field goal." */
export function verdictLine(options: ChanceRow[], best: OptionKey): string {
  const b = options.find((o) => o.key === best)!;
  const next = options
    .filter((o) => o.key !== best)
    .sort((x, y) => y.wp - x.wp)[0];
  if (!next) return `${chance(b.wp)} chance to win.`;
  return `${chance(b.wp)} chance to win, against ${chance(next.wp)} for ${next.key === "go" ? "going for it" : `a ${CHOICE[next.key].toLowerCase()}`}.`;
}

/** Team names casual fans read, for the codes in play-by-play. */
export const TEAM_NAME: Record<string, string> = {
  ARI: "Cardinals",
  ATL: "Falcons",
  BAL: "Ravens",
  BUF: "Bills",
  CAR: "Panthers",
  CHI: "Bears",
  CIN: "Bengals",
  CLE: "Browns",
  DAL: "Cowboys",
  DEN: "Broncos",
  DET: "Lions",
  GB: "Packers",
  HOU: "Texans",
  IND: "Colts",
  JAX: "Jaguars",
  KC: "Chiefs",
  LA: "Rams",
  LAC: "Chargers",
  LV: "Raiders",
  MIA: "Dolphins",
  MIN: "Vikings",
  NE: "Patriots",
  NO: "Saints",
  NYG: "Giants",
  NYJ: "Jets",
  PHI: "Eagles",
  PIT: "Steelers",
  SEA: "Seahawks",
  SF: "49ers",
  TB: "Buccaneers",
  TEN: "Titans",
  WAS: "Commanders",
  OAK: "Raiders",
  SD: "Chargers",
  STL: "Rams",
};

/** "the Texans", or "the Ravens and Giants" for coaches who changed teams. */
export function teamPhrase(codes: string[]): string {
  const names = codes.map((c) => TEAM_NAME[c] ?? c);
  return `the ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`;
}
