import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    process.env[key] = value;
  });
} catch {}

const sql = neon(process.env.DATABASE_URL);

async function checkLogs() {
  try {
    // Check pg_stat_activity for recent activity
    console.log("--- Recent Database Activity ---");
    const activity = await sql`
      SELECT pid, state, query_start, query 
      FROM pg_stat_activity 
      WHERE state != 'idle' 
      ORDER BY query_start DESC 
      LIMIT 10
    `;
    console.log(activity);

    // Try to check pg_stat_statements if extension is enabled
    try {
      console.log("\n--- Top Executed Queries ---");
      const statements = await sql`
        SELECT query, calls, total_exec_time, rows 
        FROM pg_stat_statements 
        ORDER BY last_exec_time DESC 
        LIMIT 5
      `;
      console.log(statements);
    } catch (e) {
      console.log("(pg_stat_statements not accessible or not enabled)");
    }
  } catch (error) {
    console.error("Failed to query logs:", error);
  }
}

checkLogs();
