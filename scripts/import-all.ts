import { spawn } from "child_process";

async function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running ${scriptPath}...`);
    const process = spawn("npx", ["tsx", scriptPath], {
      stdio: "inherit",
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log(`${scriptPath} completed successfully`);
        resolve();
      } else {
        reject(new Error(`${scriptPath} failed with code ${code}`));
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log("Starting data import process...");

    // Import players first since they're referenced by other data
    await runScript("./scripts/import-players.ts");

    // Import NFL play-by-play data
    await runScript("./scripts/import-nfl-data.ts");

    // Import player weekly stats
    await runScript("./scripts/import-player-stats.ts");

    console.log("All imports completed successfully!");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
}

void main();
