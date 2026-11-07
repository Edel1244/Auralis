import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/**
 * Static checks for the Docker deployment files, so configuration mistakes are
 * caught by `npm test` instead of only during a (slow) Docker build in CI.
 */
const root = path.resolve(import.meta.dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

type Service = { profiles?: string[]; environment?: Record<string, string>; [k: string]: unknown };
const compose = parse(read("docker-compose.yml")) as { services: Record<string, Service> };

/** Variables Compose treats as required: ${VAR:?msg} or ${VAR?msg}. */
const requiredVars = (value: unknown) =>
  [...JSON.stringify(value).matchAll(/\$\{([A-Z0-9_]+):?\?/g)].map((m) => m[1]);

/** KEY=value pairs from an env file (ignores comments and blank lines). */
function envFile(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

describe("docker-compose.yml", () => {
  it("never marks variables as required inside optional (profiled) services", () => {
    // Compose interpolates every service, active profile or not, so a required
    // variable in an optional service breaks a plain `docker compose up`.
    for (const [name, svc] of Object.entries(compose.services)) {
      if (svc.profiles?.length) expect(requiredVars(svc), `service "${name}"`).toEqual([]);
    }
  });

  it("only requires variables that .env.example defines", () => {
    const example = envFile(read(".env.example"));
    const required = Object.values(compose.services).flatMap(requiredVars);
    expect(required.length).toBeGreaterThan(0);
    for (const v of required) expect(example, `.env.example must define ${v}`).toHaveProperty(v);
  });

  it("passes every variable the server requires to the app container", () => {
    const env = compose.services.app.environment ?? {};
    for (const v of ["DATABASE_URL", "AUTH_SECRET", "APP_URL"]) expect(env, v).toHaveProperty(v);
    expect(String(env.DATABASE_URL)).toContain("@db:5432/");
  });
});

describe("production deployment (deploy/)", () => {
  const prod = parse(read("deploy/docker-compose.prod.yml")) as { services: Record<string, Service & { ports?: string[]; volumes?: string[] }> };
  const caddyfile = read("deploy/Caddyfile");

  it("binds the app to localhost by default so only the proxy is public", () => {
    const ports = (compose.services.app as { ports?: string[] }).ports ?? [];
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatch(/^\$\{AURALIS_BIND:-127\.0\.0\.1\}:/);
  });

  it("exposes Caddy on 80/443 and proxies to the app container", () => {
    const ports = prod.services.caddy.ports ?? [];
    expect(ports).toEqual(expect.arrayContaining(["80:80", "443:443"]));
    expect(caddyfile).toMatch(/reverse_proxy app:3000/);
    expect(caddyfile).toMatch(/\{\$AURALIS_DOMAIN\}/);
    expect(prod.services.caddy.volumes).toEqual(expect.arrayContaining(["./deploy/Caddyfile:/etc/caddy/Caddyfile:ro"]));
  });

  it("serves the app over HTTPS on the configured domain", () => {
    expect(String(prod.services.app.environment?.APP_URL)).toMatch(/^https:\/\/\$\{AURALIS_DOMAIN/);
  });

  it("only requires variables that .env.example defines", () => {
    const example = envFile(read(".env.example"));
    const required = Object.values(prod.services).flatMap(requiredVars);
    expect(required).toEqual(expect.arrayContaining(["AURALIS_DOMAIN", "ACME_EMAIL"]));
    for (const v of required) expect(example, `.env.example must define ${v}`).toHaveProperty(v);
  });

  it("passes the admin bootstrap address to the app", () => {
    expect(compose.services.app.environment).toHaveProperty("BOOTSTRAP_ADMIN_EMAIL");
  });

  it("ships shell scripts with LF line endings", () => {
    for (const f of ["deploy/setup-server.sh", "deploy/update.sh", "scripts/backup.sh"]) expect(read(f), f).not.toContain("\r");
  });
});

describe("Dockerfile", () => {
  const dockerfile = read("Dockerfile");
  const rules = read(".dockerignore")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const matches = (pat: string, p: string) =>
    p === pat || p.startsWith(`${pat}/`) || (pat.endsWith(".*") && p.startsWith(pat.slice(0, -2) + "."));
  /** Docker semantics: rules apply in order, `!` re-includes, and the last matching rule wins. */
  const isIgnored = (p: string) =>
    rules.reduce((ignoredSoFar, rule) => {
      const negate = rule.startsWith("!");
      return matches(negate ? rule.slice(1) : rule, p) ? !negate : ignoredSoFar;
    }, false);

  it("only COPYs files that exist and are not excluded by .dockerignore", () => {
    const sources = [...dockerfile.matchAll(/^COPY (?!--from)(?:--\S+ )*(.+) \S+$/gm)].flatMap((m) => m[1].split(/\s+/));
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources.filter((s) => s !== ".")) {
      expect(existsSync(path.join(root, src)), `${src} exists`).toBe(true);
      expect(isIgnored(src), `${src} is not dockerignored`).toBe(false);
    }
  });

  it("keeps local data and secrets out of the build context", () => {
    for (const p of [".env", ".data", "node_modules", ".next", ".git"]) expect(isIgnored(p), p).toBe(true);
    expect(isIgnored(".env.example")).toBe(false);
  });

  it("gives Prisma commands a DATABASE_URL during the image build", () => {
    // `prisma validate` fails with P1012 when env("DATABASE_URL") is unset.
    // Join shell line continuations so each logical command is checked as a whole.
    const commands = dockerfile.replace(/\\\r?\n/g, " ").split(/&&|\r?\n/);
    for (const line of commands.filter((l) => /prisma\/build\/index\.js (validate|migrate)/.test(l))) {
      if (/migrate deploy/.test(line)) continue; // runs at container start with the real URL
      expect(line, line.trim()).toMatch(/DATABASE_URL=/);
    }
  });

  it("has an entrypoint with LF line endings", () => {
    expect(read("docker/entrypoint.sh")).not.toContain("\r");
  });
});
