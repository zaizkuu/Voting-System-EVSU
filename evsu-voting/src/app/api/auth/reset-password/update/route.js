import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const tokens = await sql`
      SELECT id, user_id, expires_at, used FROM password_reset_tokens
      WHERE token = ${token} AND used = false LIMIT 1
    `;

    if (!tokens.length) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    const resetToken = tokens[0];
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Reset link has expired. Request a new one." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${resetToken.user_id}`;
    await sql`UPDATE password_reset_tokens SET used = true WHERE id = ${resetToken.id}`;

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Unable to update password right now." }, { status: 500 });
  }
}
