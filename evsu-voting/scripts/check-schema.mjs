import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  const res = await sql`
    SELECT table_name, column_name, column_default 
    FROM information_schema.columns 
    WHERE column_name = 'id' AND table_schema = 'public'
  `;
  console.log(res);
}

checkSchema().catch(console.error);
