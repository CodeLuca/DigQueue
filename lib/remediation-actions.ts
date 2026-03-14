import type { RemediationFeedbackPayload } from "@/lib/remediation-feedback";

type SourceSummaryRow = {
  id: number;
  name: string | null | undefined;
};

export function getRemediationSourceDisplayName(source: SourceSummaryRow) {
  const trimmed = String(source.name || "").trim();
  return trimmed || `Source ${source.id}`;
}

export function buildRemediationTargetSummary(sources: SourceSummaryRow[]) {
  const names = sources.map(getRemediationSourceDisplayName);
  const preview = names.slice(0, 3).join(", ");
  return {
    sourceCount: names.length,
    sourcePreview: names.length > 3 ? `${preview}, +${names.length - 3} more` : preview,
  };
}

export function extendRemediationPayload(
  payload: Omit<RemediationFeedbackPayload, "sourceCount" | "sourcePreview">,
  sources: SourceSummaryRow[],
): RemediationFeedbackPayload {
  const summary = buildRemediationTargetSummary(sources);
  return {
    ...payload,
    sourceCount: summary.sourceCount,
    sourcePreview: summary.sourcePreview,
  };
}
