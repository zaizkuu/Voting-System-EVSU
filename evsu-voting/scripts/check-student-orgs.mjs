import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function checkStudent() {
  const studentUser = await sql`SELECT id, student_id FROM users WHERE role='student' LIMIT 1`;
  const studentId = studentUser[0].student_id;
  
  const studentRecord = await sql`SELECT id, student_id FROM students WHERE student_id = ${studentId}`;
  console.log("Students record:", studentRecord);

  const memberships = await sql`SELECT * FROM student_organizations WHERE student_id = ${studentRecord[0]?.id}`;
  console.log("Memberships based on students.id:", memberships);

  const memberships2 = await sql`SELECT * FROM student_organizations WHERE student_id = ${studentUser[0].id}`;
  console.log("Memberships based on users.id:", memberships2);
}

checkStudent().catch(console.error);
