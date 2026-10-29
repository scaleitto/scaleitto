import "server-only";
import { getDictionary, dir, type Locale } from "@/i18n";
import { mailHtml, sendMail } from "@/server/mail";
import { createAuthToken } from "@/server/auth/tokens";

const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

// "Confirm your email": the link stays valid 3 days
export async function sendVerifyEmail(user: { id: string; email: string; name: string }, locale: Locale) {
  const m = getDictionary(locale).emails;
  const token = await createAuthToken(user.id, "verify", 72);
  const url = `${appUrl()}/${locale}/verify?token=${token}`;
  const lines = [m.hello.replace("{name}", user.name), m.verifyText];
  await sendMail({
    to: user.email,
    subject: m.verifySubject,
    text: [...lines, url].join("\n\n"),
    html: mailHtml({ title: m.verifySubject, lines, button: m.verifyButton, url, footer: m.footer, rtl: dir(locale) === "rtl" }),
  });
}

// "Choose a new password": the link stays valid 1 hour
export async function sendResetEmail(user: { id: string; email: string; name: string }, locale: Locale) {
  const m = getDictionary(locale).emails;
  const token = await createAuthToken(user.id, "reset", 1);
  const url = `${appUrl()}/${locale}/reset?token=${token}`;
  const lines = [m.hello.replace("{name}", user.name), m.resetText];
  await sendMail({
    to: user.email,
    subject: m.resetSubject,
    text: [...lines, url].join("\n\n"),
    html: mailHtml({ title: m.resetSubject, lines, button: m.resetButton, url, footer: m.footer, rtl: dir(locale) === "rtl" }),
  });
}
