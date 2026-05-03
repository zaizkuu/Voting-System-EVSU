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
const ADMIN_PASSWORD = "Evsu@Admin";
const ADMIN_NAME = "System Administrator";

async function resetAdmins() {
  console.log("🔧 Deleting all existing admins...");

  // Delete existing admins
  const result = await sql`
    DELETE FROM public.users WHERE role = 'admin' RETURNING id, email
  `;
  
  console.log(`✅ Deleted ${result.length} admin accounts.`);
  
  console.log("\n🔧 Creating new admin account...\n");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${"*".repeat(ADMIN_PASSWORD.length)}\n`);

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

resetAdmins().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
