import type { Metadata } from "next";
import { TradeCalc } from "@/components/trade-calc/trade-calc";

export const metadata: Metadata = {
  title: "Trade calculator",
  description:
    "Grade a fantasy football trade with market values for your league's settings: redraft or dynasty, superflex, PPR and TE premium.",
};

export default function TradeCalcPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-5 pb-16 sm:pt-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Trade calculator
        </h1>
        <p className="mt-1.5 max-w-2xl text-base text-slate-600 sm:mt-2 sm:text-lg">
          Set up your league, put in what each team gets, and see who wins the
          trade. Dynasty leagues can trade draft picks too.
        </p>
      </header>
      <TradeCalc />
      <div className="mt-8 max-w-3xl space-y-2 text-sm text-slate-500">
        <p>
          Values come from FantasyCalc, which builds them from real trades in
          leagues with your settings, and update through the day. FantasyCalc
          has no TE premium setting, so tight ends are scaled up by about what
          the catch bonus adds.
        </p>
        <p>
          Grades account for two things a plain sum misses. Stars count for more
          than the pieces that add up to them: two players each worth half a
          star are worth about 80% of one. And the team that gets fewer players
          is credited a waiver-level player for each roster spot it frees up.
          Within 5% either way is a fair trade.
        </p>
      </div>
    </main>
  );
}
