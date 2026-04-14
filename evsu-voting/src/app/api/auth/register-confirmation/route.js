import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { renderThemedEmail, escapeEmailText } from "@/lib/email/themeTemplate";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildSenderAddress(senderNameOrEmail, smtpUser) {
  const normalizedFrom = String(senderNameOrEmail || "").trim();
  const normalizedUser = String(smtpUser || "").trim();
  const userIsEmail = isValidEmail(normalizedUser);

  if (!normalizedFrom) {
    return userIsEmail ? normalizedUser : "";
  }

  if (isValidEmail(normalizedFrom)) {
    return normalizedFrom;
  }

  if (userIsEmail) {
    return `${normalizedFrom} <${normalizedUser}>`;
  }

  return "";
}

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

function parseOrigin(value) {
  try {
    return new URL(String(value || "").trim()).origin;
  } catch {
    return null;
  }
}

function withHttps(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

function firstHeaderValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .find(Boolean) || "";
}

function isLocalhostOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function getAppOrigin(request) {
  const headerOrigin = firstHeaderValue(request.headers.get("origin"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = firstHeaderValue(request.headers.get("host"));

  const rawCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    withHttps(process.env.VERCEL_URL),
    headerOrigin,
    forwardedHost ? `${forwardedProto}://${forwardedHost}` : "",
    host ? `${forwardedProto}://${host}` : "",
    request.url,
  ];

  const uniqueOrigins = [];
  const seen = new Set();

  rawCandidates.forEach((candidate) => {
    const origin = parseOrigin(candidate);
    if (!origin || seen.has(origin)) {
      return;
    }

    seen.add(origin);
    uniqueOrigins.push(origin);
  });

  if (process.env.NODE_ENV === "production") {
    const deployedOrigin = uniqueOrigins.find((origin) => !isLocalhostOrigin(origin));
    return deployedOrigin || null;
  }

  return uniqueOrigins[0] || null;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload?.email);
    const fullName = String(payload?.fullName || "Student").trim() || "Student";
    const userId = String(payload?.userId || "").trim();

    if (!isValidEmail(email) || !userId) {
      return NextResponse.json({ error: "Invalid registration details." }, { status: 400 });
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase registration email configuration." },
        { status: 500 }
      );
    }

    const smtpHost = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const smtpPort = parsePort(String(process.env.SMTP_PORT || "465").trim());
    const smtpSecure = parseBoolean(String(process.env.SMTP_SECURE || "true").trim());
    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPassword = String(process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
    const smtpFrom = buildSenderAddress(process.env.SMTP_FROM, smtpUser);

    const smtpUserIsEmail = isValidEmail(smtpUser);

    const smtpReady = Boolean(smtpUserIsEmail && smtpPassword && smtpFrom && smtpPort !== null && smtpSecure !== null);

    const appOrigin = getAppOrigin(request);
    if (!appOrigin) {
      return NextResponse.json(
        { error: "Set NEXT_PUBLIC_APP_URL to your deployed HTTPS domain for email links." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      return NextResponse.json({ message: "Registration recorded." });
    }

    if (normalizeEmail(userData.user.email) !== email) {
      return NextResponse.json({ message: "Registration recorded." });
    }

    if (!smtpReady) {
      return NextResponse.json({ error: "Registration email service is not configured correctly." }, { status: 500 });
    }

    const loginLink = `${appOrigin}/login`;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    try {
      const themedHtml = renderThemedEmail({
        preheader: "EVSU Voting registration confirmation",
        title: "Welcome to EVSU Voting",
        subtitle: "Your registration has been received",
        bodyHtml: `
          <p style="margin:0 0 12px;">Hello ${escapeEmailText(fullName)},</p>
          <p style="margin:0 0 12px;">Your EVSU Voting registration has been received successfully.</p>
          <p style="margin:0 0 12px;">If your account still needs email verification, open the verification message from Supabase and complete confirmation first.</p>
        `,
        ctaLabel: "Go to Login",
        ctaUrl: loginLink,
        footerNote: "If you did not create this account, contact your system administrator.",
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "EVSU Voting Registration Received",
        text: [
          `Hello ${fullName},`,
          "",
          "Your EVSU Voting registration has been received successfully.",
          "If you still need to verify your email, open the verification message sent by Supabase and finish confirmation.",
          "",
          `Login page: ${loginLink}`,
          "",
          "Welcome to EVSU Voting.",
        ].join("\n"),
        html: themedHtml,
      });
    } catch (smtpError) {
      console.error("register-confirmation sendMail error:", smtpError?.message || smtpError);
      return NextResponse.json({ error: "Unable to send registration confirmation email right now." }, { status: 500 });
    }

    return NextResponse.json({ message: "Registration confirmation email sent." });
  } catch {
    return NextResponse.json({ error: "Unable to process registration confirmation right now." }, { status: 500 });
  }
}
