import { Barlow, Barlow_Condensed } from "next/font/google";
import { NflNav } from "@/components/nfl-nav";
import { cn } from "@/lib/utils";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
});

/**
 * The frame every NFL page shares: a turf header with the wordmark and the section nav, then the
 * page on chalk. Used by the /magic-stats layout and the /nfl/ hub (which lives outside it).
 */
export function NflShell({
  children,
  bare = false,
}: {
  children: React.ReactNode;
  /** Wordmark only, no links: public share pages show just the result. */
  bare?: boolean;
}) {
  const wordmark = (
    <>
      <span className="font-display block text-[1.7rem] leading-none font-extrabold tracking-tight">
        Blaine&apos;s Sports Tools
      </span>
      {/* the first-down line */}
      <span
        aria-hidden
        className="bg-line mt-1.5 block h-[3px] w-10 transition-all group-hover:w-16"
      />
    </>
  );
  return (
    <div
      className={cn(
        barlow.variable,
        barlowCondensed.variable,
        "bg-chalk font-nfl min-h-screen text-slate-900",
      )}
    >
      {!bare && (
        <a
          href="#content"
          className="bg-line text-turf-950 sr-only z-50 rounded px-3 py-2 font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
      )}
      <header className="bg-turf-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:pt-5">
          {bare ? (
            <div className="shrink-0 pb-3 sm:pb-4">{wordmark}</div>
          ) : (
            <>
              <a
                href="/nfl/"
                className="group shrink-0 pb-1 sm:pb-3"
                aria-label="Blaine's Sports Tools home"
              >
                {wordmark}
              </a>
              <NflNav />
            </>
          )}
        </div>
      </header>
      <div id="content">{children}</div>
    </div>
  );
}
