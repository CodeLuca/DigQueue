type NormalizeNextPathOptions = {
  fallback: string;
  blockAuthEntrypoints?: boolean;
};

export function normalizeNextPath(value: unknown, options: NormalizeNextPathOptions) {
  const fallback = options.fallback;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (options.blockAuthEntrypoints) {
    if (/^\/auth(\/|$)/.test(raw)) return fallback;
    if (/^\/login(\/|$|\?)/.test(raw)) return fallback;
    if (/^\/register(\/|$|\?)/.test(raw)) return fallback;
  }
  return raw;
}
