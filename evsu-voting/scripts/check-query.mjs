import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
} catch {}

const sql = neon(process.env.DATABASE_URL);

async function check() {
  try {
    const students = await sql`
      SELECT s.id, s.student_id, s.full_name, s.program, s.department, s.year_level, s.is_registered,
      COALESCE(
        json_agg(o.name) FILTER (WHERE o.name IS NOT NULL),
        '[]'
      ) as organizations
      FROM students s
      LEFT JOIN student_organizations so ON s.id = so.student_id
      LEFT JOIN organizations o ON so.organization_id = o.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `;
    console.log(students);
  } catch (e) {
    console.error('Query Error:', e);
  }
}

check();
