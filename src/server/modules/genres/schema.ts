import { z } from "zod";

export const genreSchema = z.object({
  name: z.string().trim().min(1).max(40),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,40}$/, "Use lowercase letters, numbers and dashes"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean().default(true),
});
