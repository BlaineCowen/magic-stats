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
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-gray-900">
          Did Kyle Shanahan blow his Super Bowls on 4th down?
        </h2>
        <p className="mt-2 text-gray-700">
          Mostly no. He has lost three Super Bowls: as the Falcons&apos; play
          caller in LI, then as the 49ers&apos; head coach in LIV and LVIII.
          Across all three, the 4th down calls on his side cost very little. The
          games turned on other plays.
        </p>
      </div>

      <GameStudy
        gameId="2023_22_SF_KC"
        focus="SF"
        title="Super Bowl LVIII, February 2024: 49ers vs. Chiefs"
        verdict="Shanahan got every 4th down right in regulation. Andy Reid's calls were worse, and the Chiefs won anyway."
        featured={[{ playId: 3156, heading: "The gutsy one that worked" }]}
      >
        <p>
          He punted the long ones, kicked a 55-yarder on 4th &amp; 14, went for
          it on 4th &amp; 3 at the Kansas City 15 while down 3 early in the
          fourth (they made it), and kicked the go-ahead 53-yarder with 1:57
          left. Ben Baldwin&apos;s nfl4th would have kicked on that 4th &amp; 3;
          this model says going was slightly better.
        </p>
        <p>
          Andy Reid made four kicks or punts the model wanted to be go-for-its.
          Together they cost the Chiefs about 9% in chance to win. The
          second-guessing of Shanahan was all about overtime, which is just
          below.
        </p>
      </GameStudy>
      <LviiiOvertime />

      <GameStudy
        gameId="2019_21_SF_KC"
        focus="SF"
        title="Super Bowl LIV, February 2020: 49ers vs. Chiefs"
        verdict="One small mistake, a field goal in the third quarter. The punt everyone remembers was a coin flip."
        featured={[
          { playId: 2001, heading: "The one he got wrong" },
          { playId: 3315, heading: "The punt fans still argue about" },
        ]}
      >
        <p>
          Tied in the third quarter, Shanahan kicked a field goal on 4th &amp; 2
          at the Kansas City 24. It was good, but going for it gave a slightly
          better chance to win. Ben Baldwin&apos;s nfl4th agrees; EdjSports, an
          analytics firm that grades coaches&apos; decisions, called it a bigger
          mistake at the time.
        </p>
        <p>
          The game turned on a 3rd down instead. Down 10 with 7:13 left and
          facing 3rd &amp; 15, the Chiefs had about a 9% chance to win when
          Patrick Mahomes hit Tyreek Hill for 44 yards.
        </p>
      </GameStudy>

      <GameStudy
        gameId="2016_21_NE_ATL"
        focus="ATL"
        title="Super Bowl LI, February 2017: Falcons vs. Patriots"
        verdict="The Falcons' 4th down calls were fine. The collapse came on 2nd and 3rd down."
      >
        <p>
          Shanahan called the plays, but head coach Dan Quinn made the 4th down
          calls. Every Atlanta 4th down was a punt, and the model agrees with
          all of them or calls them coin flips. New England&apos;s Bill
          Belichick punted twice on short 4th downs where the model says to go.
        </p>
        <p>
          Up 8 with 4:40 left and the ball at the New England 22, a run lost a
          yard, Matt Ryan was sacked, and a holding penalty made it 3rd &amp;
          33. They punted. Running the ball and kicking a 40-yard field goal
          (made about 86% of the time) would have put them up 11 with roughly a
          96% chance to win. After the punt it was 91%. Costly, but New England
          still needed two touchdowns and two 2-point conversions to tie.
        </p>
      </GameStudy>
    </div>
  );
}
