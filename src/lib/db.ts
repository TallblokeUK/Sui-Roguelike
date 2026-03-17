import { Pool } from "pg";

// Shared pool instance for non-auth queries (leaderboard, etc.)
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || "",
});

export default pool;
