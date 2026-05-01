/**
 * Push schema to Neon database.
 * Run:  node scripts/push-schema.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

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
} catch {
  console.log("No .env.local file found.");
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

/**
 * Smart SQL splitter that respects $$ dollar-quoted blocks.
 * PL/pgSQL function bodies use $$ ... $$ and contain semicolons.
 */
function splitSqlStatements(rawSql) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;

  const lines = rawSql.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith("--") && !inDollarQuote) {
      continue;
    }

    // Toggle dollar-quoting
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    current += line + "\n";

    // If we're NOT inside a $$ block and the line ends with ;
    if (!inDollarQuote && trimmed.endsWith(";")) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = "";
    }
  }

  // Catch any trailing statement without ;
  const remaining = current.trim();
  if (remaining.length > 0) {
    statements.push(remaining);
  }

  return statements;
}

async function pushSchema() {
  console.log("🔧 Pushing schema to Neon database...\n");

  const schemaPath = resolve(process.cwd(), "neon-schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");
  const statements = splitSqlStatements(schemaSql);

  console.log(`   Found ${statements.length} SQL statements to execute.\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.replace(/\s+/g, " ").slice(0, 80);

    try {
      await sql(statement);
      console.log(`   ✅ [${i + 1}/${statements.length}] ${preview}...`);
      succeeded++;
    } catch (err) {
      if (err.message?.includes("already exists")) {
        console.log(`   ⏭️  [${i + 1}/${statements.length}] Skipped (already exists)`);
        succeeded++;
      } else {
        console.error(`   ❌ [${i + 1}/${statements.length}] FAILED: ${err.message}`);
        console.error(`      Statement: ${preview}`);
        failed++;
      }
    }
  }

  console.log(`\n✅ Schema push complete. ${succeeded} succeeded, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

pushSchema().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
