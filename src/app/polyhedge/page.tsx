"use client";

import { useEffect, useState } from "react";
import { ALL_TABS, type Tab } from "@/components/polyhedge/TabNav";
import { StickyChrome } from "@/components/polyhedge/StickyChrome";
import { LiveSportsView } from "@/components/polyhedge/views/LiveSports";
import { ManualArbsView } from "@/components/polyhedge/views/ManualArbs";
import { DiscoveryView } from "@/components/polyhedge/views/Discovery";
import { WeatherView } from "@/components/polyhedge/views/Weather";
import { RtMiddlesView } from "@/components/polyhedge/views/RtMiddles";
import { OpenBetsView } from "@/components/polyhedge/views/OpenBets";
import { SettledView } from "@/components/polyhedge/views/Settled";
import { PnLView } from "@/components/polyhedge/views/PnL";
import { MakerView } from "@/components/polyhedge/views/Maker";
import { OverviewView } from "@/components/polyhedge/views/Overview";

export default function PolyhedgePage() {
  // Always render with the default tab on both SSR and the first client render
  // — reading localStorage in the initializer would diverge between the two
  // and trigger React's hydration mismatch error. Restore the saved tab in a
  // useEffect after mount; the brief flash is fine for an internal dashboard.
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (validTab(hash)) {
      setTab(hash as Tab);
      return;
    }
    try {
      const saved = window.localStorage.getItem("ph-tab2");
      if (saved && validTab(saved)) setTab(saved as Tab);
    } catch {
      /* localStorage unavailable; keep default */
    }
  }, []);

  function changeTab(t: Tab) {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
    try {
      window.localStorage.setItem("ph-tab2", t);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <StickyChrome active={tab} onTabChange={changeTab} />
      <main className="ph-container">
        {tab === "overview" && <OverviewView onOpen={changeTab} />}
        {tab === "live-sports" && <LiveSportsView />}
        {tab === "manual-arbs" && <ManualArbsView />}
        {tab === "discovery" && <DiscoveryView />}
        {tab === "weather" && <WeatherView />}
        {tab === "rt-middles" && <RtMiddlesView />}
        {tab === "open-bets" && <OpenBetsView />}
        {tab === "settled" && <SettledView />}
        {tab === "pnl" && <PnLView />}
        {tab === "maker" && <MakerView />}
      </main>
    </>
  );
}

function validTab(s: string): boolean {
  return (ALL_TABS as string[]).includes(s);
}
