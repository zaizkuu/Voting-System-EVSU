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

async function testRegister() {
  try {
    // 1. Find an unregistered student
    const unregistered = await sql`SELECT student_id, full_name FROM students WHERE is_registered = FALSE LIMIT 1`;
    if (!unregistered.length) {
      console.log("No unregistered students found.");
      return;
    }
    const student = unregistered[0];
    console.log("Found unregistered student:", student);

    // 2. Try inserting to users table
    const email = `test_${Date.now()}@test.com`;
    console.log("Attempting to insert user with email:", email);
    
    const newUsers = await sql`
      INSERT INTO users (student_id, full_name, email, password_hash, role, email_verified)
      VALUES (${student.student_id}, ${student.full_name}, ${email}, 'testhash', 'student', true)
      RETURNING id, role, email
    `;
    
    console.log("Successfully inserted user:", newUsers[0]);
    
    // 3. Clean up
    await sql`DELETE FROM users WHERE id = ${newUsers[0].id}`;
    await sql`UPDATE students SET is_registered = FALSE WHERE student_id = ${student.student_id}`;
    console.log("Cleaned up test user.");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testRegister();
