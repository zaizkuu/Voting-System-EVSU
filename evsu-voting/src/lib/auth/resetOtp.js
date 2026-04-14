import crypto from "node:crypto";

export const RESET_OTP_COOKIE = "reset_otp_state";
export const RESET_OTP_VERIFIED_COOKIE = "reset_otp_verified";
export const RESET_OTP_TTL_SECONDS = 10 * 60;
export const RESET_OTP_MAX_ATTEMPTS = 5;

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getResetOtpSecret() {
  return String(process.env.RESET_OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateOtpNonce() {
  return crypto.randomUUID();
}

export function hashOtp({ otp, userId, email, nonce, secret }) {
  return crypto
    .createHash("sha256")
    .update(`${String(otp || "")}::${String(userId || "")}::${normalizeEmail(email)}::${String(nonce || "")}::${String(secret || "")}`)
    .digest("hex");
}

export function encodeSignedState(payloadObject, secret) {
  const payload = toBase64Url(JSON.stringify(payloadObject));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function decodeSignedState(rawValue, secret) {
  const value = String(rawValue || "").trim();
  if (!value.includes(".")) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload, secret);
  if (!safeEqualText(signature, expected)) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
}

export function maskEmail(value) {
  const email = normalizeEmail(value);
  const [localPart, domainPart] = email.split("@");

  if (!localPart || !domainPart) {
    return "your email";
  }

  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.slice(-1);
  const maskedMiddle = "*".repeat(Math.max(2, localPart.length - 3));

  return `${visibleStart}${maskedMiddle}${visibleEnd}@${domainPart}`;
}

export function cookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
