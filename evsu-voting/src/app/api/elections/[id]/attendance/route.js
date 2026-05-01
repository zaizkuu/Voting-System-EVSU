import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await params;

    const elections = await sql`SELECT * FROM elections WHERE id = ${id} LIMIT 1`;
    if (!elections.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const election = elections[0];

    let eligibleStudents = [];

    if (election.organization_id) {
      const membershipRows = await sql`
        SELECT student_id FROM student_organizations WHERE organization_id = ${election.organization_id}
      `;
      const eligibleIds = membershipRows.map((r) => r.student_id);

      if (eligibleIds.length) {
        eligibleStudents = await sql`
          SELECT id, student_id, full_name, department, year_level FROM students WHERE id = ANY(${eligibleIds}) ORDER BY full_name ASC
        `;
      }
    } else {
      eligibleStudents = await sql`SELECT id, student_id, full_name, department, year_level FROM students ORDER BY full_name ASC`;
    }

    const eligibleStudentCodes = eligibleStudents.map((s) => s.student_id).filter(Boolean);
    let profileRows = [];
    if (eligibleStudentCodes.length) {
      profileRows = await sql`
        SELECT id, student_id, full_name FROM users WHERE role = 'student' AND student_id = ANY(${eligibleStudentCodes})
      `;
    }

    const voteRows = await sql`SELECT voter_id FROM votes WHERE election_id = ${id}`;

    const profileByStudentId = new Map(profileRows.map((p) => [p.student_id, p]));
    const votedIds = new Set(voteRows.map((v) => v.voter_id));

    const attendance = eligibleStudents.map((student) => {
      const profile = profileByStudentId.get(student.student_id);
      return {
        id: student.id,
        student_id: student.student_id,
        full_name: profile?.full_name || student.full_name,
        department: student.department || "-",
        year_level: student.year_level || "-",
        account_status: profile ? "Registered" : "No Account",
        vote_status: profile && votedIds.has(profile.id) ? "Voted" : "Not Yet",
      };
    });

    const votedCount = attendance.filter((a) => a.vote_status === "Voted").length;

    return NextResponse.json({
      attendance,
      summary: {
        eligible: attendance.length,
        voted: votedCount,
        pending: Math.max(0, attendance.length - votedCount),
      },
    });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json({ error: "Unable to load attendance." }, { status: 500 });
  }
}
