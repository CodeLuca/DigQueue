const BPM_MIN = 60;
const BPM_MAX = 220;

function toValidBpm(value: number) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < BPM_MIN || rounded > BPM_MAX) return null;
  return rounded;
}

export function parseBpmFromText(input: string | null | undefined) {
  const text = (input || "").trim();
  if (!text) return null;

  const patterns = [
    /(?:^|[\s([{-])([6-9]\d|1\d\d|2[0-2]\d)\s*bpm(?:\b|[\s)\]}-])/i,
    /(?:^|[\s([{-])bpm[\s:=-]*([6-9]\d|1\d\d|2[0-2]\d)(?:\b|[\s)\]}-])/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number(match[1]);
    const bpm = toValidBpm(parsed);
    if (bpm) return bpm;
  }

  return null;
}

export function parseBpmFromTexts(inputs: Array<string | null | undefined>) {
  for (const input of inputs) {
    const bpm = parseBpmFromText(input);
    if (bpm) return bpm;
  }
  return null;
}
