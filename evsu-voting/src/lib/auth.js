import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
}

/**
 * Hash a plaintext password.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a signed JWT and set it as an HTTP-only cookie.
 */
export async function createSession(userId, role, email) {
  const token = await new SignJWT({ userId, role, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return token;
}

/**
 * Read and verify the session JWT from cookies.
 * Returns { userId, role, email } or null.
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Read and verify the session JWT from a request object (for middleware).
 * Returns { userId, role, email } or null.
 */
export async function getSessionFromRequest(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Clear the session cookie.
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Require a valid session. Returns session or null.
 */
export async function requireAuth() {
  const session = await getSession();
  return session;
}

/**
 * Require admin role. Returns session or null.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
