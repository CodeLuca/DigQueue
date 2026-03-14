export type SourceKind = "label" | "artist";

export function toSourceKind(value: string | null | undefined): SourceKind {
  return value === "artist" ? "artist" : "label";
}

export function getSourceKindLabel(value: string | null | undefined) {
  return toSourceKind(value) === "artist" ? "Artist" : "Label";
}
