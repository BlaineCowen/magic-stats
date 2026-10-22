import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedAnswer } from "@/components/ask/shared-answer";
import { loadShare } from "@/lib/sports/shares";

type Props = { params: Promise<{ id: string }> };

// Public: anyone with the link can read it, no sign-in.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await loadShare((await params).id);
  if (!share) return { title: "Not found" };
  const a = share.answer;
  const description =
    "kind" in a
      ? `The case for ${a.player}: ${a.findings.length} stats from the ${a.scope}.`
      : (a.explain ?? "An answer from Magic Stats.");
  return {
    title: share.question,
    description,
    openGraph: { title: share.question, description, type: "article" },
    robots: { index: false },
  };
}

export default async function SharedPage({ params }: Props) {
  const share = await loadShare((await params).id);
  if (!share) notFound();
  return <SharedAnswer share={share} />;
}
