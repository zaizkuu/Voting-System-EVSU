import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const elections = await sql`SELECT * FROM elections ORDER BY created_at DESC`;
    const organizations = await sql`SELECT id, name FROM organizations ORDER BY name ASC`;

    return NextResponse.json({ elections: elections || [], organizations: organizations || [] });
  } catch (error) {
    console.error("Elections list error:", error);
    return NextResponse.json({ error: "Unable to load elections." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, type, status, start_date, end_date, organization_id } = body;

    const result = await sql`
      INSERT INTO elections (title, description, type, status, start_date, end_date, organization_id, created_by)
      VALUES (${title}, ${description || null}, ${type}, ${status || 'draft'}, ${start_date || null}, ${end_date || null}, ${organization_id || null}, ${session.userId})
      RETURNING id
    `;

    return NextResponse.json({ id: result[0].id, message: "Election created." });
  } catch (error) {
    console.error("Create election error:", error);
    return NextResponse.json({ error: error.message || "Unable to create election." }, { status: 500 });
  }
}
