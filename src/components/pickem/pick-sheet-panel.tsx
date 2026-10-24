"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { Entry } from "@/lib/pickem/optimizer";
import type { PickemGame } from "@/lib/pickem/scoreboard";
import { cn } from "@/lib/utils";
import { drawPickSheet, sheetBlob } from "./pick-sheet";

const NAME_KEY = "nfl-pickem:sheet-name";
const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

/** Export the week's picks as a pick sheet picture to send to the pool. */
export function PickSheetPanel({ season, week, games, entry, rankOneHighest }: {
  season: number;
  week: number;
  games: PickemGame[];
  entry: Entry;
  /** The pool calls its most confident pick 1 instead of the number of games. */
  rankOneHighest: boolean;
}) {
  const n = games.length;
  const top = rankOneHighest ? 1 : n;
  const [name, setName] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* private mode */ }
  }, []);

  const numbers = useMemo(
    () => Object.fromEntries(Object.entries(entry.points).map(([id, pts]) => [id, rankOneHighest ? n + 1 - pts : pts])),
    [entry.points, rankOneHighest, n],
  );
  const missing = games.filter((g) => !entry.picks[g.id]).length;

  useEffect(() => {
    if (!games.length) return;
    const canvas = drawPickSheet({ season, week, name: name.trim(), games, picks: entry.picks, shown: numbers, top });
    let live = true;
    sheetBlob(canvas).then((blob) => {
      if (!live) return;
      const file = new File([blob], "pick-sheet.png", { type: "image/png" });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    });
    return () => { live = false; };
  }, [season, week, name, games, entry.picks, numbers, top]);

  const fileName = `week-${week}-picks${name.trim() ? `-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.png`;

  async function share() {
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: `Week ${week} picks` });
    } catch { /* cancelled */ }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block font-medium text-slate-700">Name on the sheet</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              try { localStorage.setItem(NAME_KEY, e.target.value); } catch { /* ignore */ }
            }}
            placeholder="Your name"
            className={cn("w-56 rounded-md border border-slate-300 px-3 py-2 text-base", focusCls)}
          />
        </label>
        {canShare && (
          <button type="button" onClick={share} disabled={!url}
            className={cn("bg-turf-800 hover:bg-turf-900 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50", focusCls)}>
            <Share2 className="size-4" aria-hidden /> Share
          </button>
        )}
        <a
          href={url ?? undefined}
          download={fileName}
          aria-disabled={!url}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50", focusCls)}
        >
          <Download className="size-4" aria-hidden /> Save image
        </a>
      </div>
      {missing > 0 && (
        <p className="mt-2 text-amber-800">
          {missing} game{missing > 1 ? "s have" : " has"} no pick yet, so {missing > 1 ? "they're" : "it's"} left blank on the sheet.
        </p>
      )}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Week ${week} pick sheet`} className="mt-3 w-full max-w-xl rounded border border-slate-200" />
      )}
    </div>
  );
}
