"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Ask a question" },
  { href: "/charts", label: "Charts" },
];

export function NflNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex justify-center gap-6 border-b border-gray-200 text-sm">
      {LINKS.map((l) => {
        const active =
          l.href === "/"
            ? pathname === "/" || pathname === "/testing"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2 font-medium",
              active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
