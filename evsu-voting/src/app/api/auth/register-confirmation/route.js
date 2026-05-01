import { NextResponse } from "next/server";
import sql from "@/lib/db";
import nodemailer from "nodemailer";
import { renderThemedEmail, escapeEmailText } from "@/lib/email/themeTemplate";

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
    const fullName = String(body?.fullName || "Student").trim() || "Student";

    if (!email) {
      return NextResponse.json({ error: "Invalid registration details." }, { status: 400 });
    }

    const users = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
    if (!users.length) {
      return NextResponse.json({ message: "Registration recorded." });
    }

    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPassword = String(process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
    const smtpFrom = process.env.SMTP_FROM ? `${process.env.SMTP_FROM} <${smtpUser}>` : smtpUser;

    if (!smtpUser || !smtpPassword) {
      return NextResponse.json({ message: "Registration recorded." });
    }

    const appOrigin = getAppOrigin(request);
    const loginLink = `${appOrigin}/login`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== "false",
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const themedHtml = renderThemedEmail({
      preheader: "EVSU Voting registration confirmation",
      title: "Welcome to EVSU Voting",
      subtitle: "Your registration has been received",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hello ${escapeEmailText(fullName)},</p>
        <p style="margin:0 0 12px;">Your EVSU Voting registration has been received successfully.</p>
        <p style="margin:0 0 12px;">Please check your email for the verification link to activate your account.</p>
      `,
      ctaLabel: "Go to Login",
      ctaUrl: loginLink,
      footerNote: "If you did not create this account, contact your system administrator.",
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: "EVSU Voting Registration Received",
      text: `Hello ${fullName},\n\nYour EVSU Voting registration has been received successfully.\n\nLogin page: ${loginLink}`,
      html: themedHtml,
    });

    return NextResponse.json({ message: "Registration confirmation email sent." });
  } catch (error) {
    console.error("Register confirmation error:", error);
    return NextResponse.json({ error: "Unable to process registration confirmation right now." }, { status: 500 });
  }
}
