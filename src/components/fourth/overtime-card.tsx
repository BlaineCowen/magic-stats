"use client";

import { useMemo, useState } from "react";
import type { FourthDownPlay } from "@/lib/fourth/games";
import {
  firstPossessionFourth,
  LEAGUE_AVG,
  receiveFirst,
  type OtParams,
} from "@/lib/fourth/overtime";
import { OPTION_COLOR } from "./decision-card";
import { chance, Expand, outOf10 } from "./ui";

/** Scale one team's scoring rates: 1 = league average offense against a league average defense. */
function scaled(p: OtParams, side: "a" | "b", f: number): OtParams {
  const c = (v: number) => Math.min(0.9, v * f);
  const out = structuredClone(p);
  out.firstDrive[side] = {
    td: c(p.firstDrive[side].td),
    fg: p.firstDrive[side].fg,
  };
  out.down3[side] = { td: c(p.down3[side].td), fg: p.down3[side].fg };
  out.down7[side] = c(p.down7[side]);
  out.anyScore[side] = c(p.anyScore[side]);
  return out;
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const text =
    value === 1
      ? "league average"
      : value > 1
        ? `${Math.round((value - 1) * 100)}% better`
        : `${Math.round((1 - value) * 100)}% worse`;
  return (
    <label className="block">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-900">{text}</span>
      </div>
      <input
        type="range"
        min={0.6}
        max={1.6}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

function Pair({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
}) {
  const best = a >= b ? "a" : "b";
  return (
    <div className="space-y-1.5">
      {(
        [
          ["a", aLabel, a],
          ["b", bLabel, b],
        ] as const
      ).map(([k, label, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className="w-24 text-gray-600">{label}</span>
          <div className="h-2.5 flex-1 rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${v * 100}%`,
                background: k === "a" ? OPTION_COLOR.fg : OPTION_COLOR.go,
                opacity: best === k ? 1 : 0.5,
              }}
            />
          </div>
          <span className="w-12 text-right font-semibold tabular-nums">
            {chance(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OvertimeCard({ play }: { play: FourthDownPlay }) {
  const [sf, setSf] = useState(1);
  const [kc, setKc] = useState(1.25);
  const ot = play.ot!;
  const r = useMemo(() => {
    const p = scaled(scaled(LEAGUE_AVG, "a", sf), "b", kc);
    const four = firstPossessionFourth(p, "a", {
      conv: ot.conv,
      tdOnPlay: ot.tdOnPlay,
      tdAfter: ot.tdAfter,
      fgMake: ot.fgMake,
      // turnover on downs at their own 5-9: they need any score; deep starts score ~36% (2015-25)
      anyScoreAfterStop: Math.min(0.9, 0.36 * kc),
    });
    return {
      four,
      receive: receiveFirst(p, "a"),
      kick: 1 - receiveFirst(p, "b"),
    };
  }, [sf, kc, ot]);
  const gap = (r.four.go - r.four.fg) * 100;
  const toss = (r.receive - r.kick) * 100;
  const kickBest = gap < 0;
  const headline =
    Math.abs(gap) < 1
      ? "In overtime, kicking or going for it on that 4th down were about even."
      : kickBest
        ? "In overtime, kicking the field goal was the right call."
        : "In overtime, going for it would have been the better call.";
  const tossLine =
    Math.abs(toss) < 1
      ? "Taking the ball first was a coin flip."
      : toss > 0
        ? "Taking the ball first was the right choice."
        : "Kicking off first would have been slightly better.";

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">
        Super Bowl LVIII overtime
      </h3>
      <p className="mt-2 max-w-3xl text-xl leading-snug font-semibold text-gray-900">
        {headline} {tossLine}
      </p>
      <p className="mt-2 max-w-3xl text-sm text-gray-700">
        Under the playoff rules both teams get the ball, even after a touchdown.
        A field goal meant the Chiefs needed a touchdown to win outright; a
        failed 4th down meant they needed only a field goal.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="font-semibold text-gray-900">
            4th &amp; {ot.ydstogo} at the KC {ot.yardline}, tied
          </div>
          <div className="mb-3 text-sm text-gray-600">
            They kicked the field goal (good).
          </div>
          <Pair
            aLabel="Field goal"
            bLabel="Go for it"
            a={r.four.fg}
            b={r.four.go}
          />
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="font-semibold text-gray-900">The coin toss</div>
          <div className="mb-3 text-sm text-gray-600">
            Shanahan chose to take the ball first.
          </div>
          <Pair
            aLabel="Ball first"
            bLabel="Kick first"
            a={r.receive}
            b={r.kick}
          />
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Chance the 49ers win after each choice
      </div>

      <div className="mt-4 space-y-1 border-t border-gray-100 pt-3">
        <Expand label="What if the offenses were better or worse?">
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Slider label="49ers offense" value={sf} onChange={setSf} />
            <Slider label="Chiefs offense" value={kc} onChange={setKc} />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            The Chiefs start at 25% better than average, roughly Mahomes-era
            Kansas City. Make them good enough and going for it becomes the
            better call.
          </p>
        </Expand>
        <Expand label="How this was worked out">
          <div className="max-w-3xl space-y-2 text-sm text-gray-700">
            <p>
              Ben Baldwin&apos;s nfl4th stops at the end of regulation, and
              there aren&apos;t enough playoff overtime games under these rules
              to learn from, so this plays out each possession using how often
              drives score in similar spots during regulation.
            </p>
            <p>
              Going for it: they make it about {outOf10(ot.conv)} times,
              sometimes scoring on the play itself. The {18 + ot.yardline}-yard
              field goal is nearly automatic ({chance(ot.fgMake)}). After a
              49ers touchdown they win about {chance(r.four.winAfterTd)} of the
              time; after a field goal, {chance(r.four.winAfterFg)}.
            </p>
            <p className="text-xs text-gray-500">
              League averages behind it: a normal first drive scores a touchdown
              21% of the time and a field goal 15%; a team down 7 that needs a
              touchdown gets one 31%; a team down 3 scores a touchdown 20% and a
              field goal 23%.
            </p>
          </div>
        </Expand>
      </div>
    </section>
  );
}
