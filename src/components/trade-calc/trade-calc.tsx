"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import {
  balancers,
  DEFAULT_SETTINGS,
  gradeTrade,
  type Settings,
  type ValuedPlayer,
} from "@/lib/nfl/trade-grade";
import { cn } from "@/lib/utils";

const STORE = "trade-calc-settings";
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Settings in a link: d1-12-2-0.5-0 = dynasty, teams, QBs, PPR, TE premium. */
const encode = (s: Settings) => `${s.dynasty ? "d" : "r"}-${s.teams}-${s.qbs}-${s.ppr}-${s.tep}`;
function decode(v: string | null): Settings | null {
  const m = v?.match(/^([dr])-(\d+)-([12])-(0|0\.5|1)-(0|0\.5|1)$/);
  if (!m) return null;
  return { dynasty: m[1] === "d", teams: Math.min(16, Math.max(8, Number(m[2]))), qbs: Number(m[3]) as 1 | 2, ppr: Number(m[4]) as Settings["ppr"], tep: Number(m[5]) as Settings["tep"] };
}
const nearest = <T extends number>(v: number, opts: T[]) => opts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

function Segmented<T extends string | number | boolean>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              v === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ s, set }: { s: Settings; set: (s: Settings) => void }) {
  const [league, setLeague] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function fromSleeper() {
    const id = league.trim().match(/\d{10,}/)?.[0];
    if (!id) return setNote("Paste a Sleeper league ID or league link.");
    setNote("Loading…");
    try {
      const res = await fetch(`https://api.sleeper.app/v1/league/${id}`);
      const l = await res.json();
      if (!l?.league_id) throw new Error();
      const pos: string[] = l.roster_positions ?? [];
      const sc = l.scoring_settings ?? {};
      set({
        dynasty: l.settings?.type === 2,
        teams: Math.min(16, Math.max(8, l.total_rosters ?? 12)),
        qbs: pos.includes("SUPER_FLEX") || pos.filter((p) => p === "QB").length >= 2 ? 2 : 1,
        ppr: nearest(Number(sc.rec ?? 0), [0, 0.5, 1]),
        tep: nearest(Number(sc.bonus_rec_te ?? 0), [0, 0.5, 1]),
      });
      setNote(`Using the settings from ${l.name}.`);
    } catch {
      setNote("Couldn't find that league on Sleeper. Check the ID and try again.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-slate-900">Your league</h2>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-4">
        <Segmented label="Format" value={s.dynasty} options={[[false, "Redraft"], [true, "Dynasty"]]} onChange={(dynasty) => set({ ...s, dynasty })} />
        <Segmented label="Quarterbacks" value={s.qbs} options={[[1, "1 QB"], [2, "Superflex"]]} onChange={(qbs) => set({ ...s, qbs })} />
        <Segmented label="Points per catch" value={s.ppr} options={[[0, "0"], [0.5, "0.5"], [1, "1"]]} onChange={(ppr) => set({ ...s, ppr })} />
        <Segmented label="TE premium" value={s.tep} options={[[0, "None"], [0.5, "+0.5"], [1, "+1"]]} onChange={(tep) => set({ ...s, tep })} />
        <div>
          <label htmlFor="tc-teams" className="mb-1 block text-sm font-medium text-slate-700">Teams</label>
          <select
            id="tc-teams"
            value={s.teams}
            onChange={(e) => set({ ...s, teams: Number(e.target.value) })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {[8, 10, 12, 14, 16].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); void fromSleeper(); }}
      >
        <label htmlFor="tc-league" className="text-sm text-slate-600">Or fill these in from Sleeper:</label>
        <input
          id="tc-league"
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          placeholder="League ID or link"
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Use my league
        </button>
        {note && <span className="text-sm text-slate-600">{note}</span>}
      </form>
    </section>
  );
}

function PlayerPicker({ pool, taken, onAdd, label }: {
  pool: ValuedPlayer[]; taken: Set<string>; onAdd: (p: ValuedPlayer) => void; label: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return pool.filter((p) => !taken.has(p.id) && p.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, pool, taken]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const add = (p: ValuedPlayer) => { onAdd(p); setQ(""); setOpen(false); };
  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); add(matches[0]); } }}
        placeholder={pool.length ? "Add a player or pick" : "Loading players…"}
        aria-label={label}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-base"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-slate-100">
                <span>
                  <span className="font-medium text-slate-900">{p.name}</span>{" "}
                  <span className="text-sm text-slate-500">{p.pos}{p.team ? ` · ${p.team}` : ""}</span>
                </span>
                <span className="text-sm text-slate-500 tabular-nums">{fmt(p.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Side({ title, players, pool, taken, onAdd, onRemove, grade, total }: {
  title: string; players: ValuedPlayer[]; pool: ValuedPlayer[]; taken: Set<string>;
  onAdd: (p: ValuedPlayer) => void; onRemove: (id: string) => void; grade?: string; total: number;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {grade && <span className="font-display text-3xl font-bold text-slate-900">{grade}</span>}
      </div>
      <div className="mt-3">
        <PlayerPicker pool={pool} taken={taken} onAdd={onAdd} label={`${title}: add a player`} />
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium text-slate-900">{p.name}</span>{" "}
              <span className="text-sm text-slate-500">
                {p.pos}{p.team ? ` · ${p.team}` : ""}{p.age ? ` · ${p.age.toFixed(0)}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-slate-600 tabular-nums">{fmt(p.value)}</span>
              <button type="button" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {players.length > 0 && (
        <div className="mt-2 text-right text-sm text-slate-500 tabular-nums">Total {fmt(total)}</div>
      )}
    </section>
  );
}

export function TradeCalc() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [pool, setPool] = useState<ValuedPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aIds, setA] = useState<string[]>([]);
  const [bIds, setB] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const ready = useRef(false);

  // Start from a shared link, else this browser's last settings.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let saved: Settings | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { /* private window */ }
    setS(decode(q.get("s")) ?? (saved && typeof saved.teams === "number" ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS));
    setA(q.get("a")?.split(",").filter(Boolean) ?? []);
    setB(q.get("b")?.split(",").filter(Boolean) ?? []);
    ready.current = true;
  }, []);

  const set = useCallback((next: Settings) => {
    setS(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    let live = true;
    setError(null);
    const q = new URLSearchParams({ dynasty: s.dynasty ? "1" : "0", teams: String(s.teams), qbs: String(s.qbs), ppr: String(s.ppr), tep: String(s.tep) });
    fetch(`/api/trade-values?${q}`)
      .then((r) => r.json())
      .then((d) => { if (!live) return; if (d.error) setError(d.error); else setPool(d.players); })
      .catch(() => live && setError("Couldn't load player values. Check your connection and try again."));
    return () => { live = false; };
  }, [s]);

  // Keep the link in the address bar current, so it can be shared.
  useEffect(() => {
    if (!ready.current) return;
    const q = new URLSearchParams({ s: encode(s) });
    if (aIds.length) q.set("a", aIds.join(","));
    if (bIds.length) q.set("b", bIds.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [s, aIds, bIds]);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const a = aIds.map((id) => byId.get(id)).filter((p): p is ValuedPlayer => !!p);
  const b = bIds.map((id) => byId.get(id)).filter((p): p is ValuedPlayer => !!p);
  // Players with no value in these settings (e.g. picks in redraft) drop out quietly.
  const taken = useMemo(() => new Set([...aIds, ...bIds]), [aIds, bIds]);
  const result = useMemo(() => gradeTrade(a, b, pool, s), [a, b, pool, s]);
  const evenOut = result ? balancers(result, pool, taken) : [];

  const verdict = !result
    ? null
    : result.winner === null
      ? "Fair trade"
      : `Team ${result.winner.toUpperCase()} wins by ${Math.round(result.gap * 100)}%`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the address bar has it */ }
  }

  return (
    <div className="space-y-5">
      <SettingsPanel s={s} set={set} />
      {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Side title="Team A gets" players={a} pool={pool} taken={taken} total={result?.a.raw ?? a.reduce((t, p) => t + p.value, 0)}
          onAdd={(p) => setA((x) => [...x, p.id])} onRemove={(id) => setA((x) => x.filter((i) => i !== id))} grade={result?.a.grade} />
        <Side title="Team B gets" players={b} pool={pool} taken={taken} total={result?.b.raw ?? b.reduce((t, p) => t + p.value, 0)}
          onAdd={(p) => setB((x) => [...x, p.id])} onRemove={(id) => setB((x) => x.filter((i) => i !== id))} grade={result?.b.grade} />
      </div>

      {result ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">{verdict}</h2>
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <Link2 className="h-4 w-4" /> {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {(["a", "b"] as const).map((k) => {
              const side = result[k];
              const max = Math.max(result.a.adjusted, result.b.adjusted) || 1;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-medium text-slate-700">Team {k.toUpperCase()}</span>
                  <div className="h-3 flex-1 rounded-full bg-slate-100">
                    <div className={cn("h-3 rounded-full", k === "a" ? "bg-sky-600" : "bg-emerald-600")} style={{ width: `${(side.adjusted / max) * 100}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm text-slate-600 tabular-nums">{fmt(side.adjusted)}</span>
                </div>
              );
            })}
          </div>
          {(result.a.spotCredit > 0 || result.b.spotCredit > 0) && (
            <p className="mt-3 text-sm text-slate-600">
              Team {result.a.spotCredit > 0 ? "A" : "B"} gets fewer players, so it&apos;s credited {fmt(result.a.spotCredit || result.b.spotCredit)} for the roster spots it can fill from waivers.
            </p>
          )}
          {evenOut.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">
                To even it out, Team {result.winner === "a" ? "A" : "B"} could also give one of these:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {evenOut.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => (result.winner === "a" ? setB((x) => [...x, p.id]) : setA((x) => [...x, p.id]))}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {p.name} <span className="text-slate-500">{p.pos} · {fmt(p.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <p className="text-slate-600">Add at least one player or pick to each side to see the grade.</p>
      )}
    </div>
  );
}
