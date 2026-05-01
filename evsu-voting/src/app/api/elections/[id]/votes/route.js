import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await params;

    const voteCount = await sql`
      SELECT count(*)::int as count FROM votes WHERE election_id = ${id} AND voter_id = ${session.userId}
    `;

    const votes = await sql`SELECT candidate_id, policy_option_id, policy_vote, voter_id FROM votes WHERE election_id = ${id}`;

    return NextResponse.json({
      hasVoted: (voteCount[0]?.count || 0) > 0,
      votes: votes || [],
    });
  } catch (error) {
    console.error("Get votes error:", error);
    return NextResponse.json({ error: "Unable to load votes." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const rows = body.votes || [];

    // Check if already voted
    const existing = await sql`
      SELECT count(*)::int as count FROM votes WHERE election_id = ${id} AND voter_id = ${session.userId}
    `;

    if ((existing[0]?.count || 0) > 0) {
      return NextResponse.json({ error: "You already submitted your vote." }, { status: 400 });
    }

    // Insert votes
    for (const vote of rows) {
      await sql`
        INSERT INTO votes (election_id, position_id, candidate_id, policy_option_id, policy_vote, voter_id)
        VALUES (${id}, ${vote.position_id || null}, ${vote.candidate_id || null}, ${vote.policy_option_id || null}, ${vote.policy_vote || null}, ${session.userId})
      `;
    }

    return NextResponse.json({ message: "Vote submitted successfully." });
  } catch (error) {
    console.error("Submit vote error:", error);
    return NextResponse.json({ error: error.message || "Unable to submit vote." }, { status: 500 });
  }
}
