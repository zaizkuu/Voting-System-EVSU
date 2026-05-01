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

    const [positions, candidates, policyOptions] = await Promise.all([
      sql`SELECT * FROM positions WHERE election_id = ${id} ORDER BY display_order ASC`,
      sql`SELECT * FROM candidates WHERE election_id = ${id} ORDER BY full_name ASC`,
      sql`SELECT * FROM policy_options WHERE election_id = ${id} ORDER BY display_order ASC`,
    ]);

    return NextResponse.json({
      election: elections[0],
      positions: positions || [],
      candidates: candidates || [],
      policyOptions: policyOptions || [],
    });
  } catch (error) {
    console.error("Election detail error:", error);
    return NextResponse.json({ error: "Unable to load election." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { id } = await params;
    await sql`DELETE FROM elections WHERE id = ${id}`;
    return NextResponse.json({ message: "Election deleted." });
  } catch (error) {
    console.error("Delete election error:", error);
    return NextResponse.json({ error: "Unable to delete election." }, { status: 500 });
  }
}
