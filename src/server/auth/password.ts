import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** A valid hash used to equalize timing when the user does not exist. */
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword("auralis-timing-equalizer");
  return dummy;
}
