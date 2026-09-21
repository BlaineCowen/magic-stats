import { cn } from "@/components/polyhedge/cn";
import type { ArbFlag } from "@/lib/polyhedge/types";

function FlagItem({ f }: { f: ArbFlag }) {
  return (
    <div
      className={cn(
        "ph-flag",
        f.severity === "BLOCK" && "ph-flag-block",
        f.severity === "WARN" && "ph-flag-warn",
        f.severity === "INFO" && "ph-flag-info",
      )}
    >
      <strong>{f.code}</strong> — {f.message}
      {(f.kalshi_excerpt ?? f.poly_excerpt) && (
        <div className="ph-flag-excerpt">
          {f.kalshi_excerpt && <div>Kalshi: “{f.kalshi_excerpt}”</div>}
          {f.poly_excerpt && <div>Polymarket: “{f.poly_excerpt}”</div>}
        </div>
      )}
    </div>
  );
}

/** Blocks stop approval. Differences are for a glance — nothing to tick. */
export function FlagList({ flags }: { flags: ArbFlag[] }) {
  const blocks = flags.filter((f) => f.severity === "BLOCK");
  const warns = flags.filter((f) => f.severity === "WARN");
  const infos = flags.filter((f) => f.severity === "INFO");
  return (
    <div>
      {blocks.length > 0 && (
        <div>
          <h4 className="ph-neg">Blocked — can’t be approved ({blocks.length})</h4>
          {blocks.map((f) => (
            <FlagItem key={f.id} f={f} />
          ))}
        </div>
      )}
      {warns.length > 0 && (
        <div>
          <h4 className="ph-warn">Differences to glance at ({warns.length})</h4>
          {warns.map((f) => (
            <FlagItem key={f.id} f={f} />
          ))}
        </div>
      )}
      {infos.length > 0 && (
        <details>
          <summary className="ph-muted-2">More detail ({infos.length})</summary>
          {infos.map((f) => (
            <FlagItem key={f.id} f={f} />
          ))}
        </details>
      )}
      {flags.length === 0 && <p className="ph-muted-2">No flags.</p>}
    </div>
  );
}
