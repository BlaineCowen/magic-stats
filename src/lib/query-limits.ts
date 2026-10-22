/**
 * Spending gates for /api/query, which calls a paid LLM (OpenRouter). Cached answers are free and
 * don't count. Counters live in memory, so a deploy or restart resets them; the OpenRouter key's
 * own credit limit is the backstop behind these.
 *
 * Magic Stats sits behind blaine-auth, and nfl-router forwards who is asking (X-Authentik-Username)
 * and their tier (X-Blaine-Tier, from their Authentik groups). Anyone can send those headers on an
 * ungated path, so they only count when X-Blaine-Auth carries AUTH_PROXY_SECRET, which only nginx
 * knows. Signed-in people are counted by username; anyone else (dev, a misrouted request, a forged
 * header) is counted by IP at the Homie limits.
 */

import { timingSafeEqual } from "node:crypto";

export const MAX_QUESTION_CHARS = 300;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type Tier = "owner" | "bae" | "homie";

export const TIER_NAME: Record<Tier, string> = {
  owner: "Owner",
  bae: "Bae",
  homie: "Homie",
};

type PersonLimits = { perHour: number; perDay: number; deepPerDay: number };

// owner has no personal limit, only the site-wide ones
export const TIER_LIMITS: Record<Tier, PersonLimits | null> = {
  owner: null,
  bae: { perHour: 50, perDay: 200, deepPerDay: 40 },
  homie: { perHour: 20, perDay: 60, deepPerDay: 10 },
};

const SITE = {
  fastPerDay: 1500, // ~$1.20/day at a typical $0.0008 a question
  deepPerDay: 150,
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

export type Viewer = { name: string | null; tier: Tier; keys: string[] };

/** The request came through the blaine-auth gate in nginx. */
function fromAuthProxy(h: Headers): boolean {
  const secret = process.env.AUTH_PROXY_SECRET;
  const sent = h.get("x-blaine-auth");
  if (!secret || !sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function viewerFrom(h: Headers): Viewer {
  const name = fromAuthProxy(h) ? h.get("x-authentik-username") : null;
  const raw = h.get("x-blaine-tier");
  const tier: Tier =
    name && (raw === "owner" || raw === "bae" || raw === "homie")
      ? raw
      : "homie";
  if (name) return { name, tier, keys: [`user:${name}`] };
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  return { name: null, tier, keys: [`ip:${ip}`] };
}

export type Gate =
  | { ok: true; release: () => void }
  | { ok: false; status: number; error: string; retryAfter?: number };

/** Check every limit for this question; on success, count it and hold the visitor's slot. */
export function admit(
  { keys, tier }: Pick<Viewer, "keys" | "tier">,
  deep: boolean,
): Gate {
  const now = Date.now();
  const limits = TIER_LIMITS[tier];
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
    siteStamps.length >= (deep ? SITE.deepPerDay : SITE.fastPerDay)
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
    if (!limits) break;
    const b = people.get(k);
    if (b) {
      prune(b.stamps, now);
      if (recent(b.stamps, HOUR, now) >= limits.perHour) {
        const oldest = b.stamps.find((t) => now - t < HOUR)!;
        return {
          ok: false,
          status: 429,
          error: `That's ${limits.perHour} questions this hour. Try again in a bit.`,
          retryAfter: Math.ceil((HOUR - (now - oldest)) / 1000),
        };
      }
      if (b.stamps.length >= limits.perDay) {
        return {
          ok: false,
          status: 429,
          error: `That's ${limits.perDay} questions today. Come back tomorrow.`,
          retryAfter: Math.ceil((DAY - (now - b.stamps[0]!)) / 1000),
        };
      }
    }
    if (deep) {
      const d = deepPeople.get(k);
      if (d) {
        prune(d.stamps, now);
        if (d.stamps.length >= limits.deepPerDay) {
          return {
            ok: false,
            status: 429,
            error: `"Think harder" is limited to ${limits.deepPerDay} a day. Regular questions still work.`,
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
