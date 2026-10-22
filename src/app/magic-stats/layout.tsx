import type { Metadata } from "next";
import { NflShell } from "@/components/nfl-shell";

export const metadata: Metadata = {
  title: {
    template: "%s | Blaine's Sports Tools",
    default: "Blaine's Sports Tools",
  },
  // the root layout's explicit icons would win over the file convention, so name them here
  icons: {
    icon: { url: "/magic-stats/icon.svg", type: "image/svg+xml" },
    apple: "/magic-stats/apple-icon",
  },
};

export default function MagicStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NflShell>{children}</NflShell>;
}
