/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Native DuckDB bindings must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default config;
