import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const [organizations, memberships] = await Promise.all([
      sql`SELECT id, name, description, created_at FROM organizations ORDER BY name ASC`,
      sql`SELECT id, student_id, organization_id FROM student_organizations`,
    ]);

    return NextResponse.json({ organizations: organizations || [], memberships: memberships || [] });
  } catch (error) {
    console.error("Organizations error:", error);
    return NextResponse.json({ error: "Unable to load organizations." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim() || null;

    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    await sql`INSERT INTO organizations (name, description) VALUES (${name}, ${description})`;
    return NextResponse.json({ message: "Organization created." });
  } catch (error) {
    console.error("Create org error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
