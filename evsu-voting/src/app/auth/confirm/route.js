import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  // Email verification is now handled by /api/auth/verify-email
  // This route is kept as a fallback redirect
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
