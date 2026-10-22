import type { Metadata } from "next";
import { headers } from "next/headers";
import { NflQuery } from "@/components/nfl-query";
import { TIER_LIMITS, TIER_NAME, viewerFrom } from "@/lib/query-limits";

export const metadata: Metadata = {
  title: "Magic Stats",
  description:
    "Ask NFL, NBA and MLB stats questions in plain English, from play-by-play, box scores, advanced stats and Statcast.",
};

export default async function Home() {
  const v = viewerFrom(await headers());
  const limits = TIER_LIMITS[v.tier];
  return (
    <NflQuery
      viewer={
        v.name
          ? {
              name: v.name,
              tier: TIER_NAME[v.tier],
              perDay: limits?.perDay ?? null,
            }
          : undefined
      }
    />
  );
}
