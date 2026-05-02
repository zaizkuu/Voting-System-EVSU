import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function checkAdminUsers() {
  const res = await sql`SELECT id, role, email FROM users WHERE role = 'admin'`;
  console.log(res);
}

checkAdminUsers().catch(console.error);
