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

async function check() {
  const s = await sql`SELECT count(*) FROM students`;
  const u = await sql`SELECT count(*) FROM users`;
  const e = await sql`SELECT count(*) FROM elections`;
  const c = await sql`SELECT count(*) FROM candidates`;
  const v = await sql`SELECT count(*) FROM votes`;
  console.log('Students:', s[0].count, 'Users:', u[0].count, 'Elections:', e[0].count, 'Candidates:', c[0].count, 'Votes:', v[0].count);
}

check();
