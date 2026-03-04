export function toSourceKind(value: string | null | undefined): "label" | "artist" {
  return value === "artist" ? "artist" : "label";
}
