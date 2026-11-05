import { z } from "zod";

/** Shared by client forms and server handlers so rules can never drift apart. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "moderator", "mod", "auralis", "api", "settings", "login", "logout",
  "register", "signup", "home", "explore", "search", "library", "upload", "uploads", "studio",
  "about", "support", "help", "root", "system", "null", "undefined", "me", "user", "users",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_][a-z0-9._]{2,29}$/, "Username must be 3–30 characters: letters, numbers, dots and underscores")
  .refine((u) => !u.endsWith(".") && !u.includes(".."), "Username cannot end with a dot or contain '..'")
  .refine((u) => !RESERVED_USERNAMES.has(u), "This username is reserved");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must contain a letter and a number");

export const displayNameSchema = z.string().trim().min(1, "Display name is required").max(50);

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "You must accept the upload policy" }),
});

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(200),
});

export const profileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().trim().max(500).optional(),
  username: usernameSchema.optional(),
  isArtist: z.boolean().optional(),
});

export const privacySchema = z.object({
  isPrivate: z.boolean().optional(),
  showListening: z.boolean().optional(),
  showStats: z.boolean().optional(),
  showFollowing: z.boolean().optional(),
});

export const visibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]);
