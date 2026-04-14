import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  RESET_OTP_VERIFIED_COOKIE,
  cookieOptions,
  decodeSignedState,
  getResetOtpSecret,
  isValidEmail,
  normalizeEmail,
  nowEpochSeconds,
} from "@/lib/auth/resetOtp";

function getBearerToken(request) {
  const authorization = String(request.headers.get("authorization") || "").trim();
  if (!authorization) {
    return "";
  }

  const [scheme, token] = authorization.split(" ");
  if (String(scheme || "").toLowerCase() !== "bearer") {
    return "";
  }

  return String(token || "").trim();
}

export async function POST(request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = await request.json();
    const newPassword = String(payload?.password || "");

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: "Server is missing reset configuration." }, { status: 500 });
    }

    const otpSecret = getResetOtpSecret();
    if (!otpSecret) {
      return NextResponse.json({ error: "Server is missing OTP secret configuration." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    const user = userData?.user;

    if (userError || !user?.id || !isValidEmail(user.email)) {
      const invalidResponse = NextResponse.json({ error: "Recovery session is invalid or expired." }, { status: 401 });
      invalidResponse.cookies.set(RESET_OTP_VERIFIED_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      return invalidResponse;
    }

    const verifiedRaw = String(request.cookies.get(RESET_OTP_VERIFIED_COOKIE)?.value || "").trim();
    const verifiedState = decodeSignedState(verifiedRaw, otpSecret);

    if (!verifiedState) {
      return NextResponse.json({ error: "OTP verification is required before password change." }, { status: 403 });
    }

    const now = nowEpochSeconds();
    const normalizedEmail = normalizeEmail(user.email);

    const isVerifiedForUser = (
      String(verifiedState.uid || "") === user.id
      && normalizeEmail(verifiedState.email) === normalizedEmail
      && Number(verifiedState.exp || 0) > now
    );

    if (!isVerifiedForUser) {
      const mismatchResponse = NextResponse.json(
        { error: "OTP verification expired. Request and verify a new OTP." },
        { status: 403 }
      );
      mismatchResponse.cookies.set(RESET_OTP_VERIFIED_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      return mismatchResponse;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: "Unable to update password right now." }, { status: 500 });
    }

    const response = NextResponse.json({ message: "Password updated successfully." });
    response.cookies.set(RESET_OTP_VERIFIED_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("reset-password update error:", error);
    return NextResponse.json({ error: "Unable to process password update right now." }, { status: 500 });
  }
}
