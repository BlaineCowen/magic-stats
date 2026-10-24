import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SqlRejectedError } from "@/lib/sports/db";
import { errorHint } from "@/lib/sports/prompt";
import { logUsage, type KeyEntry } from "./keys";
import * as tools from "./tools";
import { WIDGET_HTML, WIDGET_MIME, WIDGET_URI } from "./widget";

/**
 * The Magic Stats connector for ChatGPT, Claude and other MCP clients. NFL
 * only: nflverse data (CC-BY 4.0) plus the fantasy model. None of the tools
 * call an LLM; the person's own assistant does the asking, so a call costs a
 * DuckDB query. A new server per request (the route is stateless).
 */

const INSTRUCTIONS = `Magic Stats answers NFL stats and fantasy football questions from nflverse play-by-play, box scores, snaps, routes and Next Gen Stats, 1999 to this week.
- For a quick player summary use player; for usage leaders this season use leaderboard; for "make the case for X" or "why is X so good/bad" use make_the_case.
- For anything else, call describe_data once to learn the tables, then run_sql.
- Projections, start/sit and trade checks are Pro tools; if one says it needs Pro, tell the person and link https://projects.blainecowen.com/magic-stats/connector.
- Credit "nflverse" when you show numbers.`;

const POSITION = z.enum(["QB", "RB", "WR", "TE"]);
const card = {
  ui: { resourceUri: WIDGET_URI },
  "ui/resourceUri": WIDGET_URI,
  "openai/outputTemplate": WIDGET_URI,
};
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

type Result = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function buildServer(key: KeyEntry): McpServer {
  const server = new McpServer(
    { name: "magic-stats", title: "Magic Stats", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  /** Run a tool, log it, and turn failures into readable tool errors. */
  const wrap =
    <A>(
      name: string,
      fn: (args: A) => Promise<tools.ToolOut>,
      {
        pro = false,
        hint,
      }: { pro?: boolean; hint?: (e: Error, a: A) => string } = {},
    ) =>
    async (args: A): Promise<Result> => {
      const started = Date.now();
      if (pro && key.tier !== "pro") {
        logUsage({
          key: key.id,
          tool: name,
          args,
          ms: 0,
          ok: false,
          error: "pro",
        });
        return {
          content: [
            {
              type: "text",
              text: `${tools.PRO_NOTE} Details: https://projects.blainecowen.com/magic-stats/connector`,
            },
          ],
          isError: true,
        };
      }
      try {
        const out = await fn(args);
        logUsage({
          key: key.id,
          tool: name,
          args,
          ms: Date.now() - started,
          ok: true,
        });
        return {
          content: [{ type: "text", text: out.text }],
          structuredContent: out.data as Record<string, unknown>,
        };
      } catch (e) {
        const err = e as Error;
        logUsage({
          key: key.id,
          tool: name,
          args,
          ms: Date.now() - started,
          ok: false,
          error: err.message.slice(0, 300),
        });
        return {
          content: [
            { type: "text", text: `${err.message}${hint?.(err, args) ?? ""}` },
          ],
          isError: true,
        };
      }
    };

  server.registerResource(
    "card",
    WIDGET_URI,
    { title: "Magic Stats result card", mimeType: WIDGET_MIME },
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: WIDGET_MIME,
          text: WIDGET_HTML,
          _meta: {
            ui: { prefersBorder: true },
            "openai/widgetDescription":
              "Shows the stats table or findings. Don't repeat every row in your reply; summarize.",
          },
        },
      ],
    }),
  );

  server.registerTool(
    "describe_data",
    {
      title: "Describe the NFL tables",
      description:
        "The tables, columns, rules and example queries for run_sql. Call once before writing SQL.",
      annotations: readOnly,
    },
    wrap("describe_data", () => tools.dataGuide()),
  );

  server.registerTool(
    "run_sql",
    {
      title: "Run a SQL query",
      description:
        "Run one read-only DuckDB SELECT over the NFL tables from describe_data. Returns up to 200 rows.",
      inputSchema: { sql: z.string().min(1).max(8000) },
      annotations: readOnly,
      _meta: card,
    },
    wrap("run_sql", ({ sql }: { sql: string }) => tools.runSql(sql), {
      hint: (e, { sql }) =>
        e instanceof SqlRejectedError
          ? ""
          : `${errorHint("nfl", e.message, sql)}\nCall describe_data if you haven't.`,
    }),
  );

  server.registerTool(
    "player",
    {
      title: "Player summary",
      description:
        "A QB, RB, WR or TE's season: fantasy points and rank at his position, yards and targets per route run, snap share and game log. Pro adds his next-game and rest-of-season projection. Nicknames work (JSN, ARSB, CMC).",
      inputSchema: {
        name: z.string().min(2).max(80),
        season: z.number().int().min(1999).max(2100).optional(),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap("player", ({ name, season }: { name: string; season?: number }) =>
      tools.player(name, key.tier, season),
    ),
  );

  server.registerTool(
    "leaderboard",
    {
      title: "Usage leaderboard",
      description: `This season's leaders among QBs, RBs, WRs and TEs in one usage stat: ${Object.entries(
        tools.LEADER_STATS,
      )
        .map(([k, v]) => `${k} (${v})`)
        .join(", ")}. Use run_sql for past seasons or other stats.`,
      inputSchema: {
        stat: z.enum(
          Object.keys(tools.LEADER_STATS) as [
            tools.LeaderStat,
            ...tools.LeaderStat[],
          ],
        ),
        position: POSITION.optional(),
        min_games: z.number().int().min(1).max(17).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        lowest: z.boolean().optional().describe("Rank from the bottom"),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap("leaderboard", (a: Parameters<typeof tools.leaderboard>[0]) =>
      tools.leaderboard(a),
    ),
  );

  server.registerTool(
    "make_the_case",
    {
      title: "Make the case for a player or team",
      description:
        "Searches hundreds of play-by-play splits for the ones where a player or team ranks near the top (or, with against, near the bottom). Good for arguments and hot takes.",
      inputSchema: {
        subject: z
          .string()
          .min(2)
          .max(80)
          .describe("Player or team, e.g. Puka Nacua or the Lions"),
        season: z.number().int().min(1999).max(2100).optional(),
        against: z
          .boolean()
          .optional()
          .describe("The case against: where they rank worst"),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap("make_the_case", (a: Parameters<typeof tools.makeTheCase>[0]) =>
      tools.makeTheCase(a),
    ),
  );

  server.registerTool(
    "projections",
    {
      title: "Next-game projections (Pro)",
      description:
        "PPR projections for this week's games with floor, ceiling, breakout chance and rest of season. Sort by proj, ceiling, floor, breakout_prob or ros_proj.",
      inputSchema: {
        position: POSITION.optional(),
        sort: z
          .enum(["proj", "ceiling", "floor", "breakout_prob", "ros_proj"])
          .optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap(
      "projections",
      (a: Parameters<typeof tools.projections>[0]) => tools.projections(a),
      { pro: true },
    ),
  );

  server.registerTool(
    "start_sit",
    {
      title: "Start or sit (Pro)",
      description:
        "Compare 2 to 8 players for this week by projection, floor and ceiling, and say who to start.",
      inputSchema: {
        players: z.array(z.string().min(2).max(80)).min(2).max(8),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap(
      "start_sit",
      ({ players }: { players: string[] }) => tools.startSit(players),
      {
        pro: true,
      },
    ),
  );

  server.registerTool(
    "trade_check",
    {
      title: "Trade check (Pro)",
      description:
        "Rest-of-season PPR going out and coming in for a fantasy trade. Points only: it doesn't know the person's roster or scoring.",
      inputSchema: {
        give: z.array(z.string().min(2).max(80)).min(1).max(6),
        get: z.array(z.string().min(2).max(80)).min(1).max(6),
      },
      annotations: readOnly,
      _meta: card,
    },
    wrap(
      "trade_check",
      ({ give, get }: { give: string[]; get: string[] }) =>
        tools.tradeCheck(give, get),
      { pro: true },
    ),
  );

  return server;
}
