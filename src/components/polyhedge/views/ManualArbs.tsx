"use client";

import { useState } from "react";
import { Section } from "@/components/polyhedge/ui/Section";
import { ScanForm } from "@/components/polyhedge/features/manualArbs/ScanForm";
import { MarketMatcher } from "@/components/polyhedge/features/manualArbs/MarketMatcher";
import { ActivePairsTable } from "@/components/polyhedge/features/manualArbs/ActivePairsTable";
import { HistoryTable } from "@/components/polyhedge/features/manualArbs/HistoryTable";
import type { ManualArbScanResponse } from "@/lib/polyhedge/types";

export function ManualArbsView() {
  const [scan, setScan] = useState<{
    urls: { kalshi_url: string; poly_url: string };
    data: ManualArbScanResponse;
  } | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Section title="Manual Arbs · Scan & Pair" variant="manual">
        <ScanForm onScanned={(urls, data) => setScan({ urls, data })} />
        {scan && <MarketMatcher scan={scan.data} urls={scan.urls} />}
      </Section>

      <Section title="Active Pairs" variant="manual">
        <ActivePairsTable />
      </Section>

      <Section
        title="Settled History (180 days)"
        variant="manual"
        defaultCollapsed
      >
        <HistoryTable />
      </Section>
    </div>
  );
}
