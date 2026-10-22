import { isMember, viewerFrom } from "@/lib/query-limits";

/** The signed-in blaine-auth username, or null for signed-out visitors. */
export function pickemUser(h: Headers): string | null {
  if (!process.env.AUTH_PROXY_SECRET) return null;
  return isMember(h) ? viewerFrom(h).name : null;
}
