import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    const rows = await sql`
      SELECT id, email_verification_expires FROM users
      WHERE email_verification_token = ${token} AND email_verified = false
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
    }

    const user = rows[0];
    if (new Date(user.email_verification_expires) < new Date()) {
      return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
    }

    await sql`
      UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL
      WHERE id = ${user.id}
    `;

    return NextResponse.redirect(new URL("/login?verified=1", request.url));
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }
}
