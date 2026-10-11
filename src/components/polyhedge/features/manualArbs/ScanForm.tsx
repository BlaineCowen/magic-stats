"use client";

import { useState } from "react";
import { Input } from "@/components/polyhedge/ui/Input";
import { Button } from "@/components/polyhedge/ui/Button";
import { useManualArbScan } from "./hooks";
import type { ManualArbScanResponse } from "@/lib/polyhedge/types";

interface Props {
  onScanned: (
    urls: { kalshi_url: string; poly_url: string },
    scan: ManualArbScanResponse,
  ) => void;
}

export function ScanForm({ onScanned }: Props) {
  const [kalshiUrl, setKalshiUrl] = useState("");
  const [polyUrl, setPolyUrl] = useState("");
  const scan = useManualArbScan();

  async function handleScan() {
    const k = kalshiUrl.trim();
    const p = polyUrl.trim();
    if (!k || !p) return;
    const r = await scan.mutateAsync({ kalshi_url: k, poly_url: p });
    onScanned({ kalshi_url: k, poly_url: p }, r);
  }

  return (
    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
        }}
      >
        <Input
          placeholder="Kalshi event URL — e.g. https://kalshi.com/markets/.../kxbalancepowercombo-27feb"
          value={kalshiUrl}
          onChange={(e) => setKalshiUrl(e.target.value)}
        />
        <Input
          placeholder="Polymarket event URL — e.g. https://polymarket.com/event/balance-of-power-2026-midterms"
          value={polyUrl}
          onChange={(e) => setPolyUrl(e.target.value)}
        />
        <Button
          onClick={handleScan}
          disabled={scan.isPending || !kalshiUrl.trim() || !polyUrl.trim()}
        >
          {scan.isPending ? "Scanning…" : "Scan"}
        </Button>
      </div>
      {scan.isError && (
        <div className="ph-neg" style={{ fontSize: 11 }}>
          Scan failed: {(scan.error as Error).message}
        </div>
      )}
      {scan.isSuccess && scan.data && (
        <div className="ph-pos" style={{ fontSize: 11 }}>
          Found {scan.data.kalshi_markets.length} Kalshi ·{" "}
          {scan.data.poly_markets.length} Poly markets — click an outcome,
          then YES or NO to pair.
        </div>
      )}
    </div>
  );
}
