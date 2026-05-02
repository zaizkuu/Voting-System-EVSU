import { NextResponse } from "next/server";
import crypto from "node:crypto";
import sql from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
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
    const studentId = String(body?.studentId || "").trim();
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!studentId || !fullName || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Validate student ID exists and is not already registered
    const students = await sql`
      SELECT id, full_name, is_registered FROM students WHERE student_id = ${studentId} LIMIT 1
    `;

    if (!students.length) {
      return NextResponse.json({ error: "Invalid Student ID. Contact your administrator." }, { status: 400 });
    }

    if (students[0].is_registered) {
      return NextResponse.json({ error: "This Student ID is already registered." }, { status: 400 });
    }

    // Check if email is already taken
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existingUsers.length) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
    }

    const profileFullName = String(students[0].full_name || fullName).trim();
    const passwordHash = await hashPassword(password);

    // Insert user (auto-verified)
    const newUsers = await sql`
      INSERT INTO users (student_id, full_name, email, password_hash, role, email_verified)
      VALUES (${studentId}, ${profileFullName}, ${email}, ${passwordHash}, 'student', true)
      RETURNING id, role, email
    `;

    const user = newUsers[0];

    // Mark student as registered
    await sql`UPDATE students SET is_registered = true WHERE student_id = ${studentId}`;

    // Create session so user is logged in immediately
    await createSession(user.id, user.role, user.email);

    // Send welcome confirmation email (non-blocking)
    try {
      const appOrigin = getAppOrigin(request);

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
          preheader: "Your EVSU Voting account has been created",
          title: "Welcome to EVSU Voting",
          subtitle: "Your account is ready",
          bodyHtml: `
            <p style="margin:0 0 12px;">Hello ${profileFullName},</p>
            <p style="margin:0 0 12px;">Your account for the EVSU Voting System has been successfully created and confirmed. You can now log in and participate in elections.</p>
            <p style="margin:0 0 12px;"><strong>Student ID:</strong> ${studentId}</p>
            <p style="margin:0 0 12px;"><strong>Email:</strong> ${email}</p>
          `,
          ctaLabel: "Go to EVSU Voting",
          ctaUrl: `${appOrigin}/student`,
          footerNote: "If you did not create this account, please contact your administrator immediately.",
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          subject: "EVSU Voting - Account Created Successfully",
          text: `Your EVSU Voting account has been created. You can now log in at ${appOrigin}/login`,
          html: themedHtml,
        });
      }
    } catch (emailError) {
      console.error("Welcome email error:", emailError);
      // Don't fail registration if email fails
    }

    return NextResponse.json({
      message: "Account created successfully! You are now logged in.",
      needsVerification: false,
      role: user.role,
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "An account with this email or student ID already exists." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
