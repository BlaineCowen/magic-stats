"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import {
  balancers,
  DEFAULT_SETTINGS,
  gradeTrade,
  SAMPLE_KINDS,
  sampleTrades,
  type SampleKind,
  type SampleTrade,
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

function SettingsPanel({ s, set, etr, onLeague }: {
  s: Settings; set: (s: Settings) => void; etr: boolean; onLeague: (id: string) => void;
}) {
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
      onLeague(id);
    } catch {
      setNote("Couldn't find that league on Sleeper. Check the ID and try again.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-slate-900">Your league</h2>
      {etr && (
        <p className="mt-1 text-sm text-slate-600">
          Using your ETR values: rest of season, half PPR, superflex. These settings don&apos;t change them.
        </p>
      )}
      <div className={cn("mt-3 flex flex-wrap gap-x-6 gap-y-4", etr && "pointer-events-none opacity-40")} aria-disabled={etr}>
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

type Roster = { rosterId: number; label: string; players: string[] };
type League = { id: string; name: string; rosters: Roster[]; slots: string[] };
const TEAM_STORE = "trade-calc-team";

/** A league's rosters from Sleeper, labeled by team name (else the manager's name). */
async function loadLeague(id: string): Promise<League> {
  const get = (p: string) => fetch(`https://api.sleeper.app/v1/league/${id}${p}`).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  const [l, rosters, users] = await Promise.all([get(""), get("/rosters"), get("/users")]) as [
    { name?: string; roster_positions?: string[] },
    { roster_id: number; owner_id: string | null; players: string[] | null }[],
    { user_id: string; display_name?: string; metadata?: { team_name?: string } }[],
  ];
  const who = new Map(users.map((u) => [u.user_id, u.metadata?.team_name || u.display_name || "Unknown"]));
  return {
    id,
    name: l.name ?? "Your league",
    slots: l.roster_positions ?? [],
    rosters: rosters
      .map((r) => ({ rosterId: r.roster_id, label: (r.owner_id && who.get(r.owner_id)) || `Team ${r.roster_id}`, players: r.players ?? [] }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

const KIND_TITLE: Record<SampleKind, string> = {
  "1-for-1": "One for one",
  "2-for-1": "Two of yours for him",
  "1-for-2": "One of yours for him plus a smaller piece",
  "2-for-2": "Two of yours for him plus one of theirs",
  "throw-in": "Add him to a bigger deal",
};

const NONE: Record<SampleKind, string> = {
  "1-for-1": "None of your players is close enough to his value on its own.",
  "2-for-1": "No pair of your lesser players adds up to a fair deal once they free a roster spot for you.",
  "1-for-2": "They have no smaller piece that makes it even.",
  "2-for-2": "No two of yours match him plus one of theirs.",
  "throw-in": "No bigger deal with him in it comes out even.",
};

const SLOT_NAME: Record<string, string> = { SUPER_FLEX: "superflex", FLEX: "flex", WRRB_FLEX: "flex", REC_FLEX: "flex" };
/** "Kittle starts at TE for them. Pickens sits." */
function whereText(players: ValuedPlayer[], slots: Record<string, string | null>, who: string) {
  const last = (p: ValuedPlayer) => p.name.split(" ").filter((w) => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).pop();
  return players.map((p) => {
    const slot = slots[p.id];
    return slot ? `${last(p)} starts at ${SLOT_NAME[slot] ?? slot} ${who}.` : `${last(p)} is depth ${who}.`;
  }).join(" ");
}

function Names({ players }: { players: ValuedPlayer[] }) {
  return (
    <span>
      {players.map((p, i) => (
        <span key={p.id}>
          {i > 0 && " + "}
          <span className="font-medium text-slate-900">{p.name}</span>{" "}
          <span className="text-xs text-slate-500">{p.pos} · {fmt(p.value)}</span>
        </span>
      ))}
    </span>
  );
}

function TradeFor({ target, pool, league, myRoster, setMyRoster, s, onPick, onLoad }: {
  target: ValuedPlayer | null; pool: ValuedPlayer[]; league: League | null; myRoster: number | null;
  setMyRoster: (id: number) => void; s: Settings; onPick: (p: ValuedPlayer) => void;
  onLoad: (t: SampleTrade) => void;
}) {
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const valued = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is ValuedPlayer => !!p);
  const mine = league?.rosters.find((r) => r.rosterId === myRoster) ?? null;
  const owner = target ? league?.rosters.find((r) => r.players.includes(target.id)) ?? null : null;
  const ideas = useMemo(
    () => (target && mine && owner && owner !== mine ? sampleTrades(target, valued(mine.players), valued(owner.players), pool, s, 3, league?.slots.length ? league.slots : undefined) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, mine, owner, pool, s, league],
  );

  let message: string | null = null;
  if (!league) message = "Load your Sleeper league above (“Use my league”) to see trades built from real rosters.";
  else if (!mine) message = "Pick your team to see trades built from your roster.";
  else if (!target) message = "Click a player’s name in the trade, or search for one, to see ways to get him.";
  else if (!owner) message = `Nobody in ${league.name} rosters ${target.name}. Pick him up from waivers.`;
  else if (owner === mine) message = `${target.name} is already on your team.`;
  else if (!ideas.length) message = `Nothing on your roster lines up with ${target.name}’s value. Try adding a third player in the calculator.`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {target ? <>Ways to get {target.name}</> : "Trade for a player"}
        </h2>
        {league && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Your team
            <select
              value={myRoster ?? ""}
              onChange={(e) => setMyRoster(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="" disabled>Pick your team</option>
              {league.rosters.map((r) => <option key={r.rosterId} value={r.rosterId}>{r.label}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="mt-3 max-w-md">
        <PlayerPicker pool={pool} taken={new Set()} onAdd={onPick} label="Find trades for a player" />
      </div>
      {target && owner && owner !== mine && (
        <p className="mt-3 text-sm text-slate-600">
          {target.name} ({target.pos} · {fmt(target.value)}) is on <span className="font-medium text-slate-800">{owner.label}</span>.
          Each idea is close enough that they shouldn&apos;t lose on value, and makes their starting lineup better. Tap one to grade it above.
        </p>
      )}
      {message && <p className="mt-3 text-slate-600">{message}</p>}
      {ideas.length > 0 && SAMPLE_KINDS.map((kind) => {
        const list = ideas.filter((t) => t.kind === kind);
        return (
          <div key={kind} className="mt-4">
            <h3 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{KIND_TITLE[kind]}</h3>
            {!list.length && <p className="mt-1 text-sm text-slate-500">{NONE[kind]}</p>}
            <ul className="mt-2 space-y-2">
              {list.map((t) => (
                <li key={t.give.map((p) => p.id).join() + t.get.map((p) => p.id).join()}>
                  <button
                    type="button"
                    onClick={() => onLoad(t)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm"><span className="text-slate-500">You give </span><Names players={t.give} /></span>
                      <span className="block text-sm"><span className="text-slate-500">You get </span><Names players={t.get} /></span>
                      {t.lineup && (
                        <span className="block text-xs text-slate-500">
                          {whereText(t.give, t.lineup.theirSlots, "for them")} {whereText(t.get, t.lineup.yourSlots, "for you")}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-slate-600 tabular-nums">
                      {t.result.winner === null ? "Fair" : t.edge > 0 ? `You win ${Math.round(t.edge * 100)}%` : `You pay ${Math.round(-t.edge * 100)}% more`}
                      <span className="ml-2 font-display text-lg font-bold text-slate-900">{t.result.a.grade}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Side({ title, players, pool, taken, onAdd, onRemove, onPick, grade, total }: {
  title: string; players: ValuedPlayer[]; pool: ValuedPlayer[]; taken: Set<string>;
  onAdd: (p: ValuedPlayer) => void; onRemove: (id: string) => void; onPick: (p: ValuedPlayer) => void;
  grade?: string; total: number;
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
              <button type="button" onClick={() => onPick(p)} title={`Ways to get ${p.name}`}
                className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900">
                {p.name}
              </button>{" "}
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

export function TradeCalc({ owner = false, myTeam }: {
  owner?: boolean;
  /** Blaine's league and roster, so his trade ideas work without setup. */
  myTeam?: { league: string; roster: number };
}) {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [league, setLeague] = useState<League | null>(null);
  const [myRoster, setMyRosterState] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const tradeFor = useRef<HTMLDivElement>(null);
  // Blaine only: grade with his ETR values instead of the market. Never put in shared links.
  const [source, setSource] = useState<"market" | "etr">("market");
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

  // This browser's league and team, so trade ideas come back on the next visit.
  const saveTeam = (leagueId: string, roster: number | null) => {
    try { localStorage.setItem(TEAM_STORE, JSON.stringify({ league: leagueId, roster })); } catch { /* ignore */ }
  };
  const connectLeague = useCallback(async (id: string, roster: number | null) => {
    try {
      const l = await loadLeague(id);
      setLeague(l);
      const keep = roster != null && l.rosters.some((r) => r.rosterId === roster) ? roster : null;
      setMyRosterState(keep);
      saveTeam(id, keep);
    } catch { /* the settings note already says when a league can't be found */ }
  }, []);
  useEffect(() => {
    let saved: { league?: string; roster?: number | null } | null = null;
    try { saved = JSON.parse(localStorage.getItem(TEAM_STORE) ?? "null"); } catch { /* private window */ }
    const start = saved?.league ? { league: saved.league, roster: saved.roster ?? null } : myTeam ?? null;
    if (start) void connectLeague(start.league, start.roster);
  }, [myTeam, connectLeague]);
  const setMyRoster = (roster: number) => {
    setMyRosterState(roster);
    if (league) saveTeam(league.id, roster);
  };
  const pick = (p: ValuedPlayer) => {
    setTargetId(p.id);
    tradeFor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Team A is you: A gets the target side, B gets what you give.
  const loadIdea = (t: SampleTrade) => {
    setA(t.get.map((p) => p.id));
    setB(t.give.map((p) => p.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!ready.current) return;
    let live = true;
    setError(null);
    const q = source === "etr"
      ? new URLSearchParams({ values: "etr" })
      : new URLSearchParams({ dynasty: s.dynasty ? "1" : "0", teams: String(s.teams), qbs: String(s.qbs), ppr: String(s.ppr), tep: String(s.tep) });
    fetch(`/api/trade-values?${q}`)
      .then((r) => r.json())
      .then((d) => { if (!live) return; if (d.error) setError(d.error); else setPool(d.players); })
      .catch(() => live && setError("Couldn't load player values. Check your connection and try again."));
    return () => { live = false; };
  }, [s, source]);

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
      {owner && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Values (only you see this)" value={source}
            options={[["market", "Market"], ["etr", "My ETR values"]]} onChange={setSource} />
        </div>
      )}
      <SettingsPanel s={s} set={set} etr={source === "etr"} onLeague={(id) => void connectLeague(id, league?.id === id ? myRoster : null)} />
      {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Side title="Team A gets" players={a} pool={pool} taken={taken} total={result?.a.raw ?? a.reduce((t, p) => t + p.value, 0)}
          onAdd={(p) => setA((x) => [...x, p.id])} onRemove={(id) => setA((x) => x.filter((i) => i !== id))} onPick={pick} grade={result?.a.grade} />
        <Side title="Team B gets" players={b} pool={pool} taken={taken} total={result?.b.raw ?? b.reduce((t, p) => t + p.value, 0)}
          onAdd={(p) => setB((x) => [...x, p.id])} onRemove={(id) => setB((x) => x.filter((i) => i !== id))} onPick={pick} grade={result?.b.grade} />
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

      <div ref={tradeFor} className="scroll-mt-4">
        <TradeFor target={targetId ? byId.get(targetId) ?? null : null} pool={pool} league={league} myRoster={myRoster}
          setMyRoster={setMyRoster} s={s} onPick={pick} onLoad={loadIdea} />
      </div>
    </div>
  );
}
