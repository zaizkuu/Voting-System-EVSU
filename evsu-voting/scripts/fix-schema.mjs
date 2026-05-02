import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function fixSchemaDefaults() {
  console.log("Fixing missing default gen_random_uuid() for id columns...");

  const tables = [
    "students",
    "elections",
    "positions",
    "candidates",
    "policy_options",
    "votes",
    "organizations",
    "student_organizations"
  ];

  for (const table of tables) {
    try {
      await sql(`ALTER TABLE public.${table} ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
      console.log(`✅ Set default gen_random_uuid() on ${table}.id`);
    } catch (err) {
      console.error(`❌ Failed to set default on ${table}.id:`, err.message);
    }
  }
}

fixSchemaDefaults().catch(console.error);
