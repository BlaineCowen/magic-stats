import { NflShell } from "@/components/nfl-shell";

export default function MagicStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NflShell>{children}</NflShell>;
}
