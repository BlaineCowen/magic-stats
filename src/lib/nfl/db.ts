import * as sports from "@/lib/sports/db";
import type { TeamColors } from "./chart-spec";

/**
 * The NFL slice of the sports DuckDB layer (src/lib/sports/db.ts), for the
 * NFL-only features: charts, 4th down, and the eval script.
 */

export {
  cleanSql,
  SqlRejectedError,
  type DataInfo,
  type Row,
} from "@/lib/sports/db";

export const NFL_DATA_DIR = sports.dataDir("nfl");

export const dataVersion = () => sports.dataVersion("nfl");

export const runSafeSelect = (sql: string) => sports.runSafeSelect("nfl", sql);

export const describeView = (view: string) => sports.describeView("nfl", view);

export const getDataInfo = () => sports.getDataInfo("nfl");

export const getTeamColors = (): Promise<TeamColors> =>
  sports.getTeamColors("nfl");
