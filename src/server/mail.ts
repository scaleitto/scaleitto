import "server-only";
import nodemailer from "nodemailer";

// Emails of the platform (confirm the address, new password). Sent through the hosting's SMTP account:
// SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM (default: SMTP_USER).
// E2E_MAIL_URL sends them to the tests' fake inbox instead (never set it in production).
export const mailConfigured = () => Boolean(process.env.E2E_MAIL_URL || (process.env.SMTP_HOST && process.env.SMTP_USER));

// SMTP_SECURE=true/false forces SSL; by default port 465 uses SSL and 587 STARTTLS
function smtp() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim().toLowerCase() === "true" : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    secure,
    auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
  });
}

// Connects and logs in to the SMTP server without sending anything (admin → system check). Throws with the reason and
// what to fix.
export async function verifyMail() {
  try {
    await smtp().verify();
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const hint =
      e.code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(e.message ?? "")
        ? "SMTP_HOST is not a mail server name (Namecheap Private Email: mail.privateemail.com; cPanel email: mail.<your-domain>)"
        : e.code === "EAUTH"
          ? "the server refused SMTP_USER / SMTP_PASS (full email address as user, the mailbox password)"
          : e.code === "ETIMEDOUT" || e.code === "ECONNECTION" || e.code === "ESOCKET"
            ? "no answer on this port: use 465 (SSL) or 587 with SMTP_SECURE=false"
            : "";
    throw new Error(`${e.message ?? String(err)}${hint ? ` → ${hint}` : ""}`);
  }
}

export type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(mail: Mail) {
  if (process.env.E2E_MAIL_URL) {
    const res = await fetch(process.env.E2E_MAIL_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mail) });
    if (!res.ok) throw new Error(`mail ${res.status}`);
    return;
  }
  const transport = smtp();
  await transport.sendMail({ from: process.env.MAIL_FROM || `Scaleitto <${process.env.SMTP_USER}>`, ...mail });
}

// A simple branded email: a title, a few lines, one button
export function mailHtml({ title, lines, button, url, footer, rtl }: { title: string; lines: string[]; button: string; url: string; footer: string; rtl: boolean }) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;background:#f6f6fb;font-family:Tahoma,Arial,sans-serif;color:#0b0820">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #e2e0ef">
<tr><td style="padding:28px 28px 8px"><span style="display:inline-block;background:#4f3bd6;color:#fff;font-weight:bold;border-radius:10px;padding:6px 11px">S</span> <b style="font-size:18px">Scaleitto</b></td></tr>
<tr><td style="padding:8px 28px 0"><h1 style="font-size:20px;margin:12px 0">${esc(title)}</h1>${lines.map((l) => `<p style="font-size:15px;line-height:1.7;color:#5f5b78;margin:0 0 10px">${esc(l)}</p>`).join("")}</td></tr>
<tr><td style="padding:16px 28px 28px"><a href="${esc(url)}" style="display:inline-block;background:#080529;color:#fff;text-decoration:none;font-weight:bold;border-radius:999px;padding:12px 26px">${esc(button)}</a>
<p style="font-size:12px;color:#8a87a3;margin:18px 0 0;word-break:break-all">${esc(url)}</p></td></tr>
</table><p style="font-size:12px;color:#8a87a3;margin-top:16px">${esc(footer)}</p></td></tr></table></body></html>`;
}
