"use client";

import { useEffect, useState } from "react";
import type { GameAnalysis } from "@/lib/fourth/games";
import { GameStudy } from "./game-study";
import { OvertimeCard } from "./overtime-card";

function LviiiOvertime() {
  const [g, setG] = useState<GameAnalysis | null>(null);
  useEffect(() => {
    fetch("/api/fourth-down?game=2023_22_SF_KC")
      .then((r) => r.json())
      .then(setG)
      .catch(() => undefined);
  }, []);
  const play = g?.plays.find((p) => p.ot && p.posteam === "SF");
  return play ? <OvertimeCard play={play} /> : null;
}

export function SuperBowls() {
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm leading-relaxed text-gray-700">
        Kyle Shanahan has been on the losing side of three Super Bowls: as
        Atlanta&apos;s offensive coordinator under Dan Quinn in Super Bowl LI,
        then as the 49ers&apos; head coach in LIV and LVIII. Every 4th down in
        those games is graded below. Solid dots on the timelines are the
        Shanahan side&apos;s decisions.
      </p>

      <GameStudy
        gameId="2023_22_SF_KC"
        focus="SF"
        title="Super Bowl LVIII · Feb 2024 · 49ers vs Chiefs"
      >
        <p>
          In regulation Shanahan&apos;s 4th downs were clean: the model agrees
          with all eight. He punted the long ones, kicked a 55-yarder on 4th
          &amp; 14, went for it on 4th &amp; 3 at the Kansas City 15 while down
          3 early in the fourth (they converted; this model says go by 1.4
          points, while nfl4th would have kicked by 1.6), and kicked the
          go-ahead 53-yarder with 1:57 left. Andy Reid was the one leaving value
          on the table: four kicks or punts the model wanted to be go-for-its,
          worth about 9 points of win probability combined. The Chiefs won
          anyway.
        </p>
        <p className="mt-2">
          The second-guessing was all about overtime, which nfl4th can&apos;t
          grade. That&apos;s below.
        </p>
      </GameStudy>
      <LviiiOvertime />

      <GameStudy
        gameId="2019_21_SF_KC"
        focus="SF"
        title="Super Bowl LIV · Feb 2020 · 49ers vs Chiefs"
      >
        <p>
          One clear miss and one close call. Tied in the third quarter, Shanahan
          kicked a field goal on 4th &amp; 2 at the Kansas City 24. The kick was
          good, but going was worth about 1.4 points more (nfl4th says 1.6;
          EdjSports put it near 5 at the time). The punt fans remember, 4th
          &amp; 5 from his own 25 with 5:18 left and a 3-point lead, is a coin
          flip here: going rates 1.0 points better, nfl4th says punt by 1.2.
        </p>
        <p className="mt-2">
          The game turned on a 3rd down, not a 4th. Down 10 with 7:13 left and
          facing 3rd &amp; 15, the Chiefs had a 9% chance to win when Mahomes
          hit Tyreek Hill for 44 yards.
        </p>
      </GameStudy>

      <GameStudy
        gameId="2016_21_NE_ATL"
        focus="ATL"
        title="Super Bowl LI · Feb 2017 · Falcons vs Patriots"
      >
        <p>
          Shanahan called the plays here, but head coach Dan Quinn made the 4th
          down calls, and they hold up: every Atlanta 4th down was a punt and
          the model agrees with all of them or calls them close. New England
          (Belichick) punted on 4th &amp; 1 at its own 34 and 4th &amp; 2 at its
          own 24 while down 7, both of which the model says to go for.
        </p>
        <p className="mt-2">
          The Falcons&apos; collapse came on 3rd and 2nd down. Up 8 with 4:40
          left and 1st &amp; 10 at the New England 22, a run lost a yard, Matt
          Ryan was sacked on 2nd &amp; 11, and a holding penalty made it 3rd
          &amp; 33. They punted. Staying in range for a 40-yard field goal
          (about 86% to make) would have put them up 11 with roughly a 96%
          chance to win; after the punt it was 91%. Costly, but New England
          still needed two touchdowns and two 2-point conversions to force
          overtime.
        </p>
      </GameStudy>
    </div>
  );
}
