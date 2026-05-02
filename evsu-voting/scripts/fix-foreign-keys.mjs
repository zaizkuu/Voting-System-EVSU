import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function fixForeignKeys() {
  console.log("Fixing elections_created_by_fkey to point to users instead of profiles...");

  try {
    await sql`ALTER TABLE elections DROP CONSTRAINT elections_created_by_fkey;`;
    console.log("✅ Dropped old constraint pointing to profiles");

    await sql`ALTER TABLE elections ADD CONSTRAINT elections_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;`;
    console.log("✅ Added new constraint pointing to users");
  } catch (err) {
    console.error("❌ Failed to update foreign key constraint:", err.message);
  }
}

fixForeignKeys().catch(console.error);
