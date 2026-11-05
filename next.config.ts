import type { NextConfig } from "next";

/**
 * Content-Security-Policy (production only; the dev server needs eval for HMR).
 * Everything is same-origin: fonts are self-hosted by next/font, media and images
 * come from /api/v1. 'unsafe-inline' scripts are required by Next.js's inline
 * bootstrap and the pre-paint theme script; a nonce-based policy via proxy.ts is
 * a possible future hardening step.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
];

const nextConfig: NextConfig = {
  // Self-hosting: produce a minimal standalone server for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  // Native / heavy server-only packages are loaded from node_modules at runtime.
  serverExternalPackages: ["@node-rs/argon2", "sharp", "music-metadata", "@prisma/client"],
  // Storage/mail resolve paths from process.cwd() at runtime, which makes the tracer
  // include the whole project. Never ship local data, secrets or sources in the build.
  // sharp's native libvips libraries (.dll/.so/.dylib) are loaded by the binding, not
  // imported, so the tracer misses them. Include them explicitly for standalone builds.
  outputFileTracingIncludes: {
    "/**": ["node_modules/@img/**/*"],
  },
  outputFileTracingExcludes: {
    "/**": [".data/**", ".env", ".env.*", "tests/**", "src/**", "scripts/**", ".git/**", ".claude/**", "*.md", "tsconfig*.json", "vitest.config.*", "eslint.config.*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
