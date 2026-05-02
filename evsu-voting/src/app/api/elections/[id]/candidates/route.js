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
      INSERT INTO candidates (election_id, position_id, full_name, party, motto, platform, department, year_level, photo_url)
      VALUES (${id}, ${body.position_id}, ${body.full_name}, ${body.party || 'Independent'}, ${body.motto || null}, ${body.platform || null}, ${body.department || null}, ${body.year_level || null}, ${body.photo_url || null})
      RETURNING id
    `;

    return NextResponse.json({ id: result[0].id, message: "Candidate added." });
  } catch (error) {
    console.error("Add candidate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get("candidateId");

    if (candidateId) {
      await sql`DELETE FROM candidates WHERE id = ${candidateId} AND election_id = ${id}`;
    }

    return NextResponse.json({ message: "Candidate deleted." });
  } catch (error) {
    console.error("Delete candidate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { candidateId, full_name, party, motto, platform, department, year_level, photo_url } = body;

    if (!candidateId) return NextResponse.json({ error: "Candidate ID required." }, { status: 400 });

    await sql`
      UPDATE candidates SET
        full_name = ${full_name},
        party = ${party || 'Independent'},
        motto = ${motto || null},
        platform = ${platform || null},
        department = ${department || null},
        year_level = ${year_level || null},
        photo_url = COALESCE(${photo_url || null}, photo_url)
      WHERE id = ${candidateId} AND election_id = ${id}
    `;

    return NextResponse.json({ message: "Candidate updated." });
  } catch (error) {
    console.error("Update candidate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
