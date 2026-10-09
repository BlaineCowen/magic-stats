import { Badge } from "@/components/polyhedge/ui/Badge";

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  const s = severity ?? "NONE";
  if (s === "BLOCK") return <Badge className="ph-badge-block">BLOCK</Badge>;
  if (s === "WARN") return <Badge className="ph-badge-warn">WARN</Badge>;
  return <Badge className="ph-badge-none">CLEAN</Badge>;
}
