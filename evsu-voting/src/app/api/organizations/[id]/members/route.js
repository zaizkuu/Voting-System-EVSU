import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const studentId = String(body.student_id || "").trim();

    if (!studentId) return NextResponse.json({ error: "Student ID required." }, { status: 400 });

    await sql`INSERT INTO student_organizations (student_id, organization_id) VALUES (${studentId}, ${id}) ON CONFLICT DO NOTHING`;
    return NextResponse.json({ message: "Member added." });
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("membershipId");

    if (membershipId) {
      await sql`DELETE FROM student_organizations WHERE id = ${membershipId} AND organization_id = ${id}`;
    }
    return NextResponse.json({ message: "Member removed." });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
