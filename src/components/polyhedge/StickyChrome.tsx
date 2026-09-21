"use client";

import { useRef } from "react";
import { TopBar } from "@/components/polyhedge/TopBar";
import { TabNav, type Tab } from "@/components/polyhedge/TabNav";
import { useChromeHeight } from "@/lib/polyhedge/useChromeHeight";

interface Props {
  active: Tab;
  onTabChange: (t: Tab) => void;
}

export function StickyChrome({ active, onTabChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useChromeHeight(ref);
  return (
    <div ref={ref} className="ph-chrome">
      <TopBar />
      <TabNav active={active} onChange={onTabChange} />
    </div>
  );
}
