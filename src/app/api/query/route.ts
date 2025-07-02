import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/prefer-regexp-exec */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

const API_BASE_URL = process.env.R_API_URL ?? "http://localhost:8000";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type QueryRequest = {
  query: string;
};

// Initialize Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Function to load AI prompt from external file
function loadAIPrompt(): string {
  try {
    // Read the AI script from the markdown file
    const scriptPath = join(process.cwd(), "src", "ai_script.md");
    console.log("Loading AI prompt from:", scriptPath);
    const scriptContent = readFileSync(scriptPath, "utf-8");
    console.log("Script content length:", scriptContent.length);

    // Read the data dictionaries
    const dictPath = join(process.cwd(), "src", "nflReadRDicts.md");
    console.log("Loading data dictionaries from:", dictPath);
    const dictContent = readFileSync(dictPath, "utf-8");
    console.log("Dictionary content length:", dictContent.length);

    // Combine the AI script with the data dictionaries
    const combinedPrompt = `${scriptContent.trim()}\n\n## DATA DICTIONARIES:\n\n${dictContent.trim()}`;
    console.log("Combined prompt length:", combinedPrompt.length);

    return combinedPrompt;
  } catch (error) {
    console.error("Error loading AI prompt:", error);
    // Fallback to a minimal prompt if file can't be read
    return `You are an expert at converting natural language queries about NFL statistics into R code using the nflreadr package.

IMPORTANT: Return ONLY the R code, no markdown formatting, no backticks, no explanations.

CRITICAL MEMORY LIMITS: 
- For play-by-play queries, NEVER load more than 2 seasons (use 2023:2024, not 1999:2024)
- For "all time" play-by-play queries, use recent years only (2023:2024)
- ALWAYS use select() to choose only needed columns for play-by-play queries
- Always limit results with head() to prevent memory issues

Return ONLY the R code, no markdown formatting, no backticks, no explanations.`;
  }
}

// Load AI prompt from external file (will be called fresh each time)
console.log("AI_PROMPT will be loaded fresh for each request");

// Generate a simple, natural interpretation of the query
function generateSimpleInterpretation(query: string, rCode: string): string {
  // Extract key information from the R code to create a natural description
  const lowerQuery = query.toLowerCase();

  // Common patterns for different types of queries
  if (rCode.includes("load_player_stats") && rCode.includes("arrange(desc(")) {
    if (lowerQuery.includes("top") || lowerQuery.includes("leader")) {
      const match = /head\((\d+)\)/.exec(rCode);
      const limit = match ? match[1] : "10";

      if (rCode.includes("passing_yards")) {
        return `Top ${limit} quarterbacks in passing yards`;
      } else if (rCode.includes("rushing_yards")) {
        return `Top ${limit} running backs in rushing yards`;
      } else if (rCode.includes("receiving_yards")) {
        return `Top ${limit} receivers in receiving yards`;
      } else if (rCode.includes("fantasy_points")) {
        return `Top ${limit} players in fantasy points`;
      } else if (rCode.includes("touchdown")) {
        return `Top ${limit} players in touchdowns`;
      } else if (rCode.includes("sacks")) {
        return `Top ${limit} players in sacks`;
      }
    }
  }

  if (rCode.includes("summarise") && rCode.includes("sum(")) {
    if (lowerQuery.includes("how many") || lowerQuery.includes("total")) {
      if (rCode.includes("touchdown")) {
        return `Total touchdowns`;
      } else if (rCode.includes("yards")) {
        return `Total yards`;
      } else if (rCode.includes("sacks")) {
        return `Total sacks`;
      }
    }
  }

  if (rCode.includes("load_schedules")) {
    return `Game results and schedules`;
  }

  if (rCode.includes("load_rosters")) {
    return `Player roster information`;
  }

  if (rCode.includes("load_pbp")) {
    return `Play-by-play data`;
  }

  // Default fallback - clean up the original query
  return query.replace(/[?]/g, "").trim();
}

// Helper function to call R API with custom code
async function executeRCode(rCode: string) {
  const response = await fetch(`${API_BASE_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: rCode }),
  });

  if (!response.ok) {
    throw new Error(`R API error: ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

// Convert natural language to R code using AI
async function convertToRCode(
  query: string,
  errorContext?: { rCode: string; error: string },
): Promise<{ rCode: string; usageMetadata?: any }> {
  if (!GEMINI_API_KEY || !genAI) {
    throw new Error("Gemini API key not configured");
  }

  // Load AI prompt fresh each time
  const aiPrompt = loadAIPrompt();
  console.log("AI_PROMPT loaded fresh, length:", aiPrompt.length);
  console.log(
    "DEFAULT: Regular season only':",
    aiPrompt.includes("DEFAULT: Regular season only"),
  );

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

  let prompt: string;
  if (errorContext) {
    // Error correction mode
    prompt = `${aiPrompt}\n\nYou just attempted to fill a user's request with ${errorContext.rCode} based on their query "${query}". The server returned this error: ${errorContext.error}. Based on your knowledge of nflReadR, please correct the mistake with the R code only.`;
  } else {
    // Normal mode
    prompt = `${aiPrompt}\n\nUser query: ${query}`;
  }

  const result = await model.generateContent(prompt);
  const response = result.response;
  let rCode = response.text().trim();

  // Clean up any markdown formatting and language prefixes
  rCode = rCode
    .replace(/```r?\n?/g, "")
    .replace(/```\n?/g, "")
    .replace(/^R\s*\n?/i, "") // Remove "R" prefix
    .trim();

  console.log("Generated R code:", rCode);
  console.log("Usage metadata:", result.response.usageMetadata);

  return {
    rCode,
    usageMetadata: result.response.usageMetadata,
  };
}

export async function POST(request: Request) {
  try {
    console.log("API_BASE_URL:", API_BASE_URL);

    const body = (await request.json()) as QueryRequest & {
      useAIScript?: boolean;
    };
    const query = body.query;
    const useAIScript = body.useAIScript !== false; // default true

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // If useAIScript is false, skip AI and return canned response
    if (!useAIScript) {
      const dummyRCode = `# AI script disabled for testing\n# Query: ${query}\nhead(data.frame(test_col = c('testing mode'), query = c('${query}')))`;
      return NextResponse.json({
        results: [{ test_col: "testing mode", query }],
        r_code: dummyRCode,
        note: "AI script was disabled for this request.",
      });
    }

    console.log("Processing query:", query);

    // Convert natural language to R code using AI
    let aiResult = await convertToRCode(query);
    let rCode = aiResult.rCode;
    let retryCount = 0;
    const maxRetries = 1; // Only retry once to avoid infinite loops
    let vpsResponse: unknown = null;
    let vpsData: { success?: boolean[]; error?: string[]; result?: unknown } =
      {};

    while (retryCount <= maxRetries) {
      // Execute the R code on the VPS
      console.log(`Executing R code on VPS (attempt ${retryCount + 1})...`);
      console.log("R code to execute:", rCode);

      vpsResponse = await executeRCode(rCode);
      console.log("VPS response:", JSON.stringify(vpsResponse, null, 2));

      // Check if the VPS response indicates an error
      vpsData = vpsResponse as {
        success?: boolean[];
        error?: string[];
        result?: unknown;
      };

      // Check for various error conditions
      if (vpsData.success?.[0] === false) {
        const errorMessage = vpsData.error?.[0] ?? "R code execution failed";

        // If we haven't retried yet, try to correct the error
        if (retryCount < maxRetries) {
          console.log("R code failed, attempting error correction...");
          aiResult = await convertToRCode(query, {
            rCode,
            error: errorMessage,
          });
          rCode = aiResult.rCode;
          retryCount++;
          continue;
        } else {
          // Final attempt failed, return error
          return NextResponse.json(
            {
              error: errorMessage,
              r_code: rCode,
              usage_metadata: aiResult.usageMetadata,
            },
            { status: 400 },
          );
        }
      }

      // If we get here, the code executed successfully
      break;
    }

    // Check if result is null or empty
    const rawResult = vpsData.result ?? vpsResponse;
    if (
      rawResult === null ||
      rawResult === undefined ||
      (Array.isArray(rawResult) && rawResult.length === 0) ||
      (typeof rawResult === "object" && Object.keys(rawResult).length === 0)
    ) {
      return NextResponse.json(
        {
          error: "No results found for this query",
          r_code: rCode,
          usage_metadata: aiResult.usageMetadata,
        },
        { status: 400 },
      );
    }

    // Transform the result to match frontend expectations
    // If it's an object with arrays, convert to array of objects
    let results;
    if (
      rawResult &&
      typeof rawResult === "object" &&
      !Array.isArray(rawResult)
    ) {
      // Check if values are arrays (like {"total_tds": [15]})
      const firstValue = Object.values(rawResult)[0];
      if (Array.isArray(firstValue)) {
        // Convert {"total_tds": [15]} to [{"total_tds": 15}]
        const keys = Object.keys(rawResult);
        const length = firstValue.length;
        results = Array.from({ length }, (_, i) => {
          const obj: Record<string, any> = {};
          keys.forEach((key) => {
            const value = (rawResult as Record<string, unknown>)[key];
            obj[key] = Array.isArray(value) ? (value as unknown[])[i] : value;
          });
          return obj;
        });
      } else {
        // Convert {"total_tds": 15} to [{"total_tds": 15}]
        results = [rawResult];
      }
    } else {
      results = rawResult;
    }

    // Generate a simple, natural interpretation
    const interpretation = generateSimpleInterpretation(query, rCode);

    // Check if play-by-play data was used and add a note
    const usesPlayByPlay = rCode.includes("load_pbp");
    const note = usesPlayByPlay
      ? "Note: Play-by-play queries are limited to 2 seasons at a time for optimal performance."
      : null;

    return NextResponse.json({
      results: results,
      interpretation: interpretation,
      query_type: "ai_generated",
      r_code: rCode,
      note: note,
      usage_metadata: aiResult.usageMetadata,
    });
  } catch (error) {
    console.error("Query error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process query";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
