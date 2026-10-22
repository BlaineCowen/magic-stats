"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/nfl/", label: "Home" },
  { href: "/magic-stats", label: "Magic Stats" },
  { href: "/magic-stats/charts", label: "Charts" },
  { href: "/magic-stats/fourth-down", label: "4th down" },
];

function isActive(href: string, pathname: string) {
  if (href === "/nfl/") return pathname === "/nfl-hub" || pathname === "/nfl";
  if (href === "/magic-stats")
    return pathname === "/magic-stats" || pathname === "/magic-stats/testing";
  return pathname.startsWith(href);
}

export function NflNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="NFL sections"
      className="nfl-scroll-fade -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="font-display flex gap-6 text-lg font-semibold tracking-wide">
        {LINKS.map((l) => {
          const active = isActive(l.href, pathname);
          const cls = cn(
            "block border-b-[3px] pt-2 pb-2.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line",
            active
              ? "border-line text-white"
              : "border-transparent text-turf-100/75 hover:text-white",
          );
          return (
            <li key={l.href}>
              {/* /nfl/ is the hub, which nfl-router serves from another route: a full page load */}
              {l.href === "/nfl/" ? (
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
