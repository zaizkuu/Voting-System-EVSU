import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

const broken = await sql`SELECT full_name FROM students WHERE full_name LIKE '%Ã±%' OR full_name LIKE '%Ã‘%' LIMIT 5`;
console.log('Students with broken characters:', broken);

const proper = await sql`SELECT full_name FROM students WHERE full_name LIKE '%Ñ%' OR full_name LIKE '%ñ%' LIMIT 5`;
console.log('Students with proper Ñ:', proper);
