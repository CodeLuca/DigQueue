import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ENCRYPTED_PREFIX = "enc:v1:";
let keyCache: Buffer | null | undefined;

function loadKey() {
  if (keyCache !== undefined) return keyCache;
  const value = env.APP_SECRETS_ENCRYPTION_KEY?.trim();
  if (!value) {
    keyCache = null;
    return keyCache;
  }

  let parsed: Buffer;
  if (/^[0-9a-f]{64}$/i.test(value)) {
    parsed = Buffer.from(value, "hex");
  } else {
    parsed = Buffer.from(value, "base64");
  }

  if (parsed.length !== 32) {
    throw new Error("APP_SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256 key).");
  }

  keyCache = parsed;
  return keyCache;
}

export function hasSecretEncryptionKey() {
  return Boolean(loadKey());
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value && value.startsWith(ENCRYPTED_PREFIX));
}

export function encryptSecret(plaintext: string) {
  const key = loadKey();
  if (!key) {
    throw new Error("Missing APP_SECRETS_ENCRYPTION_KEY; cannot store secrets securely.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptSecret(value: string) {
  const key = loadKey();
  if (!key) {
    throw new Error("Missing APP_SECRETS_ENCRYPTION_KEY; cannot decrypt stored secrets.");
  }

  if (!isEncryptedSecret(value)) {
    return value;
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivBase64, ciphertextBase64, tagBase64] = payload.split(":");
  if (!ivBase64 || !ciphertextBase64 || !tagBase64) {
    throw new Error("Invalid encrypted secret format.");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
