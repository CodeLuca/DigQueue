import { parseDiscogsReleaseIdFromUrl } from "@/lib/discogs-release-id";

export function matchesExternalDiscogsReleaseId(discogsUrl: string | null | undefined, externalDiscogsReleaseId: number) {
  const parsed = parseDiscogsReleaseIdFromUrl(discogsUrl);
  return parsed === externalDiscogsReleaseId;
}
