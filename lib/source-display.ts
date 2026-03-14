import { getSourceKindLabel, type SourceKind } from "@/lib/source-kind";

export function getFallbackSourceName(kind: SourceKind, externalDiscogsId: number) {
  return `${getSourceKindLabel(kind)} ${externalDiscogsId}`;
}

export function deriveSourceSlugNameFromDiscogsUrl(discogsUrl: string | null | undefined) {
  const trimmed = (discogsUrl || "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/(?:label|artist)\/\d+-([^/?#]+)/i);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]).replace(/[-_]+/g, " ").trim();
    return slug || null;
  } catch {
    return null;
  }
}

export function resolveSourceDisplayName(input: {
  name?: string | null;
  discogsUrl?: string | null;
  kind: SourceKind;
  externalDiscogsId?: number | null;
}) {
  const trimmedName = (input.name || "").trim();
  if (trimmedName && !/^https?:\/\//i.test(trimmedName)) return trimmedName;

  const slugName = deriveSourceSlugNameFromDiscogsUrl(input.discogsUrl);
  if (slugName) return slugName;

  if (typeof input.externalDiscogsId === "number" && input.externalDiscogsId > 0) {
    return getFallbackSourceName(input.kind, input.externalDiscogsId);
  }

  return input.kind === "artist" ? "Artist source" : "Label source";
}
