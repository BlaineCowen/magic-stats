import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Schema description for the AI
const SCHEMA_DESCRIPTION = `
Available tables and their columns:

Game:
- id: string (unique identifier)
- season: number (year)
- week: number (1-17 for regular season)
- gameType: string (REG, POST, etc.)
- homeTeam: string (team abbreviation)
- awayTeam: string (team abbreviation)
- homeScore: number
- awayScore: number

Play:
- id: string (unique identifier)
- gameId: string (references Game.id)
- quarter: number (1-4, possibly 5 for overtime)
- down: number | null (1-4)
- yardsToGo: number | null
- yardsGained: number | null
- playType: string (pass, run, etc.)
- possessionTeam: string | null (team abbreviation)
- defensiveTeam: string | null (team abbreviation)
- playDescription: string | null
- epa: number | null (Expected Points Added)
- cpoe: number | null (Completion Percentage Over Expected)
- success: boolean

PlayerWeeklyStats:
- id: string
- season: number
- week: number
- seasonType: string
- playerId: string
- playerName: string
- position: string
- team: string
- opponent: string
- fantasyPoints: number
- fantasyPointsPPR: number
- completions: number
- attempts: number
- passingYards: number
- passingTouchdowns: number
- interceptions: number
- carries: number
- rushingYards: number
- rushingTouchdowns: number
- receptions: number
- targets: number
- receivingYards: number
- receivingTouchdowns: number
(and more stats...)

Example questions:
1. "Show me all games where the Cowboys scored more than 40 points in 2023"
2. "What were the top 5 passing plays by EPA in week 1 of 2023?"
3. "How many rushing touchdowns did Christian McCaffrey have in 2023?"
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

async function generateSQLQuery(question: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const prompt = `You are a SQL expert. Given a database schema and a natural language question, generate a PostgreSQL query that answers the question. Only return the SQL query, nothing else. The table and column names are case-sensitive, so use proper quotes.

${SCHEMA_DESCRIPTION}

Question: ${question}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Clean up the response to ensure it's just the SQL query
  return text.replace(/```sql|```/g, "").trim();
}

async function executeQuery(query: string) {
  try {
    // Use Prisma.sql to properly escape the raw query
    const result = await prisma.$queryRaw(Prisma.sql([query]));
    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error executing query:", error.message);
      throw error;
    }
    throw new Error("An unknown error occurred");
  }
}

async function main() {
  try {
    // Get the question from command line arguments
    const question = process.argv[2];
    if (!question) {
      console.error("Please provide a question as a command line argument");
      process.exit(1);
    }

    console.log("Question:", question);
    console.log("\nGenerating SQL query...");

    const sqlQuery = await generateSQLQuery(question);
    console.log("\nGenerated SQL Query:");
    console.log(sqlQuery);

    console.log("\nExecuting query...");
    const result = await executeQuery(sqlQuery);

    console.log("\nResults:");
    console.table(result);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
