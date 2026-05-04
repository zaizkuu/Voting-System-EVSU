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

async function forceAdmin() {
  const email = adminEmail;
  const pass = adminPassword;

  await sql`DELETE FROM users WHERE email = ${email}`;
  await sql`DELETE FROM users WHERE role = 'admin'`;

  const hash = await bcrypt.hash(pass, 12);
  const [newUser] = await sql`
    INSERT INTO users (full_name, email, password_hash, role, email_verified)
    VALUES ('System Administrator', ${email}, ${hash}, 'admin', TRUE)
    RETURNING id, password_hash
  `;
  
  console.log(`Created admin with ID: ${newUser.id}`);
  
  const match = await bcrypt.compare(pass, newUser.password_hash);
  console.log(`Hash match immediately after insert: ${match}`);
  
  // Verify reading from DB
  const [dbUser] = await sql`SELECT * FROM users WHERE email = ${email}`;
  const dbMatch = await bcrypt.compare(pass, dbUser.password_hash);
  console.log(`Hash match after reading from DB: ${dbMatch}`);
}

forceAdmin().catch(console.error);
