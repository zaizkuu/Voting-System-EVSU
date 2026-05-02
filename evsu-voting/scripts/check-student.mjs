import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

const users = await sql`SELECT id, student_id, email, full_name, email_verified, role, created_at FROM users WHERE student_id = '2023-35513'`;
console.log("Users with student_id 2023-35513:", JSON.stringify(users, null, 2));

if (users.length && !users[0].email_verified) {
  console.log("\nAuto-verifying email...");
  await sql`UPDATE users SET email_verified = true WHERE id = ${users[0].id}`;
  console.log("✅ Email verified — you can now log in.");
}
