import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ error: "Only administrators can access student records." }, { status: 403 }) };
  return { user: session };
}

function normalizeStudentRow(row) {
  let fullName = String(row?.full_name || "").trim();
  fullName = fullName.replace(/Ã‘/g, "Ñ").replace(/Ã±/g, "ñ");

  let program = String(row?.program || "").trim();
  if (program.includes("TC BSCEE") || program.includes("TC  BSCEE")) {
    program = "BSCEE";
  }

  return {
    student_id: String(row?.student_id || "").trim(),
    full_name: fullName,
    program: program,
    department: String(row?.department || "").trim(),
    year_level: String(row?.year_level || "").trim(),
    organizations: Array.isArray(row?.organizations) ? row.organizations.map((item) => String(item || "").trim()).filter(Boolean) : [],
  };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.error) return access.error;

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
    `;

    return NextResponse.json({ students: students || [] });
  } catch (error) {
    console.error("students GET error:", error);
    return NextResponse.json({ error: "Unable to load student records right now." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await requireAdmin();
    if (access.error) return access.error;

    const payload = await request.json().catch(() => ({}));
    const inputRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const normalizedRows = inputRows.map(normalizeStudentRow).filter((row) => row.student_id && row.full_name);

    if (!normalizedRows.length) {
      return NextResponse.json({ error: "No valid student rows found." }, { status: 400 });
    }

    // Upsert students one by one
    for (const row of normalizedRows) {
      await sql`
        INSERT INTO students (student_id, full_name, program, department, year_level)
        VALUES (${row.student_id}, ${row.full_name}, ${row.program || null}, ${row.department || null}, ${row.year_level || null})
        ON CONFLICT (student_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          program = EXCLUDED.program,
          department = EXCLUDED.department,
          year_level = EXCLUDED.year_level
      `;
    }

    // Handle organizations
    const orgNames = [...new Set(normalizedRows.flatMap((row) => row.organizations))];

    if (orgNames.length) {
      for (const name of orgNames) {
        await sql`INSERT INTO organizations (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
      }

      const students = await sql`SELECT id, student_id FROM students WHERE student_id = ANY(${normalizedRows.map((r) => r.student_id)})`;
      const organizations = await sql`SELECT id, name FROM organizations WHERE name = ANY(${orgNames})`;

      const studentMap = new Map(students.map((s) => [s.student_id, s.id]));
      const orgMap = new Map(organizations.map((o) => [o.name, o.id]));

      for (const row of normalizedRows) {
        const studentId = studentMap.get(row.student_id);
        if (!studentId) continue;
        for (const orgName of row.organizations) {
          const orgId = orgMap.get(orgName);
          if (!orgId) continue;
          await sql`INSERT INTO student_organizations (student_id, organization_id) VALUES (${studentId}, ${orgId}) ON CONFLICT DO NOTHING`;
        }
      }
    }

    return NextResponse.json({ message: `Imported ${normalizedRows.length} student record(s).`, importedCount: normalizedRows.length });
  } catch (error) {
    console.error("students POST error:", error);
    return NextResponse.json({ error: "Unable to import student records right now." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const access = await requireAdmin();
    if (access.error) return access.error;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id");

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    const students = await sql`SELECT id, student_id FROM students WHERE id = ${studentId} LIMIT 1`;
    if (!students.length) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const student = students[0];

    await sql`DELETE FROM users WHERE student_id = ${student.student_id}`;
    await sql`DELETE FROM student_organizations WHERE student_id = ${student.id}`;
    await sql`DELETE FROM students WHERE id = ${student.id}`;

    return NextResponse.json({ message: "Student deleted successfully." });
  } catch (error) {
    console.error("students DELETE error:", error);
    return NextResponse.json({ error: "Unable to delete student right now." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const access = await requireAdmin();
    if (access.error) return access.error;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id");

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const { full_name, program, department, year_level, organizations } = payload;

    if (!full_name) {
      return NextResponse.json({ error: "Full Name is required." }, { status: 400 });
    }

    await sql`
      UPDATE students 
      SET full_name = ${full_name}, program = ${program || null}, department = ${department || null}, year_level = ${year_level || null}
      WHERE id = ${studentId}
    `;

    if (Array.isArray(organizations)) {
      // Handle organizations update
      // 1. Delete existing student organizations
      await sql`DELETE FROM student_organizations WHERE student_id = ${studentId}`;
      
      // 2. Insert new organizations and link them
      if (organizations.length > 0) {
        for (const name of organizations) {
          const trimmedName = String(name || "").trim();
          if (trimmedName) {
            await sql`INSERT INTO organizations (name) VALUES (${trimmedName}) ON CONFLICT (name) DO NOTHING`;
            const orgs = await sql`SELECT id FROM organizations WHERE name = ${trimmedName}`;
            if (orgs.length) {
               await sql`INSERT INTO student_organizations (student_id, organization_id) VALUES (${studentId}, ${orgs[0].id}) ON CONFLICT DO NOTHING`;
            }
          }
        }
      }
    }

    return NextResponse.json({ message: "Student updated successfully." });
  } catch (error) {
    console.error("students PUT error:", error);
    return NextResponse.json({ error: "Unable to update student right now." }, { status: 500 });
  }
}