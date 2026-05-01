import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, email, password_hash, role, full_name, email_verified, student_id
      FROM users WHERE email = ${email} LIMIT 1
    `;

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json({
        error: "Your email is not verified yet. Check your inbox for the verification link.",
        canResend: true,
      }, { status: 403 });
    }

    await createSession(user.id, user.role, user.email);

    return NextResponse.json({
      role: user.role,
      fullName: user.full_name,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Unable to process login right now." }, { status: 500 });
  }
}
