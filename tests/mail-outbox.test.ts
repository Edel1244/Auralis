import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseOutboxMail, readOutboxFor } from "@/server/mail-outbox";

const mail = (to: string, subject: string, link: string) =>
  `From: AURALIS <no-reply@auralis.local>\nTo: ${to}\nSubject: ${subject}\n\nHello,\n\nOpen ${link} to continue.\n`;

describe("parseOutboxMail", () => {
  it("parses headers, body, date and first link", () => {
    const m = parseOutboxMail("1700000000000-a@b.c.eml", mail("a@b.c", "Verify", "http://localhost:3000/verify-email?token=abc"));
    expect(m).toMatchObject({
      id: "1700000000000-a@b.c",
      to: "a@b.c",
      subject: "Verify",
      link: "http://localhost:3000/verify-email?token=abc",
      date: new Date(1700000000000).toISOString(),
    });
    expect(m?.body).toContain("Hello,");
  });

  it("handles CRLF and rejects malformed files", () => {
    expect(parseOutboxMail("1-x.eml", "To: x@y.z\r\nSubject: S\r\n\r\nbody")?.subject).toBe("S");
    expect(parseOutboxMail("1-x.eml", "no headers here")).toBeNull();
    expect(parseOutboxMail("1-x.eml", "Subject: no recipient\n\nbody")).toBeNull();
  });
});

describe("readOutboxFor", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "auralis-outbox-"));
    await writeFile(path.join(dir, "1000-me@x.io.eml"), mail("me@x.io", "Old", "http://h/1"));
    await writeFile(path.join(dir, "3000-me@x.io.eml"), mail("Me@X.io", "New", "http://h/3"));
    await writeFile(path.join(dir, "2000-other@x.io.eml"), mail("other@x.io", "Not mine", "http://h/2"));
    await writeFile(path.join(dir, "4000-me@x.io.evil.eml"), mail("me@x.io.evil", "Lookalike", "http://h/4"));
    await writeFile(path.join(dir, "notes.txt"), "ignored");
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("returns only the user's own mail, newest first", async () => {
    const items = await readOutboxFor("me@x.io", 20, dir);
    expect(items.map((m) => m.subject)).toEqual(["New", "Old"]);
  });

  it("respects the limit", async () => {
    expect(await readOutboxFor("me@x.io", 1, dir)).toHaveLength(1);
  });

  it("returns an empty list when the outbox does not exist", async () => {
    expect(await readOutboxFor("me@x.io", 20, path.join(dir, "missing"))).toEqual([]);
  });
});
