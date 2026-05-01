/**
 * Seed script: Creates the default admin account in Neon.
 *
 * Run once with:  node scripts/seed-admin.mjs
 *
 * Credentials:
 *   Email:    admin@evsu.edu.ph
 *   Password: admin12345
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
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

const ADMIN_EMAIL = "admin@evsu.edu.ph";
const ADMIN_PASSWORD = "admin12345";
const ADMIN_NAME = "System Administrator";

async function seedAdmin() {
  console.log("🔧 Seeding default admin account...\n");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${"*".repeat(ADMIN_PASSWORD.length)}\n`);

  // Check if admin already exists
  const existing = await sql`
    SELECT id, email, role FROM public.users WHERE email = ${ADMIN_EMAIL}
  `;

  if (existing.length > 0) {
    console.log(`   ℹ️  Admin user already exists (ID: ${existing[0].id})`);
    console.log(`   Role: ${existing[0].role}`);

    // Ensure role is admin
    if (existing[0].role !== "admin") {
      await sql`UPDATE public.users SET role = 'admin' WHERE id = ${existing[0].id}`;
      console.log("   ✅ Updated role to admin.");
    }

    console.log("\n🎉 Done! You can log in at /login/admin.");
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Insert admin user
  const [newUser] = await sql`
    INSERT INTO public.users (full_name, email, password_hash, role, email_verified)
    VALUES (${ADMIN_NAME}, ${ADMIN_EMAIL}, ${passwordHash}, 'admin', TRUE)
    RETURNING id
  `;

  console.log(`   ✅ Admin user created (ID: ${newUser.id})`);
  console.log("\n🎉 Done! You can now log in at /login/admin with:");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
}

seedAdmin().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
