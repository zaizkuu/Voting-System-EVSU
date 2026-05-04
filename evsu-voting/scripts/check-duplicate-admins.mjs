import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1).trim();
    process.env[key] = value;
  });
} catch {}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in the environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function check() {
  const email = process.env.ADMIN_EMAIL || "admin@evsu.edu.ph";
  const rows = await sql`SELECT id, email, role FROM users WHERE email = ${email}`;
  console.log(`Found ${rows.length} users with email ${email}`);
  console.log(rows);
}
check().catch(console.error);
