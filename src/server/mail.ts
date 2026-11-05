import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

let transporter: Transporter | null = null;

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Sends mail through SMTP when SMTP_URL is configured. Otherwise (development)
 * the message is written to .data/mail/*.eml and the first link is logged, so
 * verification and reset flows remain fully testable without a mail server.
 */
export async function sendMail(mail: Mail) {
  const { SMTP_URL, MAIL_FROM } = env();
  if (SMTP_URL) {
    transporter ??= nodemailer.createTransport(SMTP_URL);
    await transporter.sendMail({ from: MAIL_FROM, ...mail });
    logger.info("mail_sent", { to: mail.to, subject: mail.subject });
    return;
  }
  const dir = path.join(process.cwd(), ".data", "mail");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`);
  const body = `From: ${MAIL_FROM}\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`;
  await writeFile(file, body, "utf8");
  const link = mail.text.match(/https?:\/\/\S+/)?.[0];
  logger.info("mail_outbox", { to: mail.to, subject: mail.subject, file, link });
}

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#008CFF;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#080B10;font-family:Inter,Arial,sans-serif;color:#fff">
<div style="max-width:520px;margin:0 auto;padding:40px 28px">
<div style="letter-spacing:.28em;font-weight:700;color:#3DF2FF">AURALIS</div>
<h1 style="font-size:22px;margin:24px 0 12px">${title}</h1>
<p style="color:#9AA6B8;line-height:1.6">${body}</p>${button}
<p style="color:#66738A;font-size:12px">If you didn't request this, you can ignore this email.</p>
</div></body></html>`;
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Verify your AURALIS email",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up AURALIS:\n${url}\n\nThis link expires in 48 hours.`,
    html: layout(`Welcome, ${escapeHtml(name)}`, "Confirm your email address to finish setting up your account. This link expires in 48 hours.", {
      label: "Verify email",
      url,
    }),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Reset your AURALIS password",
    text: `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${url}`,
    html: layout("Reset your password", "Use the button below to choose a new password. This link is valid for 1 hour.", {
      label: "Reset password",
      url,
    }),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
