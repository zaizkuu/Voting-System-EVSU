import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, full_name, email, role, student_id FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        studentId: user.student_id,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
