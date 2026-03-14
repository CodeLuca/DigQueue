import { toSourceKind } from "@/lib/source-kind";

type ExistingSourceIdentity = {
  entityKind: string | null | undefined;
  name: string;
};

export function resolveNumericSourceIdentity(
  matches: ExistingSourceIdentity[],
): { entityKind: "label" | "artist"; name: string } | null | "ambiguous" {
  const normalized = matches
    .map((match) => ({
      entityKind: toSourceKind(match.entityKind),
      name: match.name,
    }))
    .filter((match, index, all) => all.findIndex((item) => item.entityKind === match.entityKind) === index);

  if (normalized.length === 0) return null;
  if (normalized.length > 1) return "ambiguous";
  return normalized[0] ?? null;
}
