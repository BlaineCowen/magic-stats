import { PrismaClient, type Prisma } from "@prisma/client";
import axios from "axios";
import { parse } from "csv-parse";
import { Readable } from "stream";

const prisma = new PrismaClient({
  log: ["error"],
});

interface NFLPlayer {
  first_name: string;
  last_name: string;
  position: string | null;
  esb_id: string | null;
  gsis_id: string;
  display_name: string | null;
  rookie_year: string | null;
  college_conference: string | null;
  current_team_id: string | null;
  draft_club: string | null;
  draft_number: string | null;
  draft_round: string | null;
  entry_year: string | null;
  football_name: string | null;
  gsis_it_id: string | null;
  headshot: string | null;
  jersey_number: string | null;
  position_group: string | null;
  short_name: string | null;
  smart_id: string | null;
  status: string | null;
  status_description_abbr: string | null;
  status_short_description: string | null;
  team_abbr: string | null;
  uniform_number: string | null;
  height: string | null;
  weight: string | null;
  college_name: string | null;
  years_of_experience: string | null;
  birth_date: string | null;
  team_seq: string | null;
  suffix: string | null;
}

interface CSVRecord {
  first_name: string;
  last_name: string;
  position: string;
  esb_id: string;
  gsis_id: string;
  display_name: string;
  rookie_year: string;
  college_conference: string;
  current_team_id: string;
  draft_club: string;
  draft_number: string;
  draft_round: string;
  entry_year: string;
  football_name: string;
  gsis_it_id: string;
  headshot: string;
  jersey_number: string;
  position_group: string;
  short_name: string;
  smart_id: string;
  status: string;
  status_description_abbr: string;
  status_short_description: string;
  team_abbr: string;
  uniform_number: string;
  height: string;
  weight: string;
  college_name: string;
  years_of_experience: string;
  birth_date: string;
  team_seq: string;
  suffix: string;
}

async function downloadPlayerData(): Promise<string> {
  try {
    console.log("Downloading player data...");
    const url =
      "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";
    const response = await axios.get<string>(url, { responseType: "text" });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download player data: ${error.message}`);
    }
    throw new Error("Failed to download player data: Unknown error occurred");
  }
}

async function parseCSV(data: string): Promise<NFLPlayer[]> {
  return new Promise((resolve, reject) => {
    const records: NFLPlayer[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    const stream = Readable.from(data);
    stream
      .pipe(parser)
      .on("data", (record: CSVRecord) => {
        // Convert all fields to strings or null
        const player: NFLPlayer = {
          first_name: String(record.first_name),
          last_name: String(record.last_name),
          position: record.position ? String(record.position) : null,
          esb_id: record.esb_id ? String(record.esb_id) : null,
          gsis_id: String(record.gsis_id),
          display_name: record.display_name
            ? String(record.display_name)
            : null,
          rookie_year: record.rookie_year ? String(record.rookie_year) : null,
          college_conference: record.college_conference
            ? String(record.college_conference)
            : null,
          current_team_id: record.current_team_id
            ? String(record.current_team_id)
            : null,
          draft_club: record.draft_club ? String(record.draft_club) : null,
          draft_number: record.draft_number
            ? String(record.draft_number)
            : null,
          draft_round: record.draft_round ? String(record.draft_round) : null,
          entry_year: record.entry_year ? String(record.entry_year) : null,
          football_name: record.football_name
            ? String(record.football_name)
            : null,
          gsis_it_id: record.gsis_it_id ? String(record.gsis_it_id) : null,
          headshot: record.headshot ? String(record.headshot) : null,
          jersey_number: record.jersey_number
            ? String(record.jersey_number)
            : null,
          position_group: record.position_group
            ? String(record.position_group)
            : null,
          short_name: record.short_name ? String(record.short_name) : null,
          smart_id: record.smart_id ? String(record.smart_id) : null,
          status: record.status ? String(record.status) : null,
          status_description_abbr: record.status_description_abbr
            ? String(record.status_description_abbr)
            : null,
          status_short_description: record.status_short_description
            ? String(record.status_short_description)
            : null,
          team_abbr: record.team_abbr ? String(record.team_abbr) : null,
          uniform_number: record.uniform_number
            ? String(record.uniform_number)
            : null,
          height: record.height ? String(record.height) : null,
          weight: record.weight ? String(record.weight) : null,
          college_name: record.college_name
            ? String(record.college_name)
            : null,
          years_of_experience: record.years_of_experience
            ? String(record.years_of_experience)
            : null,
          birth_date: record.birth_date ? String(record.birth_date) : null,
          team_seq: record.team_seq ? String(record.team_seq) : null,
          suffix: record.suffix ? String(record.suffix) : null,
        };
        records.push(player);
      })
      .on("end", () => resolve(records))
      .on("error", (error) => reject(error));
  });
}

async function importPlayers() {
  try {
    const data = await downloadPlayerData();
    const players = await parseCSV(data);

    console.log(`Processing ${players.length} players...`);
    let playersCreated = 0;

    // Process in chunks of 100
    for (let i = 0; i < players.length; i += 100) {
      const playerChunk = players.slice(i, i + 100);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const player of playerChunk) {
          try {
            const existingPlayer = await tx.player.findUnique({
              where: { gsis_id: player.gsis_id },
            });

            if (!existingPlayer) {
              await tx.player.create({
                data: {
                  first_name: player.first_name,
                  last_name: player.last_name,
                  position: player.position,
                  esb_id: player.esb_id,
                  gsis_id: player.gsis_id,
                  display_name: player.display_name,
                  rookie_year: player.rookie_year
                    ? parseInt(player.rookie_year)
                    : null,
                  college_conference: player.college_conference,
                  current_team_id: player.current_team_id,
                  draft_club: player.draft_club,
                  draft_number: player.draft_number
                    ? parseInt(player.draft_number)
                    : null,
                  draft_round: player.draft_round
                    ? parseInt(player.draft_round)
                    : null,
                  entry_year: player.entry_year
                    ? parseInt(player.entry_year)
                    : null,
                  football_name: player.football_name,
                  gsis_it_id: player.gsis_it_id,
                  headshot: player.headshot,
                  jersey_number: player.jersey_number,
                  position_group: player.position_group,
                  short_name: player.short_name,
                  smart_id: player.smart_id,
                  status: player.status,
                  status_description_abbr: player.status_description_abbr,
                  status_short_description: player.status_short_description,
                  team_abbr: player.team_abbr,
                  uniform_number: player.uniform_number,
                  height: player.height,
                  weight: player.weight ? parseInt(player.weight) : null,
                  college_name: player.college_name,
                  years_of_experience: player.years_of_experience
                    ? parseInt(player.years_of_experience)
                    : null,
                  birth_date: player.birth_date
                    ? new Date(player.birth_date)
                    : null,
                  team_seq: player.team_seq ? parseInt(player.team_seq) : null,
                  suffix: player.suffix,
                },
              });
              playersCreated++;
            }
          } catch (error) {
            console.error(`Error processing player ${player.gsis_id}:`, error);
            continue;
          }
        }
      });

      if (playersCreated % 100 === 0) {
        console.log(`Created ${playersCreated} players...`);
      }
    }

    console.log(
      `Completed importing players. Created ${playersCreated} players.`,
    );
  } catch (error) {
    console.error("Failed to import player data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    console.log("Starting player data import...");
    await importPlayers();
    console.log("Player data import completed");
  } catch (error) {
    console.error("Failed to import player data:", error);
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
