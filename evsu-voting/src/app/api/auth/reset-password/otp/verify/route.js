import { NextResponse } from "next/server";
import {
  hashOtp,
  getResetOtpSecret,
  decodeSignedState,
  encodeSignedState,
  nowEpochSeconds,
  RESET_OTP_COOKIE,
  RESET_OTP_VERIFIED_COOKIE,
  RESET_OTP_TTL_SECONDS,
  RESET_OTP_MAX_ATTEMPTS,
  cookieOptions,
} from "@/lib/auth/resetOtp";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const body = await request.json();
    const otp = String(body?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter a valid 6-digit OTP code." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const stateCookie = cookieStore.get(RESET_OTP_COOKIE)?.value;

    if (!stateCookie) {
      return NextResponse.json({ error: "OTP session expired. Request a new OTP." }, { status: 400 });
    }

    const secret = getResetOtpSecret();
    const state = decodeSignedState(stateCookie, secret);

    if (!state) {
      return NextResponse.json({ error: "OTP session is invalid. Request a new OTP." }, { status: 400 });
    }

    if (state.attempts >= RESET_OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Too many failed attempts. Request a new OTP." }, { status: 429 });
    }

    const elapsed = nowEpochSeconds() - (state.createdAt || 0);
    if (elapsed > RESET_OTP_TTL_SECONDS) {
      return NextResponse.json({ error: "OTP has expired. Request a new one." }, { status: 400 });
    }

    const expectedHash = hashOtp({
      otp,
      userId: state.userId,
      email: state.email,
      nonce: state.nonce,
      secret,
    });

    if (expectedHash !== state.otpHash) {
      state.attempts = (state.attempts || 0) + 1;
      const updatedState = encodeSignedState(state, secret);
      const response = NextResponse.json({ error: "Invalid OTP code. Try again." }, { status: 400 });
      response.cookies.set(RESET_OTP_COOKIE, updatedState, cookieOptions(RESET_OTP_TTL_SECONDS));
      return response;
    }

    const verifiedState = encodeSignedState({
      userId: state.userId,
      email: state.email,
      verified: true,
      verifiedAt: nowEpochSeconds(),
    }, secret);

    const response = NextResponse.json({ message: "OTP verified. You can now set a new password." });
    response.cookies.set(RESET_OTP_VERIFIED_COOKIE, verifiedState, cookieOptions(RESET_OTP_TTL_SECONDS));
    response.cookies.set(RESET_OTP_COOKIE, "", cookieOptions(0));
    return response;
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ error: "Unable to verify OTP right now." }, { status: 500 });
  }
}
