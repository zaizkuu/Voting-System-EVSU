/**
 * Migrate data from Supabase backup JSON to Neon.
 *
 * Run:  node scripts/migrate-data.mjs
 *
 * Reads the most recent supabase_backup_*.json file and inserts the data
 * into the Neon database (students, organizations, student_organizations, profiles->users).
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { readFileSync, readdirSync } from "fs";
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

// Find the latest backup file
const backupFiles = readdirSync(process.cwd())
  .filter((f) => f.startsWith("supabase_backup_") && f.endsWith(".json"))
  .sort()
  .reverse();

if (!backupFiles.length) {
  console.error("❌ No supabase_backup_*.json file found. Run backup-supabase.mjs first.");
  process.exit(1);
}

const backupPath = resolve(process.cwd(), backupFiles[0]);
console.log(`📂 Using backup: ${backupFiles[0]}\n`);
const backup = JSON.parse(readFileSync(backupPath, "utf-8"));

async function migrateStudents() {
  const students = backup.students || [];
  if (!students.length) { console.log("   ⏭️  No students to migrate."); return; }

  let inserted = 0;
  let skipped = 0;

  for (const s of students) {
    try {
      await sql`
        INSERT INTO public.students (id, student_id, full_name, email, program, department, year_level, is_registered, created_at)
        VALUES (
          ${s.id},
          ${s.student_id},
          ${s.full_name || "Unknown"},
          ${s.email || null},
          ${s.program || null},
          ${s.department || null},
          ${s.year_level || null},
          ${s.is_registered || false},
          ${s.created_at || new Date().toISOString()}
        )
        ON CONFLICT (student_id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate") || err.message?.includes("already exists")) {
        skipped++;
      } else {
        console.error(`   ⚠️  Student ${s.student_id}: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log(`   ✅ Students: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateOrganizations() {
  const orgs = backup.organizations || [];
  if (!orgs.length) { console.log("   ⏭️  No organizations to migrate."); return; }

  let inserted = 0;
  let skipped = 0;

  for (const org of orgs) {
    try {
      await sql`
        INSERT INTO public.organizations (id, name, description, created_at)
        VALUES (
          ${org.id},
          ${org.name},
          ${org.description || null},
          ${org.created_at || new Date().toISOString()}
        )
        ON CONFLICT (name) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) { skipped++; }
      else { console.error(`   ⚠️  Org ${org.name}: ${err.message}`); skipped++; }
    }
  }

  console.log(`   ✅ Organizations: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateStudentOrganizations() {
  const memberships = backup.student_organizations || [];
  if (!memberships.length) { console.log("   ⏭️  No memberships to migrate."); return; }

  let inserted = 0;
  let skipped = 0;

  for (const m of memberships) {
    try {
      await sql`
        INSERT INTO public.student_organizations (id, student_id, organization_id)
        VALUES (${m.id}, ${m.student_id}, ${m.organization_id})
        ON CONFLICT (student_id, organization_id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate") || err.message?.includes("violates")) { skipped++; }
      else { console.error(`   ⚠️  Membership: ${err.message}`); skipped++; }
    }
  }

  console.log(`   ✅ Student-Organizations: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateProfiles() {
  const profiles = backup.profiles || [];
  if (!profiles.length) { console.log("   ⏭️  No profiles to migrate."); return; }

  // Profiles become users in the new schema.
  // We DON'T have their original passwords, so we set a temporary one.
  const tempPasswordHash = await bcrypt.hash("changeme123", 12);

  let inserted = 0;
  let skipped = 0;

  for (const p of profiles) {
    // Skip if this is the admin we already seeded
    if (p.role === "admin") {
      console.log(`   ⏭️  Skipping admin profile: ${p.email}`);
      skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO public.users (id, student_id, full_name, email, password_hash, role, email_verified, created_at)
        VALUES (
          ${p.id},
          ${p.student_id || null},
          ${p.full_name || "Unknown"},
          ${p.email},
          ${tempPasswordHash},
          ${p.role || "student"},
          TRUE,
          ${p.created_at || new Date().toISOString()}
        )
        ON CONFLICT (email) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) { skipped++; }
      else { console.error(`   ⚠️  Profile ${p.email}: ${err.message}`); skipped++; }
    }
  }

  console.log(`   ✅ Users (from profiles): ${inserted} inserted, ${skipped} skipped`);
  if (inserted > 0) {
    console.log(`   ⚠️  NOTE: Migrated student users have a temporary password: changeme123`);
    console.log(`          They should reset their password on first login.`);
  }
}

async function migrateElections() {
  const items = backup.elections || [];
  if (!items.length) { console.log("   ⏭️  No elections to migrate."); return; }
  
  const adminRows = await sql`SELECT id FROM public.users WHERE role = 'admin' LIMIT 1`;
  const adminId = adminRows.length > 0 ? adminRows[0].id : null;

  let inserted = 0, skipped = 0;
  for (const item of items) {
    try {
      let createdBy = item.created_by;
      if (createdBy) {
         const userRows = await sql`SELECT id FROM public.users WHERE id = ${createdBy}`;
         if (userRows.length === 0) createdBy = adminId;
      }
      await sql`
        INSERT INTO public.elections (id, title, description, type, status, organization_id, start_date, end_date, created_by, created_at)
        VALUES (${item.id}, ${item.title}, ${item.description || null}, ${item.type}, ${item.status || 'draft'}, ${item.organization_id || null}, ${item.start_date || null}, ${item.end_date || null}, ${createdBy || null}, ${item.created_at || new Date().toISOString()})
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) skipped++;
      else { console.error(`   ⚠️  Election ${item.title}: ${err.message}`); skipped++; }
    }
  }
  console.log(`   ✅ Elections: ${inserted} inserted, ${skipped} skipped`);
}

async function migratePositions() {
  const items = backup.positions || [];
  if (!items.length) { console.log("   ⏭️  No positions to migrate."); return; }
  let inserted = 0, skipped = 0;
  for (const item of items) {
    try {
      await sql`
        INSERT INTO public.positions (id, election_id, title, max_votes, display_order)
        VALUES (${item.id}, ${item.election_id}, ${item.title}, ${item.max_votes || 1}, ${item.display_order || 0})
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) skipped++;
      else { console.error(`   ⚠️  Position ${item.title}: ${err.message}`); skipped++; }
    }
  }
  console.log(`   ✅ Positions: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateCandidates() {
  const items = backup.candidates || [];
  if (!items.length) { console.log("   ⏭️  No candidates to migrate."); return; }
  let inserted = 0, skipped = 0;
  for (const item of items) {
    try {
      await sql`
        INSERT INTO public.candidates (id, position_id, election_id, full_name, party, motto, platform, photo_url, department, year_level)
        VALUES (${item.id}, ${item.position_id || null}, ${item.election_id}, ${item.full_name}, ${item.party || null}, ${item.motto || null}, ${item.platform || null}, ${item.photo_url || null}, ${item.department || null}, ${item.year_level || null})
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) skipped++;
      else { console.error(`   ⚠️  Candidate ${item.full_name}: ${err.message}`); skipped++; }
    }
  }
  console.log(`   ✅ Candidates: ${inserted} inserted, ${skipped} skipped`);
}

async function migratePolicyOptions() {
  const items = backup.policy_options || [];
  if (!items.length) { console.log("   ⏭️  No policy options to migrate."); return; }
  let inserted = 0, skipped = 0;
  for (const item of items) {
    try {
      await sql`
        INSERT INTO public.policy_options (id, election_id, title, description, display_order)
        VALUES (${item.id}, ${item.election_id}, ${item.title}, ${item.description || null}, ${item.display_order || 0})
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate")) skipped++;
      else { console.error(`   ⚠️  Policy Option ${item.title}: ${err.message}`); skipped++; }
    }
  }
  console.log(`   ✅ Policy Options: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateVotes() {
  const items = backup.votes || [];
  if (!items.length) { console.log("   ⏭️  No votes to migrate."); return; }
  let inserted = 0, skipped = 0;
  for (const item of items) {
    try {
      await sql`
        INSERT INTO public.votes (id, election_id, position_id, candidate_id, policy_option_id, policy_vote, voter_id, created_at)
        VALUES (${item.id}, ${item.election_id}, ${item.position_id || null}, ${item.candidate_id || null}, ${item.policy_option_id || null}, ${item.policy_vote || null}, ${item.voter_id}, ${item.created_at || new Date().toISOString()})
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      if (err.message?.includes("duplicate") || err.message?.includes("violates")) skipped++;
      else { console.error(`   ⚠️  Vote: ${err.message}`); skipped++; }
    }
  }
  console.log(`   ✅ Votes: ${inserted} inserted, ${skipped} skipped`);
}

async function migrate() {

  await migrateStudents();
  await migrateOrganizations();
  await migrateStudentOrganizations();
  await migrateProfiles();
  await migrateElections();
  await migratePositions();
  await migrateCandidates();
  await migratePolicyOptions();
  await migrateVotes();

  console.log("\n🎉 Migration complete!\n");
}

migrate().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
