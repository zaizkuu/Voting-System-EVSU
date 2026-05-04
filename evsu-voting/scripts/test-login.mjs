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
    const value = trimmed.slice(eqIndex + 1).trim();
    process.env[key] = value;
  });
} catch {
  console.log("No .env.local file found.");
}

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!databaseUrl || !adminEmail || !adminPassword) {
  console.error("Missing DATABASE_URL, ADMIN_EMAIL, or ADMIN_PASSWORD in the environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function test() {
  const emailInput = adminEmail;
  const passwordInput = adminPassword;

  const rows = await sql`
    SELECT id, email, password_hash, role, email_verified 
    FROM users 
    WHERE email = ${emailInput.toLowerCase()}
  `;

  if (rows.length === 0) {
    console.log("❌ User not found");
    return;
  }

  const user = rows[0];
  console.log("User found:", { id: user.id, email: user.email, role: user.role, verified: user.email_verified });

  const passwordValid = await bcrypt.compare(passwordInput, user.password_hash);
  console.log("Password valid:", passwordValid);

}

test().catch(console.error);
