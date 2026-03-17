/**
 * Database migration script.
 * Run: npx tsx scripts/migrate.ts
 *
 * Creates the `runs` table for leaderboard data.
 * Better Auth tables are created automatically by `npx auth migrate`.
 */

import "dotenv/config";
import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });

  console.log("Running migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      hero_name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      floor INTEGER NOT NULL DEFAULT 1,
      kills INTEGER NOT NULL DEFAULT 0,
      turns INTEGER NOT NULL DEFAULT 0,
      cause_of_death TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_runs_floor_level ON runs (floor DESC, level DESC, kills DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs (user_id);
  `);

  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
