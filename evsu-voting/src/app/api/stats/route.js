import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const [students, elections, activeElections, votes, recent] = await Promise.all([
      sql`SELECT count(*)::int as count FROM students`,
      sql`SELECT count(*)::int as count FROM elections`,
      sql`SELECT count(*)::int as count FROM elections WHERE status = 'active'`,
      sql`SELECT count(*)::int as count FROM votes`,
      sql`SELECT id, title, type, status, created_at FROM elections ORDER BY created_at DESC LIMIT 5`,
    ]);

    return NextResponse.json({
      stats: {
        students: students[0]?.count || 0,
        elections: elections[0]?.count || 0,
        active: activeElections[0]?.count || 0,
        votes: votes[0]?.count || 0,
      },
      recentElections: recent || [],
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Unable to load stats." }, { status: 500 });
  }
}
