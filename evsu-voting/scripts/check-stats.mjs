import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

async function checkRows() {
  try {
    const res = await sql`SELECT relname, n_dead_tup, n_tup_del, n_tup_upd, n_tup_ins FROM pg_stat_user_tables;`;
    console.table(res);
  } catch (error) {
    console.error("Failed:", error);
  }
}

checkRows();
