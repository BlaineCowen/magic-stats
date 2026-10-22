import type { Metadata } from "next";
import { NflShell } from "@/components/nfl-shell";

// Public, signed-out pages: the result and nothing that leads into the tools.
export const metadata: Metadata = {
  title: {
    template: "%s | Blaine's Sports Tools",
    default: "Blaine's Sports Tools",
  },
  icons: {
    icon: { url: "/magic-stats/icon.svg", type: "image/svg+xml" },
    apple: "/magic-stats/apple-icon",
  },
  robots: { index: false },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NflShell bare>{children}</NflShell>;
}
