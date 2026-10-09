import { fmt, sign, signedPct } from "@/lib/polyhedge/format";
import { cn } from "@/components/polyhedge/cn";

const colorMap = {
  pos: "ph-pos",
  neg: "ph-neg",
  neu: "ph-text",
  dim: "ph-muted",
};

interface Props {
  value: number | null | undefined;
  format?: "dollars" | "percent";
  bold?: boolean;
  className?: string;
}

export function PnLBadge({
  value,
  format = "dollars",
  bold = false,
  className,
}: Props) {
  const cls = colorMap[sign(value)];
  const text =
    value == null
      ? "—"
      : format === "dollars"
        ? fmt(value)
        : signedPct(value);
  return (
    <span
      className={cn(cls, className)}
      style={bold ? { fontWeight: 700 } : undefined}
    >
      {text}
    </span>
  );
}
