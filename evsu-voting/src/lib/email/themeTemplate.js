function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderThemedEmail({
  preheader,
  title,
  subtitle,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}) {
  const safePreheader = escapeHtml(preheader || "EVSU Voting System Notification");
  const safeTitle = escapeHtml(title || "EVSU Voting");
  const safeSubtitle = escapeHtml(subtitle || "");
  const safeCtaLabel = escapeHtml(ctaLabel || "Open EVSU Voting");
  const safeCtaUrl = escapeHtml(ctaUrl || "#");
  const safeFooter = escapeHtml(footerNote || "If you did not request this, you can ignore this email.");

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f9;padding:24px 0;font-family:Segoe UI,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e6e8ee;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(120deg,#7f0000,#a80000);padding:22px 28px;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;font-weight:800;">${safeTitle}</h1>
                <p style="margin:8px 0 0;color:#f6d7d7;font-size:14px;line-height:1.5;">${safeSubtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="color:#23354d;font-size:15px;line-height:1.65;">${bodyHtml || ""}</div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;">
                  <tr>
                    <td style="background:#8c0000;border-radius:10px;">
                      <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">${safeCtaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border-top:1px solid #eceff5;padding-top:14px;color:#6f7f95;font-size:12px;line-height:1.6;">
                  <p style="margin:0 0 6px;">${safeFooter}</p>
                  <p style="margin:0;">EVSU Voting System</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function escapeEmailText(value) {
  return escapeHtml(value);
}
