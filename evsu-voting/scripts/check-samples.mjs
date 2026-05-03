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
  const s = await sql`SELECT id, student_id, full_name FROM students LIMIT 5`;
  console.log('Sample students:', s);
  const u = await sql`SELECT id, email, role FROM users LIMIT 5`;
  console.log('Sample users:', u);
}

check();
