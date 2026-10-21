import { Suspense } from "react";
import type { Metadata } from "next";
import { FourthDownView } from "@/components/fourth/fourth-down-view";

export const metadata: Metadata = {
  title: "4th Down Decisions",
  description:
    "Go for it, kick or punt: a win probability 4th down model after nfl4th, with Super Bowl case studies",
};

export default function FourthDownPage() {
  // FourthDownView reads the URL's search params, which needs a Suspense boundary.
  return (
    <Suspense>
      <FourthDownView />
    </Suspense>
  );
}
