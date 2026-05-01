import { NextResponse } from "next/server";
import crypto from "node:crypto";
import sql from "@/lib/db";
import nodemailer from "nodemailer";
import { renderThemedEmail } from "@/lib/email/themeTemplate";

function getAppOrigin(request) {
  const envUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (envUrl) {
    try { return new URL(envUrl).origin; } catch {}
  }
  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const users = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
    // Always return success to prevent user enumeration
    if (!users.length) {
      return NextResponse.json({ message: "If an account exists for that email, a password reset link has been sent." });
    }

    const user = users[0];
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (${user.id}, ${resetToken}, ${expiresAt.toISOString()})
    `;

    const appOrigin = getAppOrigin(request);
    const resetUrl = `${appOrigin}/reset-password?token=${resetToken}`;

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

      const themedHtml = renderThemedEmail({
        preheader: "EVSU Voting password reset request",
        title: "EVSU Voting Password Reset",
        subtitle: "Secure account recovery",
        bodyHtml: `
          <p style="margin:0 0 12px;">We received a request to reset your EVSU Voting account password.</p>
          <p style="margin:0 0 12px;">To continue, use the button below. For security, you will verify a one-time passcode before changing your password.</p>
          <p style="margin:0 0 12px;">If this request was not made by you, you can safely ignore this email.</p>
        `,
        ctaLabel: "Reset My Password",
        ctaUrl: resetUrl,
        footerNote: "This password reset link is time-limited for your protection.",
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "EVSU Voting Password Reset",
        text: `Reset your password: ${resetUrl}`,
        html: themedHtml,
      });
    }

    return NextResponse.json({ message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Unable to process reset request right now." }, { status: 500 });
  }
}
