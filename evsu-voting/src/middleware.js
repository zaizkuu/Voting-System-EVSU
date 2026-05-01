import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function getSessionFromRequest(request) {
  try {
    const token = request.cookies.get("session")?.value;
    if (!token) return null;

    const secret = getJwtSecret();
    if (!secret) return null;

    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const session = await getSessionFromRequest(request);

  const isAdminPath = pathname.startsWith("/admin");
  const isStudentPath = pathname.startsWith("/student");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Unauthenticated users trying to access protected routes go to login
  if (!session && (isAdminPath || isStudentPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in users
  if (session) {
    // If they are on auth pages (except /login/admin), redirect to dashboard
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = session.role === "admin" ? "/admin" : "/student";
      return NextResponse.redirect(url);
    }

    // Role-based route enforcement
    if (session.role === "admin" && isStudentPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    if (session.role !== "admin" && isAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
