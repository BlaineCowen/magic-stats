import type { Metadata } from "next";
import { PickemView } from "@/components/pickem/pickem-view";

export const metadata: Metadata = {
  title: "Pick'em",
  description:
    "Confidence pool helper: picks and confidence order from Vegas odds, tuned to win your pool, with live scores.",
};

export default function PickemPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 pb-16 sm:pt-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Pick&apos;em
        </h1>
        <p className="mt-1.5 max-w-2xl text-base text-slate-600 sm:mt-2 sm:text-lg">
          Your confidence pool picks, ordered by Vegas odds and tuned to win
          your pool, with live scores on game day. Tap a team to change a pick
          and the arrows to move it up or down.
        </p>
      </header>
      <PickemView />
      <p className="mt-8 max-w-3xl text-sm text-slate-500">
        Win chances come from DraftKings moneylines on ESPN (or the spread when
        there&apos;s no moneyline). &ldquo;Optimize picks&rdquo; simulates your
        pool thousands of times, using how your office actually picked when you
        enter it, and keeps the picks and order that finish first most often.
        Picks you change by hand are pinned and stay put. Everything is saved in
        this browser.
      </p>
    </main>
  );
}
