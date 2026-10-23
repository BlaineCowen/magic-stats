import assert from "node:assert/strict";
import { test } from "node:test";
import { actualOf, outcomeOf, type PlayResultInput } from "./outcome";

// Real 4th down plays from ESPN's feed, week 7 of 2026.
const play = (
  type: string,
  text: string,
  o: Partial<PlayResultInput> & {
    from?: string;
    to?: string;
    down?: number;
    need?: number;
  } = {},
): PlayResultInput => ({
  type: { text: type },
  text,
  statYardage: o.statYardage ?? 0,
  scoringPlay: o.scoringPlay ?? false,
  isTurnover: o.isTurnover ?? false,
  start: { distance: o.need ?? 1, team: { id: o.from ?? "1" } },
  end: { down: o.down ?? 1, team: { id: o.to ?? "1" } },
});
const out = (p: PlayResultInput) => outcomeOf(p, actualOf(p)!);

test("went for it", () => {
  assert.deepEqual(
    out(
      play(
        "Pass Reception",
        "(Shotgun) J.Herbert pass short right to T.Wease to KC 26 for 14 yards (D.Tranquill).",
        { statYardage: 14, need: 4 },
      ),
    ),
    { result: "Converted", play: "Pass for 14 yards", tone: "good" },
  );
  assert.deepEqual(
    out(
      play(
        "Pass Reception",
        "(Shotgun) J.Herbert pass short left to K.Lambert-Smith to KC 38 for 5 yards (N.Williams).",
        { statYardage: 5, need: 7, to: "2" },
      ),
    ),
    {
      result: "Stopped, turnover on downs",
      play: "Pass for 5 yards (needed 7)",
      tone: "bad",
    },
  );
  assert.deepEqual(
    out(
      play(
        "Pass Incompletion",
        "(Shotgun) J.Herbert pass incomplete short middle to T.Wease (R.Thomas).",
        { to: "2" },
      ),
    ),
    {
      result: "Stopped, turnover on downs",
      play: "Incomplete pass",
      tone: "bad",
    },
  );
  assert.deepEqual(
    out(
      play(
        "Passing Touchdown",
        "(Shotgun) T.Shough pass short middle to B.Lance for 2 yards, TOUCHDOWN.",
        { statYardage: 2, scoringPlay: true, down: -1, need: 2 },
      ),
    ),
    { result: "Touchdown", play: "Pass for 2 yards", tone: "good" },
  );
  assert.equal(
    out(
      play(
        "Sack",
        "(Shotgun) J.Daniels sacked at TB 41 for -11 yards (J.Ramsey).",
        { statYardage: -11, to: "2" },
      ),
    ).play,
    "Sacked for -11 yards",
  );
  assert.equal(
    out(
      play("Rush", "J.Winston left guard to NO 45 for 3 yards (P.Werner).", {
        statYardage: 3,
        need: 2,
      }),
    ).result,
    "Converted",
  );
  assert.equal(
    out(
      play(
        "Rush",
        "(Punt formation) T.Taylor right end to CHI 40 for 6 yards.",
        { statYardage: 6, need: 4 },
      ),
    ).play,
    "Fake punt: run for 6 yards",
  );
});

test("kicks", () => {
  assert.equal(
    out(
      play(
        "Field Goal Good",
        "D.Carlson 58 yard field goal is GOOD, Center-Z.Wood, Holder-R.Wright.",
        { scoringPlay: true, down: -1 },
      ),
    ).result,
    "Good from 58 yards",
  );
  assert.equal(
    out(
      play(
        "Field Goal Missed",
        "T.Loop 49 yard field goal is No Good, Wide Left, Center-N.Moore, Holder-R.Eckley.",
        { to: "2" },
      ),
    ).result,
    "No good from 49 yards (wide left)",
  );
  assert.equal(
    out(
      play(
        "Punt",
        "J.Stout punts 44 yards to NO 18, Center-B.Mann. B.Brown ran ob at NO 39 for 21 yards (A.Reese).",
        { statYardage: 21, to: "2" },
      ),
    ).result,
    "Punted 44 yards, returned 21 yards",
  );
  assert.equal(
    out(
      play(
        "Blocked Punt Touchdown",
        "R.Sanchez punt is BLOCKED by J.Chestnut, RECOVERED by TEN-O.Oladejo at IND 14. O.Oladejo for 14 yards, TOUCHDOWN.",
        { scoringPlay: true, to: "2" },
      ),
    ).result,
    "Blocked and returned for a touchdown",
  );
  // Typed as the fumble, but it was a punt.
  const muff = play(
    "Fumble Recovery (Opponent)",
    "J.Scott punts 35 yards to LAC 37, Center-J.Harris. N.Remigio to LAC 41 for -4 yards (T.Dye). FUMBLES (T.Dye), recovered by KC-Ca.Jones at LAC 41.",
  );
  assert.equal(actualOf(muff), "punt");
  assert.equal(out(muff).tone, "good");
});

test("a penalty after the play doesn't change its yards", () => {
  const p = play(
    "Pass Reception",
    "(Shotgun) D.Prescott pass short left to R.Flournoy to GB 12 for 11 yards (C.Valentine; J.Bullard).PENALTY on DAL-T.Booker, Unnecessary Roughness, 15 yards, enforced at GB 12.",
    { statYardage: -19, need: 5 },
  );
  assert.deepEqual(out(p), {
    result: "Converted",
    play: "Pass for 11 yards",
    tone: "good",
  });
});
