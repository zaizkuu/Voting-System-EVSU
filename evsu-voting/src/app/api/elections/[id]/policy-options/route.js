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
      INSERT INTO policy_options (election_id, title, description, display_order)
      VALUES (${id}, ${body.title}, ${body.description || null}, ${body.display_order || 0})
      RETURNING id
    `;

    return NextResponse.json({ id: result[0].id, message: "Policy option added." });
  } catch (error) {
    console.error("Add policy option error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
