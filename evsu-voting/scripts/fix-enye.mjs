import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function fixGarbledEnye() {
  console.log("Fixing BSCEE programs...");

  const resProgram = await sql`
    UPDATE students 
    SET program = 'BSCEE'
    WHERE program LIKE '%BSCEE%' AND program != 'BSCEE'
    RETURNING student_id, program
  `;
  console.log(`Fixed ${resProgram.length} students with program 'TC BSCEE' to 'BSCEE'.`);

}

fixGarbledEnye().catch(console.error);
