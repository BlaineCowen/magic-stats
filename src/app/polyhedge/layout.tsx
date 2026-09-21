import type { ReactNode } from "react";
import { QueryProvider } from "@/components/polyhedge/QueryProvider";
import "./polyhedge.css";

export const metadata = {
  title: "Poly-Hedge Monitor",
  // Override magic-stats's root favicon for this route only.
  // Next.js v15 picks up app/polyhedge/icon.svg via file-based metadata, but
  // the root layout declares an explicit `icons` array which wins precedence;
  // re-declaring it here puts our svg back on top.
  icons: [
    { rel: "icon", url: "/polyhedge/icon.svg", type: "image/svg+xml" },
  ],
};

export default function PolyhedgeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ph-root">
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
