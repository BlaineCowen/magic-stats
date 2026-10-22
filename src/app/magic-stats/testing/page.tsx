import { headers } from "next/headers";
import { MembersOnly } from "@/components/ask/members-only";
import { NflQuery } from "@/components/nfl-query";
import { isMember } from "@/lib/query-limits";

// Same UI with every attempt shown and the result cache bypassed.
export default async function TestingPage() {
  if (!isMember(await headers())) return <MembersOnly />;
  return <NflQuery debug />;
}
