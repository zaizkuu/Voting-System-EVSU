import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/students/me
 * Returns the current student's profile and their organization memberships.
 * Accessible by any authenticated student user.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const studentId = session.email
      ? (await sql`SELECT student_id FROM users WHERE id = ${session.userId} LIMIT 1`)[0]?.student_id
      : null;

    if (!studentId) {
      return NextResponse.json({ student: null, organizationIds: [] });
    }

    // Look up the student record from the students table
    const students = await sql`
      SELECT id, student_id, full_name, program, department, year_level
      FROM students WHERE student_id = ${studentId} LIMIT 1
    `;

    if (!students.length) {
      return NextResponse.json({ student: null, organizationIds: [] });
    }

    const student = students[0];

    // Get org memberships using the students table UUID
    const memberships = await sql`
      SELECT organization_id FROM student_organizations WHERE student_id = ${student.id}
    `;

    const organizationIds = memberships.map((m) => m.organization_id);

    return NextResponse.json({ student, organizationIds });
  } catch (error) {
    console.error("students/me error:", error);
    return NextResponse.json({ error: "Unable to load student profile." }, { status: 500 });
  }
}
