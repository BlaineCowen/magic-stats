"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, RotateCcw } from "lucide-react";
import type { Decision, Situation } from "@/lib/fourth/engine";
import { DEFAULT_SITUATION, situationQuery } from "@/lib/fourth/params";
import { cn } from "@/lib/utils";
import { DecisionCard, yardText } from "./decision-card";

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-turf-700 focus-visible:-outline-offset-1";

/** Common spots a fan might want to check, one click each. */
const PRESETS: { label: string; s: Partial<Situation> }[] = [
  {
    label: "4th & 1 at midfield",
    s: { yardline: 50, ydstogo: 1, qtr: 2, clock: 600, scoreDiff: 0 },
  },
  {
    label: "4th & goal at the 2",
    s: { yardline: 2, ydstogo: 2, qtr: 2, clock: 480, scoreDiff: 0 },
  },
  {
    label: "4th & 4 at their 35, down 3 late",
    s: {
      yardline: 35,
      ydstogo: 4,
      qtr: 4,
      clock: 150,
      scoreDiff: -3,
      offTimeouts: 1,
    },
  },
  {
    label: "4th & 10 at own 30",
    s: { yardline: 70, ydstogo: 10, qtr: 1, clock: 600, scoreDiff: 0 },
  },
];

const presetSituation = (p: Partial<Situation>): Situation => ({
  ...DEFAULT_SITUATION,
  ...p,
});

const sameSituation = (a: Situation, b: Situation) =>
  situationQuery(a) === situationQuery(b);

const chipCls =
  "rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-turf-700";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">
        {label}
        {hint && (
          <span className="ml-1 font-normal text-slate-500">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={o.v === value}
          onClick={() => onChange(o.v)}
          className={cn(
            "focus-visible:outline-turf-700 flex-1 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2",
            o.v === value
              ? "bg-turf-950 font-semibold text-white"
              : "bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A number box that works with phone keyboards. It keeps whatever is typed ("-", "3.",
 * an empty box) and only passes on numbers inside [min, max]; leaving the box puts the
 * last good number back. Phone number pads have no minus key, so fields that can go
 * negative get a +/− button.
 */
function NumInput({
  value,
  onChange,
  min,
  max,
  decimals = false,
  signed = false,
  optional = false,
  placeholder,
  label,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  decimals?: boolean;
  signed?: boolean;
  /** An empty box means "unknown" (null). */
  optional?: boolean;
  placeholder?: string;
  label: string;
}) {
  const show = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [text, setText] = useState(show(value));
  // follow outside changes (presets, Reset) unless the box already says that number
  useEffect(() => {
    setText((t) => (read(t) === (value ?? null) ? t : show(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function read(t: string): number | null | undefined {
    const c = t.trim().replace(/[−–]/g, "-");
    if (c === "") return optional ? null : undefined;
    if (!(decimals ? /^-?\d+(\.\d*)?$|^-?\.\d+$/ : /^-?\d+$/).test(c)) return undefined;
    const n = Number(c);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  }
  const type = (t: string) => {
    setText(t);
    const n = read(t);
    if (n !== undefined && n !== value) onChange(n);
  };
  const flip = () => {
    const t = text.trim();
    type(t.startsWith("-") ? t.slice(1) : `-${t || "0"}`.replace(/^-0$/, "-"));
  };

  return (
    <div className="flex gap-1">
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          if (read(text) === undefined) setText(show(value));
        }}
        className={cn(inputCls, "min-w-0 text-base sm:text-sm")}
      />
      {signed && (
        <button
          type="button"
          onClick={flip}
          aria-label={`Make ${label.toLowerCase()} ${text.trim().startsWith("-") ? "positive" : "negative"}`}
          className="focus-visible:outline-turf-700 w-10 shrink-0 rounded-md border border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2"
        >
          ±
        </button>
      )}
    </div>
  );
}

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const parseClock = (s: string): number | null => {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v <= 900 ? v : null;
};

export function Calculator({ initial }: { initial: Situation }) {
  const [s, setS] = useState<Situation>(initial);
  const [clockText, setClockText] = useState(mmss(initial.clock));
  const [d, setD] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = <K extends keyof Situation>(k: K, v: Situation[K]) =>
    setS((p) => ({ ...p, [k]: v }));
  const load = (next: Situation) => {
    setS(next);
    setClockText(mmss(next.clock));
  };
  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    const q = situationQuery(s);
    // keeps the URL shareable as inputs change; Next syncs useSearchParams with this
    window.history.replaceState(null, "", `?tab=calculator&${q}`);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/fourth-down?${q}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j: Decision & { error?: string }) => {
          if (j.error) setError(j.error);
          else {
            setError(null);
            setD(j);
          }
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [s]);

  const fromOwnGoal = 100 - s.yardline;

  const isDefault = sameSituation(s, DEFAULT_SITUATION);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Try a situation"
          className="nfl-scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {PRESETS.map((p) => {
            const on = sameSituation(s, presetSituation(p.s));
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => load(presetSituation(p.s))}
                className={cn(
                  chipCls,
                  on
                    ? "border-turf-950 bg-turf-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(DEFAULT_SITUATION)}
            disabled={isDefault}
            className="focus-visible:outline-turf-700 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 disabled:opacity-50"
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="bg-turf-700 hover:bg-turf-800 focus-visible:outline-turf-700 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
          </button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-4 self-start rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-slate-600">
                Where&apos;s the ball?
              </span>
              <span className="font-display text-xl font-semibold text-slate-900">
                4th &amp; {s.ydstogo >= s.yardline ? "goal" : s.ydstogo} at{" "}
                {yardText(s.yardline)}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={99}
              value={fromOwnGoal}
              onChange={(e) => {
                const yl = 100 - Number(e.target.value);
                setS((p) => ({
                  ...p,
                  yardline: yl,
                  ydstogo: Math.min(p.ydstogo, yl),
                }));
              }}
              className="accent-turf-700 mt-2 w-full"
              aria-label="Field position"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>own goal</span>
              <span>50</span>
              <span>opp goal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Yards to go">
              <NumInput
                label="Yards to go"
                min={1}
                max={s.yardline}
                value={s.ydstogo}
                onChange={(v) => set("ydstogo", v ?? 1)}
              />
            </Field>
            <Field label="Score" hint="(+ ahead, − behind)">
              <NumInput
                label="Score"
                signed
                min={-60}
                max={60}
                value={s.scoreDiff}
                onChange={(v) => set("scoreDiff", v ?? 0)}
              />
            </Field>
            <Field label="Quarter">
              <Segmented
                value={s.qtr}
                options={[1, 2, 3, 4].map((q) => ({
                  v: q as Situation["qtr"],
                  label: ["1st", "2nd", "3rd", "4th"][q - 1] ?? `Q${q}`,
                }))}
                onChange={(v) => set("qtr", v)}
              />
            </Field>
            <Field label="Clock">
              <input
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                value={clockText}
                onChange={(e) => {
                  setClockText(e.target.value);
                  const c = parseClock(e.target.value);
                  if (c != null) set("clock", c);
                }}
                className={cn(inputCls, "text-base sm:text-sm")}
                placeholder="5:00"
              />
            </Field>
            <Field label="Offense timeouts">
              <Segmented
                value={s.offTimeouts}
                options={[0, 1, 2, 3].map((v) => ({ v, label: String(v) }))}
                onChange={(v) => set("offTimeouts", v)}
              />
            </Field>
            <Field label="Defense timeouts">
              <Segmented
                value={s.defTimeouts}
                options={[0, 1, 2, 3].map((v) => ({ v, label: String(v) }))}
                onChange={(v) => set("defTimeouts", v)}
              />
            </Field>
          </div>

          <details className="group rounded-md border border-slate-200 px-3 py-2">
            <summary className="focus-visible:outline-turf-700 cursor-pointer rounded text-sm font-medium text-slate-700 focus-visible:outline-2">
              More details (betting line, stadium, weather)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Spread" hint="(+ = offense favored)">
                <NumInput
                  label="Spread"
                  signed
                  decimals
                  min={-30}
                  max={30}
                  value={s.spread}
                  onChange={(v) => set("spread", v ?? 0)}
                />
              </Field>
              <Field label="Over/under">
                <NumInput
                  label="Over/under"
                  decimals
                  min={25}
                  max={70}
                  value={s.total}
                  onChange={(v) => set("total", v ?? 45)}
                />
              </Field>
              <Field label="Offense is">
                <Segmented
                  value={s.home}
                  options={[
                    { v: 1 as const, label: "Home" },
                    { v: 0 as const, label: "Away" },
                  ]}
                  onChange={(v) => set("home", v)}
                />
              </Field>
              <Field label="Season">
                <NumInput
                  label="Season"
                  min={1999}
                  max={2030}
                  value={s.season}
                  onChange={(v) => set("season", v ?? 2025)}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Stadium">
                  <Segmented
                    value={s.roof}
                    options={[
                      { v: "outdoors" as const, label: "Outdoors" },
                      { v: "retractable" as const, label: "Retractable" },
                      { v: "dome" as const, label: "Dome" },
                    ]}
                    onChange={(v) => set("roof", v)}
                  />
                </Field>
              </div>
              {s.roof !== "dome" && (
                <>
                  <Field label="Wind (mph)">
                    <NumInput
                      label="Wind"
                      optional
                      min={0}
                      max={50}
                      value={s.wind}
                      placeholder="unknown"
                      onChange={(v) => set("wind", v)}
                    />
                  </Field>
                  <Field label="Temp (°F)">
                    <NumInput
                      label="Temperature"
                      signed
                      optional
                      min={-20}
                      max={120}
                      value={s.temp}
                      placeholder="unknown"
                      onChange={(v) => set("temp", v)}
                    />
                  </Field>
                </>
              )}
              {s.qtr <= 2 && (
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="accent-turf-700"
                    checked={s.receive2h}
                    onChange={(e) => set("receive2h", e.target.checked)}
                  />
                  Offense gets the ball to start the second half
                </label>
              )}
            </div>
          </details>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {d ? (
            <DecisionCard d={d} />
          ) : (
            !error && (
              <div className="h-72 animate-pulse rounded-lg bg-slate-200/70" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
