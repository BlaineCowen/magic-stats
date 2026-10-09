import type { ReactNode } from "react";
import { cn } from "@/components/polyhedge/cn";
import type { ArbSpan } from "@/lib/polyhedge/types";

function kindClass(s: ArbSpan): string {
  if (s.kind === "date") return "ph-hl-date";
  if (s.kind === "tz" || s.kind === "number") return "ph-hl-num";
  return "ph-hl-risk";
}

/** Full rule text with server-computed spans. Spans only apply to the exact
 * server-provided text; the caller passes [] when it had to rebuild the text. */
export function HighlightedRules({ text, spans }: { text: string; spans: ArbSpan[] }) {
  if (!text) return <div className="ph-rules-text ph-muted-2">(no text)</div>;
  const valid = spans
    .filter((s) => s.start >= 0 && s.end <= text.length && s.start < s.end)
    .sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  valid.forEach((s, i) => {
    if (s.start < cursor) return;
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(
      <mark
        key={i}
        className={cn(kindClass(s), s.one_sided && "ph-hl-onesided")}
        title={`${s.kind}${s.one_sided ? " — appears on this venue only" : ""}`}
      >
        {text.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <div className="ph-rules-text">{parts}</div>;
}
