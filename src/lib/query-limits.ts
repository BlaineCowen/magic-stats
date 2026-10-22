/**
 * Spending gates for /api/query, which calls a paid LLM (OpenRouter). Cached answers are free and
 * don't count. Counters live in memory, so a deploy or restart resets them; the OpenRouter key's
 * own credit limit is the backstop behind these.
 *
 * Each visitor is counted by IP (Cloudflare's connecting IP, which the client can't forge) and,
 * when blaine-auth forwards it, by username too. A forged username only earns a fresh per-user
 * bucket; the per-IP and site-wide limits still apply.
 */

export const MAX_QUESTION_CHARS = 300;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const LIMITS = {
  perHour: 20,
  perDay: 60,
  deepPerDay: 10,
  siteFastPerDay: 1500, // ~$1.20/day at a typical $0.0008 a question
  siteDeepPerDay: 150,
};

type Bucket = { stamps: number[] };
const people = new Map<string, Bucket>();
const deepPeople = new Map<string, Bucket>();
const site = { fast: [] as number[], deep: [] as number[] };
const inFlight = new Set<string>();

function recent(stamps: number[], windowMs: number, now: number) {
  return stamps.filter((t) => now - t < windowMs).length;
}

function prune(stamps: number[], now: number) {
  while (stamps.length && now - stamps[0]! >= DAY) stamps.shift();
}

export function visitorKeys(request: Request): string[] {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const user = h.get("x-authentik-username");
  return user ? [`ip:${ip}`, `user:${user}`] : [`ip:${ip}`];
}

export type Gate =
  | { ok: true; release: () => void }
  | { ok: false; status: number; error: string; retryAfter?: number };

/** Check every limit for this question; on success, count it and hold the visitor's slot. */
export function admit(keys: string[], deep: boolean): Gate {
  const now = Date.now();
  if (keys.some((k) => inFlight.has(k))) {
    return {
      ok: false,
      status: 429,
      error: "You already have a question running. Wait for it to finish.",
    };
  }

  const siteStamps = deep ? site.deep : site.fast;
  prune(siteStamps, now);
  if (
    siteStamps.length >= (deep ? LIMITS.siteDeepPerDay : LIMITS.siteFastPerDay)
  ) {
    return {
      ok: false,
      status: 429,
      error:
        "The site has hit its question limit for today. Try again tomorrow.",
      retryAfter: Math.ceil((DAY - (now - siteStamps[0]!)) / 1000),
    };
  }

  for (const k of keys) {
    const b = people.get(k);
    if (b) {
      prune(b.stamps, now);
      if (recent(b.stamps, HOUR, now) >= LIMITS.perHour) {
        const oldest = b.stamps.find((t) => now - t < HOUR)!;
        return {
          ok: false,
          status: 429,
          error: `That's ${LIMITS.perHour} questions this hour. Try again in a bit.`,
          retryAfter: Math.ceil((HOUR - (now - oldest)) / 1000),
        };
      }
      if (b.stamps.length >= LIMITS.perDay) {
        return {
          ok: false,
          status: 429,
          error: `That's ${LIMITS.perDay} questions today. Come back tomorrow.`,
          retryAfter: Math.ceil((DAY - (now - b.stamps[0]!)) / 1000),
        };
      }
    }
    if (deep) {
      const d = deepPeople.get(k);
      if (d) {
        prune(d.stamps, now);
        if (d.stamps.length >= LIMITS.deepPerDay) {
          return {
            ok: false,
            status: 429,
            error: `"Think harder" is limited to ${LIMITS.deepPerDay} a day. Regular questions still work.`,
            retryAfter: Math.ceil((DAY - (now - d.stamps[0]!)) / 1000),
          };
        }
      }
    }
  }

  siteStamps.push(now);
  for (const k of keys) {
    const b = people.get(k) ?? { stamps: [] };
    b.stamps.push(now);
    people.set(k, b);
    if (deep) {
      const d = deepPeople.get(k) ?? { stamps: [] };
      d.stamps.push(now);
      deepPeople.set(k, d);
    }
    inFlight.add(k);
  }
  // drop idle visitors so the maps don't grow forever
  if (people.size > 5000) {
    for (const [k, b] of people)
      if (!b.stamps.some((t) => now - t < DAY)) people.delete(k);
  }
  return { ok: true, release: () => keys.forEach((k) => inFlight.delete(k)) };
}
