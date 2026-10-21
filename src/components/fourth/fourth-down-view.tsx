"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NflNav } from "@/components/nfl-nav";
import { parseSituation } from "@/lib/fourth/params";
import type { GameListItem } from "@/lib/fourth/games";
import { cn } from "@/lib/utils";
import { Calculator } from "./calculator";
import { GameStudy } from "./game-study";
import { SuperBowls } from "./super-bowls";
import { Method } from "./method";
import { Coaches } from "./coaches";
import { Live } from "./live";

const TABS = [
  { key: "super-bowls", label: "Shanahan's Super Bowls" },
  { key: "live", label: "Live games" },
  { key: "coaches", label: "Coaches" },
  { key: "calculator", label: "What should they do?" },
  { key: "game", label: "Any game" },
  { key: "method", label: "How it works" },
] as const;

function GamePicker() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [season, setSeason] = useState(Number(params.get("season") ?? 2025));
  const [games, setGames] = useState<GameListItem[]>([]);
  const gameId = params.get("id");

  useEffect(() => {
    fetch(`/api/fourth-down?games=${season}`)
      .then((r) => r.json())
      .then((g: GameListItem[]) => setGames(Array.isArray(g) ? g : []))
      .catch(() => setGames([]));
  }, [season]);

  const pick = (id: string) =>
    router.replace(`${pathname}?tab=game&season=${season}&id=${id}`, {
      scroll: false,
    });
  const sel = games.find((g) => g.gameId === gameId);
  const seasons = Array.from({ length: 2026 - 1999 + 1 }, (_, i) => 2026 - i);
  const selectCls =
    "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          className={selectCls}
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          aria-label="Season"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className={cn(selectCls, "min-w-64")}
          value={gameId ?? ""}
          onChange={(e) => pick(e.target.value)}
          aria-label="Game"
        >
          <option value="" disabled>
            Pick a game…
          </option>
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.week > 18 ? "Playoffs" : `Wk ${g.week}`} · {g.label}
            </option>
          ))}
        </select>
      </div>
      {gameId && (
        <GameStudy
          gameId={gameId}
          focus={params.get("focus") ?? sel?.home ?? gameId.split("_")[3]!}
        />
      )}
    </div>
  );
}

export function FourthDownView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab =
    TABS.find((t) => t.key === params.get("tab"))?.key ?? "super-bowls";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <NflNav />
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">4th down decisions</h1>
        <p className="mt-1 max-w-3xl text-gray-700">
          Should they go for it, kick or punt? Every choice gets a chance to win
          the game, and the best one is the call.
        </p>
      </header>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              router.replace(`${pathname}?tab=${t.key}`, { scroll: false })
            }
            className={cn(
              "-mb-px border-b-2 px-3 pb-2 text-sm font-medium whitespace-nowrap",
              tab === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "calculator" && <Calculator initial={parseSituation(params)} />}
      {tab === "coaches" && <Coaches />}
      {tab === "live" && <Live />}
      {tab === "super-bowls" && <SuperBowls />}
      {tab === "game" && <GamePicker />}
      {tab === "method" && <Method />}
    </main>
  );
}
