import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function fixVotesForeignKey() {
  console.log("Fixing votes_voter_id_fkey to point to users instead of profiles...");

  try {
    await sql`ALTER TABLE votes DROP CONSTRAINT votes_voter_id_fkey;`;
    console.log("✅ Dropped old constraint pointing to profiles");

    await sql`ALTER TABLE votes ADD CONSTRAINT votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE;`;
    console.log("✅ Added new constraint pointing to users");
  } catch (err) {
    console.error("❌ Failed to update foreign key constraint:", err.message);
  }
}

fixVotesForeignKey().catch(console.error);
