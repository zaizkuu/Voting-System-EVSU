import { readFileSync } from "fs";
import nodemailer from "nodemailer";

const env = readFileSync(".env.local", "utf-8");
env.split("\n").forEach(l => {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim();
});

const smtpUser = String(process.env.SMTP_USER || "").trim();
const smtpPassword = String(process.env.SMTP_APP_PASSWORD || "").replace(/\s+/g, "");
const smtpFrom = process.env.SMTP_FROM ? `${process.env.SMTP_FROM} <${smtpUser}>` : smtpUser;

console.log("SMTP Config:");
console.log("  Host:", process.env.SMTP_HOST);
console.log("  Port:", process.env.SMTP_PORT);
console.log("  User:", smtpUser);
console.log("  Password length:", smtpPassword.length);
console.log("  From:", smtpFrom);

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: smtpUser, pass: smtpPassword },
  });

  console.log("\nVerifying SMTP connection...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified!");
  } catch (err) {
    console.error("❌ SMTP connection failed:", err.message);
    return;
  }

  console.log("\nSending test email to jonjonalbao66@gmail.com...");
  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Verify your EVSU Voting account</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f9;padding:24px 0;font-family:Segoe UI,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e6e8ee;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(120deg,#7f0000,#a80000);padding:22px 28px;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;font-weight:800;">Welcome to EVSU Voting</h1>
                <p style="margin:8px 0 0;color:#f6d7d7;font-size:14px;line-height:1.5;">Verify your email address</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="color:#23354d;font-size:15px;line-height:1.65;">
                  <p style="margin:0 0 12px;">Hello Jon Jon,</p>
                  <p style="margin:0 0 12px;">Thank you for registering for the EVSU Voting System. Please verify your email address to complete your registration.</p>
                  <p style="margin:0 0 12px;"><strong>This is a test email to confirm the email system is working correctly.</strong></p>
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;">
                  <tr>
                    <td style="background:#8c0000;border-radius:10px;">
                      <a href="https://evsu-voting.vercel.app" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Visit EVSU Voting</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border-top:1px solid #eceff5;padding-top:14px;color:#6f7f95;font-size:12px;line-height:1.6;">
                  <p style="margin:0 0 6px;">This is a test verification email.</p>
                  <p style="margin:0;">EVSU Voting System</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  try {
    const result = await transporter.sendMail({
      from: smtpFrom,
      to: "jonjonalbao66@gmail.com",
      subject: "EVSU Voting - Test Verification Email",
      text: "This is a test email from EVSU Voting System to verify the email service is working.",
      html: html,
    });
    console.log("✅ Email sent successfully!");
    console.log("   Message ID:", result.messageId);
    console.log("   Response:", result.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
}

testEmail();
