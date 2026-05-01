import { NextResponse } from "next/server";
import crypto from "node:crypto";
import sql from "@/lib/db";
import nodemailer from "nodemailer";
import {
  generateOtpCode,
  generateOtpNonce,
  hashOtp,
  getResetOtpSecret,
  encodeSignedState,
  RESET_OTP_COOKIE,
  RESET_OTP_TTL_SECONDS,
  cookieOptions,
  maskEmail,
} from "@/lib/auth/resetOtp";

export async function POST(request) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }

    const tokens = await sql`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ${token} AND prt.used = false LIMIT 1
    `;

    if (!tokens.length) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    const resetToken = tokens[0];
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Reset link has expired." }, { status: 400 });
    }

    const otpCode = generateOtpCode();
    const nonce = generateOtpNonce();
    const secret = getResetOtpSecret();
    const otpHash = hashOtp({ otp: otpCode, userId: resetToken.user_id, email: resetToken.email, nonce, secret });

    const state = encodeSignedState({
      userId: resetToken.user_id,
      email: resetToken.email,
      otpHash,
      nonce,
      createdAt: Math.floor(Date.now() / 1000),
      attempts: 0,
    }, secret);

    // Send OTP via email
    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPassword = String(process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
    const smtpFrom = process.env.SMTP_FROM ? `${process.env.SMTP_FROM} <${smtpUser}>` : smtpUser;

    if (smtpUser && smtpPassword) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE !== "false",
        auth: { user: smtpUser, pass: smtpPassword },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: resetToken.email,
        subject: "EVSU Voting - Password Reset OTP",
        text: `Your OTP code is: ${otpCode}\n\nThis code expires in 10 minutes.`,
      });
    }

    const response = NextResponse.json({
      message: `OTP sent to ${maskEmail(resetToken.email)}. Enter the 6-digit code below.`,
    });

    response.cookies.set(RESET_OTP_COOKIE, state, cookieOptions(RESET_OTP_TTL_SECONDS));
    return response;
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json({ error: "Unable to send OTP right now." }, { status: 500 });
  }
}
