import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { renderThemedEmail } from "@/lib/email/themeTemplate";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function successResponse() {
  return NextResponse.json({
    message: "If an account exists for that email, a password reset link has been sent.",
  });
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase reset configuration." },
        { status: 500 }
      );
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
      return NextResponse.json({ error: "Reset email service is not configured correctly." }, { status: 500 });
    }

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

    const redirectTo = `${appOrigin}/reset-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    // Avoid user enumeration by returning success for unknown users.
    if (linkError) {
      const message = String(linkError.message || "").toLowerCase();
      if (message.includes("user") && message.includes("not found")) {
        return successResponse();
      }

      console.error("forgot-password generateLink error:", linkError.message);
      return successResponse();
    }

    const actionLink = linkData?.properties?.action_link || linkData?.action_link || "";
    if (!actionLink) {
      console.error("forgot-password missing action link");
      return successResponse();
    }

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
        preheader: "EVSU Voting password reset request",
        title: "EVSU Voting Password Reset",
        subtitle: "Secure account recovery",
        bodyHtml: `
          <p style="margin:0 0 12px;">We received a request to reset your EVSU Voting account password.</p>
          <p style="margin:0 0 12px;">To continue, use the button below. For security, you will verify a one-time passcode before changing your password.</p>
          <p style="margin:0 0 12px;">If this request was not made by you, you can safely ignore this email.</p>
        `,
        ctaLabel: "Reset My Password",
        ctaUrl: actionLink,
        footerNote: "This password reset link is time-limited for your protection.",
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: "EVSU Voting Password Reset",
        text: [
          "We received a request to reset your EVSU Voting account password.",
          "",
          `Use this link to continue: ${actionLink}`,
          "",
          "You will verify a one-time passcode before changing your password.",
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: themedHtml,
      });
    } catch (smtpError) {
      console.error("forgot-password sendMail error:", smtpError?.message || smtpError);
      return NextResponse.json({ error: "Unable to send reset email right now." }, { status: 500 });
    }

    return successResponse();
  } catch {
    return NextResponse.json({ error: "Unable to process reset request right now." }, { status: 500 });
  }
}
