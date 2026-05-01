import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const result = await sql`
      INSERT INTO positions (election_id, title, max_votes, display_order)
      VALUES (${id}, ${body.title}, ${body.max_votes || 1}, ${body.display_order || 0})
      RETURNING id
    `;

    return NextResponse.json({ id: result[0].id, message: "Position added." });
  } catch (error) {
    console.error("Add position error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");

    if (positionId) {
      await sql`DELETE FROM positions WHERE id = ${positionId} AND election_id = ${id}`;
    }

    return NextResponse.json({ message: "Position deleted." });
  } catch (error) {
    console.error("Delete position error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
