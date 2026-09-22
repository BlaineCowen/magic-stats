import { Suspense } from "react";
import type { Metadata } from "next";
import { ChartsView } from "@/components/charts/charts-view";

export const metadata: Metadata = {
  title: "NFL Charts",
  description:
    "Team tiers and quarterback EPA charts from nflverse play-by-play",
};

export default function ChartsPage() {
  // ChartsView reads the URL's search params, which needs a Suspense boundary.
  return (
    <Suspense>
      <ChartsView />
    </Suspense>
  );
}
