import axios from "axios";
import { parse } from "csv-parse";
import { Readable } from "stream";
import * as fs from "fs";

interface NFLPlay {
  play_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  season: string;
  week: string;
  quarter: string;
  down: string;
  yards_gained: string;
  play_type: string;
  desc: string;
  epa: string;
  success: string;
  [key: string]: string | undefined;
}

async function downloadPlayByPlayData(year: number): Promise<string> {
  console.log(`Downloading play-by-play data for ${year}...`);
  const url = `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${year}.csv`;
  const response = await axios.get<string>(url, {
    responseType: "text",
    timeout: 30000,
  });
  return response.data;
}

async function parseCSV(data: string): Promise<NFLPlay[]> {
  return new Promise((resolve, reject) => {
    const records: NFLPlay[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    const stream = Readable.from(data);
    stream
      .pipe(parser)
      .on("data", (record: NFLPlay) => records.push(record))
      .on("end", () => resolve(records))
      .on("error", (error) => reject(error));
  });
}

async function main(): Promise<void> {
  try {
    // Get 2023 data as it's most recent and complete
    const data = await downloadPlayByPlayData(2023);
    const plays = await parseCSV(data);

    // Get the first 5 plays
    const samplePlays = plays.slice(0, 5);

    // Create a readable sample with just the most important columns
    const importantColumns = [
      "play_id",
      "game_id",
      "home_team",
      "away_team",
      "season",
      "week",
      "quarter",
      "down",
      "yards_gained",
      "play_type",
      "desc",
      "epa",
      "success",
    ] as const;

    // Create the CSV content
    let csvContent = importantColumns.join(",") + "\n";

    // Add each play's data
    for (const play of samplePlays) {
      csvContent +=
        importantColumns.map((col) => play[col] ?? "").join(",") + "\n";
    }

    // Write to sample file
    fs.writeFileSync("samples/pbp_sample.csv", csvContent);

    console.log("Sample data saved to samples/pbp_sample.csv");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Failed to get sample data:", error.message);
    } else {
      console.error("Failed to get sample data:", String(error));
    }
    process.exit(1);
  }
}

void main();
