export function isIdempotentFeedbackEvent(eventType: string) {
  return eventType === "dismiss";
}
