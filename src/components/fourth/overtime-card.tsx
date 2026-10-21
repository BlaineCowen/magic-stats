"use client";

import { useMemo, useState } from "react";
import type { FourthDownPlay } from "@/lib/fourth/games";
import {
  firstPossessionFourth,
  LEAGUE_AVG,
  receiveFirst,
  type OtParams,
} from "@/lib/fourth/overtime";
import { OPTION_COLOR, pct } from "./decision-card";

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
          <span className="w-14 text-right font-semibold tabular-nums">
            {pct(v, 1)}
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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">
        Overtime: the decisions nfl4th can&apos;t grade
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">
        Under the 2022 playoff rules both teams get the ball, even after a
        first-drive touchdown, and then it&apos;s sudden death. nfl4th stops at
        the end of regulation, and there aren&apos;t enough of these games to
        train a model, so this is a possession-by-possession model built from
        comparable regulation drives. The sliders set how good each offense is;
        the Chiefs start at 25% better than average, which is roughly
        Mahomes-era Kansas City.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          <Slider label="49ers offense" value={sf} onChange={setSf} />
          <Slider label="Chiefs offense" value={kc} onChange={setKc} />
          <p className="text-xs text-gray-500">
            Averages used: a normal first drive scores a TD 21% and a FG 15% of
            the time; a team down 7 that must score a TD gets one 31%; a team
            down 3 scores a TD 20% and a FG 23%.
          </p>
        </div>
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium text-gray-800">
              The coin toss: receive or kick?
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Shanahan chose to receive. Kicking means you know exactly what you
              need on your drive.
            </p>
            <Pair aLabel="Receive" bLabel="Kick" a={r.receive} b={r.kick} />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800">
              4th &amp; {ot.ydstogo} at the KC {ot.yardline}, tied, first
              possession
            </div>
            <p className="mb-2 text-xs text-gray-500">
              They kicked. Converting is {pct(ot.conv)} likely (a touchdown on
              the play {pct(ot.tdOnPlay)}); a {18 + ot.yardline}-yard kick is{" "}
              {pct(ot.fgMake)}.
            </p>
            <Pair
              aLabel="Field goal"
              bLabel="Go for it"
              a={r.four.fg}
              b={r.four.go}
            />
            <p className="mt-2 text-sm text-gray-700">
              {Math.abs(gap) < 1
                ? "Toss-up at these settings."
                : gap > 0
                  ? `Going for it was worth ${gap.toFixed(1)} points more.`
                  : `Kicking was worth ${(-gap).toFixed(1)} points more.`}{" "}
              A field goal makes the Chiefs need only a touchdown to win and a
              field goal to extend; a touchdown makes them need a touchdown just
              to keep playing ({pct(r.four.winAfterTd)} vs{" "}
              {pct(r.four.winAfterFg)} for the 49ers).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
