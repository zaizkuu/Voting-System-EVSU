import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    await sql`UPDATE organizations SET name = ${body.name}, description = ${body.description || null} WHERE id = ${id}`;
    return NextResponse.json({ message: "Organization updated." });
  } catch (error) {
    console.error("Update org error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const linked = await sql`SELECT count(*)::int as count FROM elections WHERE organization_id = ${id}`;
    if ((linked[0]?.count || 0) > 0) {
      return NextResponse.json({ error: `Cannot delete: ${linked[0].count} election(s) reference it.` }, { status: 400 });
    }

    await sql`DELETE FROM organizations WHERE id = ${id}`;
    return NextResponse.json({ message: "Organization deleted." });
  } catch (error) {
    console.error("Delete org error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
