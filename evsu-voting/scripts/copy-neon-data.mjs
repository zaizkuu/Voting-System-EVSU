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

const sourceUrl = process.env.NEON_SOURCE_URL;
const targetUrl = process.env.NEON_TARGET_URL;

if (!sourceUrl || !targetUrl) {
  console.error("Missing NEON_SOURCE_URL or NEON_TARGET_URL in the environment.");
  process.exit(1);
}

const sourceSql = neon(sourceUrl);
const targetSql = neon(targetUrl);

// Must be ordered correctly for foreign key constraints during INSERT
const TABLES = [
  'students',
  'users',
  'organizations',
  'student_organizations',
  'elections',
  'positions',
  'candidates',
  'policy_options',
  'votes',
  'password_reset_tokens'
];

async function main() {
  console.log("Starting database migration...");

  // 1. Truncate Target Database
  console.log("Emptying target database...");
  await targetSql(`TRUNCATE TABLE ${TABLES.join(', ')} CASCADE;`);
  console.log("Target database emptied.");

  // 2. Fetch and Insert Data
  for (const table of TABLES) {
    console.log(`Processing table: ${table}...`);
    
    // Fetch data from source
    const rows = await sourceSql(`SELECT * FROM public.${table};`);
    console.log(`Fetched ${rows.length} rows from ${table}`);

    if (rows.length === 0) continue;

    // Get column names from the first row
    const columns = Object.keys(rows[0]);
    
    // Insert in batches of 100 to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const placeholders = [];
      const values = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowPlaceholders = [];
        for (const col of columns) {
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(row[col]);
          paramIndex++;
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const query = `INSERT INTO public.${table} ("${columns.join('", "')}") VALUES ${placeholders.join(', ')}`;
      await targetSql(query, values);
    }
    
    console.log(`Successfully migrated ${rows.length} rows for ${table}`);
  }

  console.log("Migration completed successfully!");
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
