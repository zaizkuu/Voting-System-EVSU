import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  RESET_OTP_COOKIE,
  RESET_OTP_MAX_ATTEMPTS,
  RESET_OTP_TTL_SECONDS,
  RESET_OTP_VERIFIED_COOKIE,
  cookieOptions,
  decodeSignedState,
  encodeSignedState,
  getResetOtpSecret,
  hashOtp,
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

function clearOtpCookies(response) {
  response.cookies.set(RESET_OTP_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(RESET_OTP_VERIFIED_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}

export async function POST(request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = await request.json();
    const otp = String(payload?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: "Server is missing reset OTP configuration." }, { status: 500 });
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
      return clearOtpCookies(NextResponse.json({ error: "Recovery session is invalid or expired." }, { status: 401 }));
    }

    const rawState = String(request.cookies.get(RESET_OTP_COOKIE)?.value || "").trim();
    const state = decodeSignedState(rawState, otpSecret);

    if (!state) {
      return clearOtpCookies(NextResponse.json({ error: "OTP session expired. Request a new OTP." }, { status: 400 }));
    }

    const now = nowEpochSeconds();
    if (!state.exp || now >= Number(state.exp)) {
      return clearOtpCookies(NextResponse.json({ error: "OTP expired. Request a new OTP." }, { status: 400 }));
    }

    const normalizedUserEmail = normalizeEmail(user.email);
    if (String(state.uid || "") !== user.id || normalizeEmail(state.email) !== normalizedUserEmail) {
      return clearOtpCookies(NextResponse.json({ error: "OTP session does not match this account." }, { status: 401 }));
    }

    const expectedHash = hashOtp({
      otp,
      userId: user.id,
      email: user.email,
      nonce: String(state.nonce || ""),
      secret: otpSecret,
    });

    if (String(state.otpHash || "") !== expectedHash) {
      const attemptsLeft = Math.max(0, Number(state.attemptsLeft || RESET_OTP_MAX_ATTEMPTS) - 1);

      if (attemptsLeft <= 0) {
        return clearOtpCookies(NextResponse.json({ error: "Too many incorrect OTP attempts. Request a new OTP." }, { status: 429 }));
      }

      const updatedState = {
        ...state,
        attemptsLeft,
      };

      const maxAge = Math.max(1, Number(state.exp) - now);
      const response = NextResponse.json(
        { error: `Incorrect OTP. ${attemptsLeft} attempt(s) remaining.` },
        { status: 400 }
      );
      response.cookies.set(RESET_OTP_COOKIE, encodeSignedState(updatedState, otpSecret), cookieOptions(maxAge));
      return response;
    }

    const verifiedState = {
      uid: user.id,
      email: normalizedUserEmail,
      exp: now + RESET_OTP_TTL_SECONDS,
    };

    const response = NextResponse.json({ message: "OTP verified. You can now set your new password." });
    response.cookies.set(
      RESET_OTP_VERIFIED_COOKIE,
      encodeSignedState(verifiedState, otpSecret),
      cookieOptions(RESET_OTP_TTL_SECONDS)
    );
    response.cookies.set(RESET_OTP_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("reset-password otp verify error:", error);
    return NextResponse.json({ error: "Unable to verify OTP right now." }, { status: 500 });
  }
}
