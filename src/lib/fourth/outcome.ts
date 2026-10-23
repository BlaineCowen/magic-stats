import type { OptionKey } from "./engine";

/** The parts of an ESPN play the result is read from. */
export type PlayResultInput = {
  type?: { text?: string };
  text: string;
  statYardage?: number;
  scoringPlay?: boolean;
  isTurnover?: boolean;
  start?: { distance?: number; team?: { id: string } };
  end?: { down?: number; team?: { id: string } };
};

/** What happened on a 4th down play, for the line under the call. */
export type Outcome = {
  /** "Converted", "Stopped short", "Good from 58 yards", "Punted 44 yards" */
  result: string;
  /** "Pass for 14 yards", "Run for 2 yards (needed 3)", or null for kicks */
  play: string | null;
  tone: "good" | "bad" | "neutral";
};

/** Which option the offense took, or null for timeouts, penalties and the like. */
export function actualOf(
  p: Pick<PlayResultInput, "type" | "text">,
): OptionKey | null {
  const t = (p.type?.text ?? "").toLowerCase();
  const text = p.text.toLowerCase();
  // A punt or kick whose return was fumbled is typed as the fumble; the text still says who kicked.
  if (t.includes("punt") || /\bpunts\b/.test(text)) return "punt";
  if (t.includes("field goal") || / yard field goal\b/.test(text)) return "fg";
  if (
    /rush|pass|sack|interception|fumble|touchdown/.test(t) &&
    !/kickoff|extra point|two-point/.test(t)
  )
    return "go";
  return null;
}

const yards = (n: number) => `${n} yard${Math.abs(n) === 1 ? "" : "s"}`;

function playKind(p: PlayResultInput): string {
  const t = (p.type?.text ?? "").toLowerCase();
  const text = p.text.toLowerCase();
  const fake = /punt formation/.test(text)
    ? "Fake punt: "
    : /field goal formation/.test(text)
      ? "Fake field goal: "
      : "";
  let kind: string;
  if (t.includes("sack")) kind = "Sacked";
  else if (/\bscrambles\b/.test(text)) kind = "QB scramble";
  else if (/pass|interception/.test(t) || /\bpass\b/.test(text))
    kind = /incomplete/.test(text) ? "Incomplete pass" : "Pass";
  else kind = "Run";
  return fake ? fake + kind.charAt(0).toLowerCase() + kind.slice(1) : kind;
}

/** Read the result of a 4th down play from ESPN's feed. */
export function outcomeOf(p: PlayResultInput, actual: OptionKey): Outcome {
  const text = p.text;
  const lower = text.toLowerCase();
  // ESPN's statYardage nets out penalties on the play; the text before "PENALTY" has the play's own yards.
  const played = text.split(/PENALTY/)[0]!;
  const fromText = /\bfor no gain\b/i.test(played)
    ? 0
    : /\bfor (-?\d+) yards?\b/i.exec(played)?.[1];
  const gained = fromText != null ? Number(fromText) : (p.statYardage ?? 0);
  const kept =
    p.start?.team?.id != null &&
    p.end?.team?.id != null &&
    p.start.team.id === p.end.team.id;

  if (actual === "fg") {
    const dist = /(\d+) yard field goal/i.exec(text)?.[1];
    const from = dist ? ` from ${dist} yards` : "";
    if (/blocked/i.test(text))
      return { result: "Blocked", play: null, tone: "bad" };
    if (/is good/i.test(text))
      return { result: `Good${from}`, play: null, tone: "good" };
    const why = /no good, ([^,.]+)/i.exec(text)?.[1]?.toLowerCase();
    return {
      result: `No good${from}${why ? ` (${why})` : ""}`,
      play: null,
      tone: "bad",
    };
  }

  if (actual === "punt") {
    if (/blocked/i.test(text))
      return {
        result: p.scoringPlay
          ? "Blocked and returned for a touchdown"
          : "Blocked",
        play: null,
        tone: "bad",
      };
    if (p.scoringPlay && /touchdown/i.test(text))
      return { result: "Returned for a touchdown", play: null, tone: "bad" };
    const dist = /punts (\d+) yards?/i.exec(text)?.[1];
    const how = /touchback/i.test(text)
      ? ", touchback"
      : /fair catch/i.test(text)
        ? ", fair catch"
        : /downed/i.test(text)
          ? ", downed"
          : /out of bounds/i.test(text)
            ? ", out of bounds"
            : gained > 0
              ? `, returned ${yards(gained)}`
              : "";
    if (/muffs|fumbles/i.test(text) && kept)
      return {
        result: `Punted${dist ? ` ${dist} yards` : ""}, return fumbled and recovered by the punting team`,
        play: null,
        tone: "good",
      };
    return {
      result: `Punted${dist ? ` ${dist} yards` : ""}${how}`,
      play: null,
      tone: "neutral",
    };
  }

  // Went for it.
  const kind = playKind(p);
  const need = p.start?.distance;
  const play =
    kind === "Incomplete pass" || kind.endsWith("incomplete pass")
      ? kind
      : `${kind} for ${yards(gained)}`;
  if (p.scoringPlay && /touchdown/i.test(lower) && kept)
    return { result: "Touchdown", play, tone: "good" };
  if (
    /intercepted/i.test(text) ||
    (p.type?.text ?? "").toLowerCase().includes("interception")
  )
    return { result: "Intercepted", play, tone: "bad" };
  if (p.isTurnover && /fumbles/i.test(text) && !kept)
    return { result: "Fumbled away", play, tone: "bad" };
  const converted =
    kept && p.end?.down === 1
      ? true
      : p.end?.team?.id != null
        ? false
        : need != null && gained >= need;
  if (converted) return { result: "Converted", play, tone: "good" };
  return {
    result: "Stopped, turnover on downs",
    play:
      need != null && gained > 0 && gained < need
        ? `${play} (needed ${need})`
        : play,
    tone: "bad",
  };
}
