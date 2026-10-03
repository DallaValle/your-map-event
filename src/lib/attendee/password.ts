import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

const KEY_LENGTH = 64;

function derive(password: string, salt: BinaryLike) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$<salt>$<key>" in hex, so the format can change without a migration. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = await derive(password, Buffer.from(salt, "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Compared against on unknown emails so a miss costs as long as a wrong password.
export const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(KEY_LENGTH * 2)}`;
