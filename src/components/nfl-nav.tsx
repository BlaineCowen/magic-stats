"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/nfl/", label: "Home" },
  { href: "/magic-stats", label: "Magic Stats" },
  { href: "/magic-stats/fantasy", label: "Fantasy" },
  { href: "/magic-stats/pickem", label: "Pick'em" },
  { href: "/magic-stats/charts", label: "NFL charts" },
  { href: "/magic-stats/fourth-down", label: "NFL 4th down" },
];

function isActive(href: string, pathname: string) {
  if (href === "/nfl/") return pathname === "/nfl-hub" || pathname === "/nfl";
  if (href === "/magic-stats")
    return pathname === "/magic-stats" || pathname === "/magic-stats/testing";
  if (href === "/magic-stats/fantasy")
    return (
      pathname.startsWith(href) || pathname.startsWith("/magic-stats/players")
    );
  return pathname.startsWith(href);
}

export function NflNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Site sections"
      className="nfl-scroll-fade -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="font-display flex gap-5 text-base font-semibold tracking-wide sm:gap-6 sm:text-lg">
        {LINKS.map((l) => {
          const active = isActive(l.href, pathname);
          const cls = cn(
            "block border-b-[3px] pt-1.5 pb-2 whitespace-nowrap sm:pt-2 sm:pb-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line",
            active
              ? "border-line text-white"
              : "border-transparent text-turf-100/75 hover:text-white",
          );
          return (
            <li key={l.href}>
              {/* full page loads for the hub (served from another route) and Magic Stats (its
                  sign-in redirect can't happen inside a client-side fetch) */}
              {l.href === "/nfl/" || l.href === "/magic-stats" ? (
                <a
                  href={l.href}
                  className={cls}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  href={l.href}
                  className={cls}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
