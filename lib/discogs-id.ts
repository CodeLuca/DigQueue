import { createHash } from "node:crypto";

const SCOPE_BASE = 1_000_000_000;

function getNamespace(userId: string, kind: "label" | "release") {
  const digest = createHash("sha256").update(`${kind}:${userId}`).digest("hex");
  const raw = Number.parseInt(digest.slice(0, 6), 16);
  const bounded = Number.isFinite(raw) ? raw % 900_000 : 1;
  return bounded + 1;
}

export function toStoredDiscogsId(userId: string, externalDiscogsId: number, kind: "label" | "release") {
  if (!Number.isFinite(externalDiscogsId) || externalDiscogsId <= 0) return externalDiscogsId;
  const namespace = getNamespace(userId, kind);
  return namespace * SCOPE_BASE + Math.floor(externalDiscogsId);
}

export function toExternalDiscogsId(storedOrExternalId: number) {
  if (!Number.isFinite(storedOrExternalId) || storedOrExternalId <= 0) return storedOrExternalId;
  return storedOrExternalId >= SCOPE_BASE ? storedOrExternalId % SCOPE_BASE : storedOrExternalId;
}

