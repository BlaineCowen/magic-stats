import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to clean SQL query from markdown
function cleanSqlQuery(query: string): string {
  // Remove markdown code blocks and sql tag
  return query
    .replace(/```sql\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

// Function to read the actual Prisma schema
function getActualSchema(): string {
  try {
    const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
    const schemaContent = readFileSync(schemaPath, "utf-8");
    return schemaContent;
  } catch (error) {
    console.error("Error reading schema file:", error);
    return "Error reading schema file";
  }
}

type QueryRequest = {
  query: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QueryRequest;
    const query = body.query;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Get the SQL query from Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const actualSchema = getActualSchema();

    const prompt = `Given this actual Prisma database schema:
${actualSchema}

IMPORTANT RULES: 
1. Always use team abbreviations (DAL, SF, PHI, etc.) in the SQL query, not full team names
2. Table AND column names are case-sensitive and use camelCase. They must be quoted: "Game", "Play", "gameId", "homeTeam", etc.
3. For player queries, ALWAYS start by looking up the player in the "Player" table to get their "gsisId", then use that to match "playerId" in other tables
4. When returning player stats, include ALL relevant stats for their position (passing, rushing, receiving, fantasy points as appropriate)
5. For aggregations that might return large numbers, cast them to FLOAT to avoid BigInt issues: CAST(SUM(...) AS FLOAT)
6. Use proper table relationships and joins - the "Player" table is the master lookup table
7. IMPORTANT: For weekly stats queries, use "recentTeam" from "PlayerWeeklyStats" table (not "latestTeam" from "Player" table) since "recentTeam" shows the team for that specific week/season
8. ALWAYS add "LIMIT 20" to queries asking for "leaders", "top players", "best", "most", "highest", or similar ranking requests unless a specific number is mentioned
9. For filtering regular season or playoff games in the Play table, use the "seasonType" column: 'REG' for regular season, 'POST' for playoffs. NEVER use "gameType" in Play queries.

CRITICAL AGGREGATION RULES:
- When asked for "leaders", "top players", "best", or cumulative stats across multiple years/seasons, ALWAYS use GROUP BY and aggregation functions
- Use SUM() for cumulative totals (yards, touchdowns, receptions, etc.)
- Use AVG() for averages (completion percentage, yards per carry, etc.)
- Use COUNT() for counting (games played, etc.)
- Always GROUP BY player ID and name to get one row per player
- For "past X years", use WHERE season >= (current_year - X)
- For single year queries, still use GROUP BY to get season totals per player
- Only return individual weekly stats when specifically asked for weekly breakdowns
- ORDER BY the relevant stat in DESC order for leader queries

Convert this question to a SQL query that will answer it:
${query}

Return your response in this exact format:
SQL: [your SQL query here]
Interpretation: [simple, user-friendly explanation of what this query is looking for - keep it brief and easy to understand]

Make sure to use proper table relationships and joins.`;

    const result = (await model.generateContent(prompt)) as any;
    if (!result?.response) {
      throw new Error("No response from Gemini");
    }
    const rawResponse = result.response.text() as string;

    if (!rawResponse) {
      return NextResponse.json(
        { error: "Failed to generate SQL query" },
        { status: 500 },
      );
    }

    // Parse the response to extract SQL and interpretation
    const sqlMatch = rawResponse.match(
      /SQL:\s*([\s\S]*?)(?=\nInterpretation:|$)/,
    );
    const interpretationMatch = rawResponse.match(
      /Interpretation:\s*([\s\S]*?)(?=\n|$)/,
    );

    if (!sqlMatch || !sqlMatch[1]) {
      return NextResponse.json(
        { error: "Failed to parse SQL query from response" },
        { status: 500 },
      );
    }

    const sqlQuery = cleanSqlQuery(sqlMatch[1].trim());
    const interpretation =
      interpretationMatch && interpretationMatch[1]
        ? interpretationMatch[1].trim()
        : "Query interpretation not available";

    console.log("Generated SQL:", sqlQuery);
    console.log("Interpretation:", interpretation);

    // Execute the query
    const queryResult = await prisma.$queryRawUnsafe(sqlQuery);

    // Convert BigInt to Number in the results
    const processResults = (data: unknown): unknown => {
      if (Array.isArray(data)) {
        return data.map((item) => processResults(item));
      }
      if (data && typeof data === "object") {
        const processed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          processed[key] =
            typeof value === "bigint" ? Number(value) : processResults(value);
        }
        return processed;
      }
      return data;
    };

    return NextResponse.json({
      results: processResults(queryResult),
      interpretation: interpretation,
    });
  } catch (error) {
    console.error("Query error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process query";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
