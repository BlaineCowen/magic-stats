"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/nfl/", label: "NFL home" },
  { href: "/magic-stats", label: "Ask a question" },
  { href: "/magic-stats/charts", label: "Charts" },
  { href: "/magic-stats/fourth-down", label: "4th Down" },
];

export function NflNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex justify-start gap-x-5 gap-y-2 overflow-x-auto border-b border-gray-200 text-sm sm:justify-center sm:gap-x-6">
      {LINKS.map((l) => {
        const active =
          l.href === "/nfl/"
            ? false
            : l.href === "/magic-stats"
              ? pathname === "/magic-stats" ||
                pathname === "/magic-stats/testing"
              : pathname.startsWith(l.href);
        const cls = cn(
          "-mb-px border-b-2 px-1 pb-2 font-medium whitespace-nowrap",
          active
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-gray-500 hover:text-gray-800",
        );
        // /nfl/ is the hub, which nfl-router serves from another route: a full page load, not a client nav
        return l.href === "/nfl/" ? (
          <a key={l.href} href={l.href} className={cls}>
            {l.label}
          </a>
        ) : (
          <Link key={l.href} href={l.href} className={cls}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
