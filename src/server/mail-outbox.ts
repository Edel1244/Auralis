import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Where messages go when no SMTP server is configured (relative to the server's working directory). */
export const OUTBOX_DIR = ".data/mail";

export type OutboxMail = { id: string; date: string; from: string; to: string; subject: string; body: string; link: string | null };

/** Parses one outbox file written by sendMail(): RFC-822-style headers, blank line, plain-text body. */
export function parseOutboxMail(fileName: string, text: string): OutboxMail | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const split = normalized.indexOf("\n\n");
  if (split < 0) return null;
  const headers: Record<string, string> = {};
  for (const line of normalized.slice(0, split).split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  if (!headers.to) return null;
  const body = normalized.slice(split + 2).trim();
  const ts = Number(fileName.split("-")[0]);
  return {
    id: fileName.replace(/\.eml$/, ""),
    date: new Date(Number.isFinite(ts) && ts > 0 ? ts : 0).toISOString(),
    from: headers.from ?? "",
    to: headers.to,
    subject: headers.subject ?? "",
    body,
    link: body.match(/https?:\/\/\S+/)?.[0] ?? null,
  };
}

/** Outbox messages addressed exactly to `email`, newest first. */
export async function readOutboxFor(email: string, limit = 20, dir = path.resolve(OUTBOX_DIR)): Promise<OutboxMail[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".eml"));
  } catch {
    return [];
  }
  const target = email.trim().toLowerCase();
  const out: OutboxMail[] = [];
  // Newest first: file names start with a millisecond timestamp.
  for (const f of files.sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]))) {
    const mail = parseOutboxMail(f, await readFile(path.join(dir, f), "utf8"));
    if (mail && mail.to.toLowerCase() === target) out.push(mail);
    if (out.length >= limit) break;
  }
  return out;
}
