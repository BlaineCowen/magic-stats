import type { Metadata } from "next";
import { headers } from "next/headers";
import { NflQuery } from "@/components/nfl-query";
import { TIER_LIMITS, TIER_NAME, viewerFrom } from "@/lib/query-limits";

export const metadata: Metadata = {
  title: "Magic Stats",
  description:
    "Ask any NFL stats question in plain English. Answers come from every play since 1999.",
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
