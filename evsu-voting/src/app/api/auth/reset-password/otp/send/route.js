import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import {
  RESET_OTP_COOKIE,
  RESET_OTP_MAX_ATTEMPTS,
  RESET_OTP_TTL_SECONDS,
  RESET_OTP_VERIFIED_COOKIE,
  cookieOptions,
  encodeSignedState,
  generateOtpCode,
  generateOtpNonce,
  getResetOtpSecret,
  hashOtp,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  nowEpochSeconds,
} from "@/lib/auth/resetOtp";
import { renderThemedEmail } from "@/lib/email/themeTemplate";

function parseBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

function parsePort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }

  return parsed;
}

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

function buildFromAddress(rawFrom, smtpUser) {
  const userEmail = String(smtpUser || "").trim();
  if (!isValidEmail(userEmail)) {
    return "";
  }

  const fromInput = String(rawFrom || "").trim();
  if (!fromInput) {
    return userEmail;
  }

  if (isValidEmail(fromInput)) {
    return fromInput;
  }

  const embedded = fromInput.match(/<([^>]+)>/);
  if (embedded && isValidEmail(String(embedded[1] || "").trim())) {
    return fromInput;
  }

  return `${fromInput} <${userEmail}>`;
}

export async function POST(request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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

    const smtpHost = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const smtpPort = parsePort(String(process.env.SMTP_PORT || "465").trim());
    const smtpSecure = parseBoolean(String(process.env.SMTP_SECURE || "true").trim());
    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPassword = String(process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
    const smtpFrom = buildFromAddress(process.env.SMTP_FROM, smtpUser);

    const smtpReady = Boolean(
      isValidEmail(smtpUser)
      && smtpPassword
      && smtpFrom
      && smtpPort !== null
      && smtpSecure !== null
    );

    if (!smtpReady) {
      return NextResponse.json({ error: "Reset OTP email service is not configured correctly." }, { status: 500 });
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
      return NextResponse.json({ error: "Recovery session is invalid or expired." }, { status: 401 });
    }

    const otpCode = generateOtpCode();
    const otpNonce = generateOtpNonce();
    const expiresAt = nowEpochSeconds() + RESET_OTP_TTL_SECONDS;
    const otpHash = hashOtp({
      otp: otpCode,
      userId: user.id,
      email: user.email,
      nonce: otpNonce,
      secret: otpSecret,
    });

    const state = {
      uid: user.id,
      email: normalizeEmail(user.email),
      nonce: otpNonce,
      otpHash,
      attemptsLeft: RESET_OTP_MAX_ATTEMPTS,
      exp: expiresAt,
    };

    const encodedState = encodeSignedState(state, otpSecret);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const themedHtml = renderThemedEmail({
      preheader: "EVSU Voting password reset OTP",
      title: "Password Reset OTP",
      subtitle: "Verify your identity before changing your password",
      bodyHtml: `
        <p style="margin:0 0 12px;">Use this one-time passcode to continue resetting your EVSU Voting password:</p>
        <p style="margin:0 0 12px;font-size:1.8rem;font-weight:800;letter-spacing:0.24rem;color:#8c0000;">${otpCode}</p>
        <p style="margin:0 0 12px;">This OTP expires in ${Math.floor(RESET_OTP_TTL_SECONDS / 60)} minutes.</p>
      `,
      ctaLabel: "Open Reset Password Page",
      ctaUrl: `${String(process.env.NEXT_PUBLIC_APP_URL || "").trim() || "https://evsu-voting.vercel.app"}/reset-password`,
      footerNote: "If you did not request this, you can ignore this email.",
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: normalizeEmail(user.email),
      subject: "EVSU Voting Password Reset OTP",
      text: [
        "Use this OTP to continue resetting your EVSU Voting password:",
        "",
        otpCode,
        "",
        `This OTP expires in ${Math.floor(RESET_OTP_TTL_SECONDS / 60)} minutes.`,
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
      html: themedHtml,
    });

    const response = NextResponse.json({
      message: `OTP sent to ${maskEmail(user.email)}.`,
    });

    response.cookies.set(RESET_OTP_COOKIE, encodedState, cookieOptions(RESET_OTP_TTL_SECONDS));
    response.cookies.set(RESET_OTP_VERIFIED_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("reset-password otp send error:", error);
    return NextResponse.json({ error: "Unable to send OTP right now." }, { status: 500 });
  }
}
