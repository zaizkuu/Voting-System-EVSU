import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function checkElections() {
  const elections = await sql`SELECT id, title, type, organization_id, status FROM elections`;
  console.log("Elections:", elections);

  const studentOrgs = await sql`SELECT student_id, organization_id FROM student_organizations LIMIT 5`;
  console.log("Student Orgs:", studentOrgs);

  const students = await sql`SELECT id, student_id, full_name, email FROM users WHERE role='student' LIMIT 5`;
  console.log("Students:", students);
}

checkElections().catch(console.error);
