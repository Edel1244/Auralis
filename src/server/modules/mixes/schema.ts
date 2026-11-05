import { z } from "zod";

const db = z.number().min(-40).max(12);
const deckSchema = z.object({
  trackId: z.string().max(40).nullable(),
  tempo: z.number().min(0.5).max(2).default(1),
  keyLock: z.boolean().default(true),
  pitch: z.number().int().min(-12).max(12).default(0),
  volume: z.number().min(0).max(1).default(0.85),
  trim: db.default(0),
  eq: z.object({ low: db, mid: db, high: db }).default({ low: 0, mid: 0, high: 0 }),
  filter: z.number().min(-1).max(1).default(0),
  echo: z.number().min(0).max(1).default(0),
  cue: z.number().min(0).max(36000).default(0),
  hotCues: z.array(z.number().min(0).max(36000).nullable()).max(8).default([]),
});

/** A saved Mixing Studio session: deck setups + mixer state (no audio is stored). */
export const mixDataSchema = z.object({
  version: z.literal(1).default(1),
  crossfader: z.number().min(-1).max(1).default(0),
  master: z.number().min(0).max(1).default(0.9),
  decks: z.object({ a: deckSchema, b: deckSchema }),
});

export const mixSchema = z.object({ title: z.string().trim().min(1).max(100), data: mixDataSchema });
export type MixData = z.infer<typeof mixDataSchema>;
