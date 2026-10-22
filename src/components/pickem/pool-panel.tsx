"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, LogOut, Plus, Users } from "lucide-react";
import type { MemberRow } from "@/lib/pickem/pool";
import type { PickemGame } from "@/lib/pickem/scoreboard";
import type { Pool } from "@/lib/pickem/store";
import { cn } from "@/lib/utils";

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";
const pct = (p: number) =>
  p >= 0.995 ? "99%+" : p > 0 && p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`;

export type PoolBoard = {
  pool: Pool;
  rows: MemberRow[];
  counts: Record<string, { home: number; away: number }>;
};

/** Create or join a pool. */
export function PoolForms({ onDone }: { onDone: (pool: Pool) => void }) {
  const [name, setName] = useState("");
  const [hide, setHide] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const post = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as { pool?: Pool; error?: string };
      if (!r.ok || !d.pool) throw new Error(d.error ?? "That didn't work");
      onDone(d.pool);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void post("/api/pickem/pools", { name, hidePicks: hide });
        }}
        className="space-y-2"
      >
        <div className="font-medium text-slate-800">Start a pool</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Office pool"
          maxLength={60}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5"
          aria-label="Pool name"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
          />
          Hide everyone&apos;s picks until each game kicks off
        </label>
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "bg-turf-800 hover:bg-turf-900 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50",
            focusCls,
          )}
        >
          <Plus className="size-4" aria-hidden /> Create
        </button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void post("/api/pickem/pools/join", { code });
        }}
        className="space-y-2"
      >
        <div className="font-medium text-slate-800">Join with a code</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC234"
          maxLength={6}
          className="w-32 rounded-md border border-slate-300 px-2.5 py-1.5 font-mono tracking-widest uppercase"
          aria-label="Pool code"
        />
        <div>
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className={cn(
              "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50",
              focusCls,
            )}
          >
            Join
          </button>
        </div>
      </form>
    </div>
  );
}

/** The week's standings in a pool, with each member's chance to win it. */
export function Leaderboard({
  board,
  me,
  games,
  onLeave,
}: {
  board: PoolBoard;
  me: string;
  games: PickemGame[];
  onLeave: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const started = games.some((g) => g.state !== "pre");
  const byId = new Map(games.map((g) => [g.id, g]));
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(board.pool.code);
      toast.success("Code copied");
    } catch {
      toast(board.pool.code);
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Users className="size-4 text-slate-500" aria-hidden />
        <h2 className="font-display text-xl font-semibold text-slate-900">
          {board.pool.name}
        </h2>
        <span className="text-sm text-slate-500">
          {board.pool.members.length} members
        </span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-sm tracking-widest text-slate-800 hover:bg-slate-200",
            focusCls,
          )}
          title="Friends join with this code"
        >
          {board.pool.code} <Copy className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Leave ${board.pool.name}?`)) onLeave();
          }}
          className={cn(
            "rounded-md p-1.5 text-slate-400 hover:text-slate-700",
            focusCls,
          )}
          aria-label="Leave pool"
          title="Leave pool"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
              <th className="px-4 py-2 text-left font-medium">Player</th>
              <th className="px-2 py-2 font-medium">Points</th>
              <th className="px-2 py-2 font-medium">
                {started ? "In play" : "Picks"}
              </th>
              <th className="px-2 py-2 font-medium max-sm:hidden">Expected</th>
              <th className="px-2 py-2 font-medium max-sm:hidden">Best case</th>
              <th className="px-4 py-2 font-medium">Win week</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r, i) => {
              const mine = r.user === me;
              const isOpen = open === r.user;
              const shown = Object.entries(r.visible).sort(
                (a, b) => b[1][1] - a[1][1],
              );
              return [
                <tr
                  key={r.user}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 text-right hover:bg-slate-50",
                    mine && "bg-turf-50/60",
                  )}
                  onClick={() => setOpen(isOpen ? null : r.user)}
                >
                  <td className="px-4 py-2 text-left">
                    <span className="mr-2 text-slate-400">{i + 1}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        mine ? "text-turf-900" : "text-slate-900",
                      )}
                    >
                      {mine ? `${r.user} (you)` : r.user}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-semibold">{r.banked}</td>
                  <td className="px-2 py-2">
                    {started ? (
                      <>
                        <span className="text-emerald-700">+{r.winning}</span>
                        {" / "}
                        <span className="text-red-600">{r.losing}</span>
                      </>
                    ) : (
                      `${r.picked}/${games.length}`
                    )}
                  </td>
                  <td className="px-2 py-2 max-sm:hidden">
                    {r.expected.toFixed(1)}
                  </td>
                  <td className="px-2 py-2 max-sm:hidden">{r.max}</td>
                  <td className="px-4 py-2 font-semibold">{pct(r.winProb)}</td>
                </tr>,
                isOpen && (
                  <tr
                    key={`${r.user}-picks`}
                    className="border-b border-slate-100 bg-slate-50/60"
                  >
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-xs text-slate-600"
                    >
                      {shown.length === 0 ? (
                        "Picks show up here as each game kicks off."
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {shown.map(([id, [side, pts]]) => {
                            const g = byId.get(id);
                            if (!g) return null;
                            const t = g[side];
                            const res =
                              g.final &&
                              g.home.score !== null &&
                              g.away.score !== null
                                ? (side === "home") ===
                                  g.home.score > g.away.score
                                : null;
                            return (
                              <span
                                key={id}
                                className={cn(
                                  "rounded-full border px-2 py-0.5",
                                  res === true
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                    : res === false
                                      ? "border-red-200 bg-red-50 text-red-700 line-through"
                                      : "border-slate-200 bg-white",
                                )}
                              >
                                {t.abbr} {pts}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-slate-500">
        &ldquo;Win week&rdquo; plays out the rest of the week thousands of times
        using live win chances.
        {board.pool.hidePicks &&
          " Other members' picks stay hidden until each game kicks off; the counts still feed your office picks."}{" "}
        Tap a row to see picks.
      </p>
    </section>
  );
}
