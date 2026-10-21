"use client";

import { useEffect, useState } from "react";
import type { Decision, Situation } from "@/lib/fourth/engine";
import { situationQuery } from "@/lib/fourth/params";
import { cn } from "@/lib/utils";
import { DecisionCard, yardText } from "./decision-card";

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

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
      <span className="text-xs font-medium text-gray-500">
        {label}
        {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
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
    <div className="flex overflow-hidden rounded-md border border-gray-300">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "flex-1 px-2 py-1.5 text-sm",
            o.v === value
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50",
          )}
        >
          {o.label}
        </button>
      ))}
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
  const set = <K extends keyof Situation>(k: K, v: Situation[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const q = situationQuery(s);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-gray-500">
              Where&apos;s the ball?
            </span>
            <span className="text-base font-semibold text-gray-900">
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
            className="mt-2 w-full accent-blue-600"
            aria-label="Field position"
          />
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>own goal</span>
            <span>50</span>
            <span>opp goal</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yards to go">
            <input
              type="number"
              min={1}
              max={s.yardline}
              value={s.ydstogo}
              onChange={(e) =>
                set(
                  "ydstogo",
                  Math.max(
                    1,
                    Math.min(s.yardline, Number(e.target.value) || 1),
                  ),
                )
              }
              className={inputCls}
            />
          </Field>
          <Field label="Score" hint="(+ ahead, − behind)">
            <input
              type="number"
              value={s.scoreDiff}
              onChange={(e) => set("scoreDiff", Number(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>
          <Field label="Quarter">
            <Segmented
              value={s.qtr}
              options={[1, 2, 3, 4].map((q) => ({
                v: q as Situation["qtr"],
                label: `Q${q}`,
              }))}
              onChange={(v) => set("qtr", v)}
            />
          </Field>
          <Field label="Clock">
            <input
              value={clockText}
              onChange={(e) => {
                setClockText(e.target.value);
                const c = parseClock(e.target.value);
                if (c != null) set("clock", c);
              }}
              className={inputCls}
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

        <details className="group rounded-md border border-gray-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            More details (betting line, stadium, weather)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Spread" hint="(+ = offense favored)">
              <input
                type="number"
                step={0.5}
                value={s.spread}
                onChange={(e) => set("spread", Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <Field label="Over/under">
              <input
                type="number"
                step={0.5}
                value={s.total}
                onChange={(e) => set("total", Number(e.target.value) || 45)}
                className={inputCls}
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
              <input
                type="number"
                min={1999}
                max={2030}
                value={s.season}
                onChange={(e) => set("season", Number(e.target.value) || 2025)}
                className={inputCls}
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
                  <input
                    type="number"
                    min={0}
                    value={s.wind ?? ""}
                    placeholder="unknown"
                    onChange={(e) =>
                      set(
                        "wind",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Temp (°F)">
                  <input
                    type="number"
                    value={s.temp ?? ""}
                    placeholder="unknown"
                    onChange={(e) =>
                      set(
                        "temp",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className={inputCls}
                  />
                </Field>
              </>
            )}
            {s.qtr <= 2 && (
              <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
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
        {d && <DecisionCard d={d} />}
      </div>
    </div>
  );
}
