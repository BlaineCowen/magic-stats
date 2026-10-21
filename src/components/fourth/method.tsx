"use client";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

type Row = [string, string, string];

function Table({ head, rows }: { head: Row; rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-gray-100 last:border-0">
              {r.map((c, i) => (
                <td
                  key={i}
                  className={i ? "py-1.5 pr-4 tabular-nums" : "py-1.5 pr-4"}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Method() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="The idea">
        <p>
          On 4th down a coach has three choices. For each one the model asks:
          across everything that could happen on this play, how likely is this
          team to win the game? The choice with the highest win probability is
          the recommendation, and the gap to the next best choice says how much
          it matters.
        </p>
        <p>
          This is the method behind Ben Baldwin&apos;s nfl4th. Four models feed
          it, all trained here from nflverse play-by-play:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Win probability</b>: score, clock, field position, down and
            distance, timeouts and the betting line.
          </li>
          <li>
            <b>Go for it</b>: the full spread of yards gained on a 3rd/4th down
            snap, so a 4th &amp; 2 knows about both the 1-yard stuff and the
            40-yard catch.
          </li>
          <li>
            <b>Field goal</b>: make probability by distance, era, roof,
            temperature and wind.
          </li>
          <li>
            <b>Punt</b>: where the other team ends up taking over, from every
            punt since 2015.
          </li>
        </ul>
      </Section>

      <Section title="Reading a result">
        <p>
          <b>Win probability</b> numbers are the offense&apos;s chance to win
          after making that choice. A &ldquo;3.0&rdquo; gap means 3 percentage
          points, roughly the value of a turnover in a close game&apos;s second
          half.
        </p>
        <Table
          head={["Label", "Gap (points)", "Meaning"]}
          rows={[
            ["Toss-up", "under 1", "Either call is fine"],
            ["Lean", "1 – 2.25", "Small edge"],
            ["Strong", "2.25 – 5", "Clear edge"],
            ["Very strong", "5 – 10", "Big mistake to get wrong"],
            ["No-brainer", "10+", "Game-deciding"],
          ]}
        />
        <p>
          <b>Break-even</b> is the conversion rate at which going for it ties
          the best kick. If the model expects a 60% conversion and break-even is
          40%, going wins comfortably; if they&apos;re close, it&apos;s a
          judgment call about this offense and this defense.
        </p>
      </Section>

      <Section title="What's different from nfl4th">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Kickoffs that match the rules.</b> nfl4th puts every post-score
            drive at the 25. Since the 2024 kickoff rules, drives have started
            around the 30, which makes kicking a field goal (and giving the ball
            back) a bit worse than nfl4th thinks.
          </li>
          <li>
            <b>Punts from the real next snap.</b> Muffs, blocks, return
            touchdowns and penalties all come from what actually happened next,
            and the table covers every yard line. (nfl4th&apos;s punt table has
            its block and return-TD rates swapped, and stops at the
            opponent&apos;s 30.)
          </li>
          <li>
            <b>A sharper conversion model.</b> 2006–2025 including playoffs
            (nfl4th uses 2014–2019 regular season), deeper trees that can tell a
            real 4th down attempt from a 3rd down, with fake punts and field
            goals left out (they convert far more often than a real attempt from
            the same spot).
          </li>
          <li>
            <b>Weather-aware field goals.</b> Wind and temperature move long
            kicks.
          </li>
          <li>
            <b>Plain-English output.</b> A single verdict, how sure it is, and
            the conversion rate needed.
          </li>
        </ul>
      </Section>

      <Section title="Where nfl4th falls short">
        <p>
          nfl4th is the standard public 4th down model, and the method here is
          borrowed from it. Reading its source (nflverse/nfl4th) turned up some
          things that are out of date or wrong. Most move a recommendation by
          less than a point; they matter in close calls.
        </p>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Issue</th>
                <th className="py-1.5 pr-3 font-medium">Type</th>
                <th className="py-1.5 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                [
                  "Every drive after a score starts at the 25",
                  "Out of date",
                  "Since the 2024 kickoff rules, drives have started around the 30 (2024–26 average). Scoring and kicking off is worth a bit less than it assumes.",
                ],
                [
                  "Punt table swaps the blocked-punt and return-TD rates",
                  "Bug",
                  "Both are under 1% of punts, so the effect is tiny.",
                ],
                [
                  "No punt value inside the opponent's 30",
                  "Gap",
                  "Punting from there is rare, but it shows up as a missing option.",
                ],
                [
                  "No overtime",
                  "Gap",
                  "It can't grade overtime decisions at all, including Super Bowl LVIII's.",
                ],
                [
                  "Conversion model uses 2014–19 regular-season plays",
                  "Out of date",
                  "Misses the recent rise in short-yardage success and all playoff games.",
                ],
                [
                  "3rd and 4th downs pooled in very shallow trees",
                  "Design choice",
                  "It can't learn that real 4th-down attempts convert differently from 3rd downs at the same distance.",
                ],
                [
                  "Team quality only through the betting line",
                  "Design choice",
                  "Reasonable. Adding offense and defense EPA didn't improve predictions here either.",
                ],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-gray-800">{a}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-gray-500">
                    {b}
                  </td>
                  <td className="py-1.5 text-gray-700">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Do 4th down bots overrate going for it?">
        <p>
          Not on conversion odds. On real 4th-down attempts in 2023–25 (held out
          of training), an nfl4th-style model expected about 54% conversions and
          teams made about 60%. If anything these models lean toward kicking.
        </p>
        <p>
          Two caveats. Some of that gap is selection: coaches go when they like
          the matchup, so attempts that happened convert more than a random team
          would. And the strongest published criticism is about confidence, not
          conversion odds: Brill, Yurko and Wyner (&ldquo;Analytics, have some
          humility&rdquo;, 2023) show that once model uncertainty is counted,
          many recommendations aren&apos;t statistically clear-cut. That&apos;s
          why anything under a 1-point gap is labeled a toss-up here.
        </p>
        <p>
          Adding score and clock to the conversion model scored slightly better
          on held-out seasons but made it learn <i>who</i> chooses to go rather
          than how often a normal attempt works: it put 4th &amp; 12 from your
          own 20 at 56%. So it&apos;s left out.
        </p>
      </Section>

      <Section title="How well it holds up">
        <p>
          Every model was tested on the 2023–2025 seasons with those seasons
          held out of training.
        </p>
        <Table
          head={["Model", "Ours", "Reference"]}
          rows={[
            [
              "Win probability (log loss)",
              "0.4487",
              "0.4479 nflfastR, in-sample",
            ],
            ["Field goal (log loss)", "0.3614", "0.3631 without weather"],
            ["4th down conversion (log loss)", "0.6362", "0.6420 nfl4th-style"],
          ]}
        />
        <p className="text-gray-500">
          Lower is better. nflfastR&apos;s win probability was trained on those
          same seasons, so matching it out of sample is the bar.
        </p>
      </Section>

      <Section title="What it can't see">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Team quality only enters through the betting line. (Adding each
            offense&apos;s and defense&apos;s EPA per play didn&apos;t improve
            predictions beyond the line, so it was left out.)
          </li>
          <li>
            Recent offenses still convert short 4th downs more often than any of
            these models expect. On 2026 games it hadn&apos;t seen, this one
            predicted 57% on 4th &amp; 2–5 and teams made 65% (97 tries). Some
            of that is coaches only going when they like the matchup, but it
            means close calls lean toward kicking.
          </li>
          <li>
            Injuries, momentum, the specific play call and the kicker&apos;s
            range in warm-ups.
          </li>
          <li>
            Overtime is handled separately on the Super Bowl LVIII card, because
            the playoff overtime rules changed in 2022 and there are too few
            games to train on.
          </li>
          <li>
            Uncertainty: two win-probability models trained on different seasons
            can disagree by a point or two. Treat toss-ups as toss-ups.
          </li>
        </ul>
      </Section>
    </div>
  );
}
