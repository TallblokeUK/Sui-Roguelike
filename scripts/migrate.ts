/**
 * Database migration script.
 * Run: npx tsx scripts/migrate.ts
 *
 * Creates/updates the `runs` table for leaderboard data.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
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
      player_name TEXT NOT NULL DEFAULT 'Adventurer',
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

  // Add player_name column if it doesn't exist (for existing tables)
  await pool.query(`
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT 'Adventurer';
  `);

  // Saves table for run persistence
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saves (
      sub TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Account progression (meta-progression / Dark Forge)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_progression (
      sub TEXT PRIMARY KEY,
      soul_embers INTEGER NOT NULL DEFAULT 0,
      total_embers_earned INTEGER NOT NULL DEFAULT 0,
      upgrades JSONB NOT NULL DEFAULT '{}',
      achievements JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Add achievements column if it doesn't exist (for existing tables)
  await pool.query(`
    ALTER TABLE account_progression ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '[]';
  `);

  // Add hero_class column to runs if it doesn't exist
  await pool.query(`
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS hero_class TEXT NOT NULL DEFAULT 'warden';
  `);

  // Add player_address and player_name to account_progression for trading lookup
  await pool.query(`
    ALTER TABLE account_progression ADD COLUMN IF NOT EXISTS player_address TEXT;
    ALTER TABLE account_progression ADD COLUMN IF NOT EXISTS player_name TEXT;
  `);

  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
