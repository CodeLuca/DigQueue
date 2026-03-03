export type FailureCategory = "auth" | "rate_limit" | "provider" | "database" | "data" | "unknown";

export function classifySourceFailure(error: string | null | undefined): FailureCategory {
  const value = (error || "").toLowerCase();
  if (!value) return "unknown";
  if (
    value.includes("oauth") ||
    value.includes("token") ||
    value.includes("unauthorized") ||
    value.includes("forbidden") ||
    value.includes("401") ||
    value.includes("403") ||
    value.includes("not connected")
  ) {
    return "auth";
  }
  if (value.includes("rate limit") || value.includes("429") || value.includes("quota")) {
    return "rate_limit";
  }
  if (
    value.includes("database") ||
    value.includes("failed query") ||
    value.includes("maxclientsinsessionmode") ||
    value.includes("too_many_connections") ||
    value.includes("connection") ||
    value.includes("deadlock")
  ) {
    return "database";
  }
  if (
    value.includes("discogs error") ||
    value.includes("youtube") ||
    value.includes("provider") ||
    value.includes("5xx") ||
    value.includes("timeout") ||
    value.includes("network")
  ) {
    return "provider";
  }
  if (
    value.includes("parse") ||
    value.includes("invalid") ||
    value.includes("missing") ||
    value.includes("tracklist")
  ) {
    return "data";
  }
  return "unknown";
}

export function getFailureCategoryMeta(category: FailureCategory) {
  if (category === "auth") {
    return {
      label: "Auth",
      className: "border-amber-500/50 bg-amber-500/12 text-amber-200",
      hint: "Reconnect Discogs directly, then retry.",
      href: "/api/discogs/oauth/start?next=/?tab=step-2",
      hrefLabel: "Reconnect Discogs",
    };
  }
  if (category === "rate_limit") {
    return {
      label: "Rate Limit",
      className: "border-sky-500/50 bg-sky-500/12 text-sky-200",
      hint: "Pause briefly, then run Retry errors.",
      href: "",
      hrefLabel: "",
    };
  }
  if (category === "database") {
    return {
      label: "Database",
      className: "border-rose-500/50 bg-rose-500/12 text-rose-200",
      hint: "Transient DB saturation. Clear stale locks, then retry.",
      href: "",
      hrefLabel: "",
    };
  }
  if (category === "provider") {
    return {
      label: "Provider/API",
      className: "border-fuchsia-500/50 bg-fuchsia-500/12 text-fuchsia-200",
      hint: "Upstream provider response failed. Retry this source.",
      href: "",
      hrefLabel: "",
    };
  }
  if (category === "data") {
    return {
      label: "Data",
      className: "border-indigo-500/50 bg-indigo-500/12 text-indigo-200",
      hint: "Record payload looked malformed. Retry source and refresh metadata.",
      href: "",
      hrefLabel: "",
    };
  }
  return {
    label: "Unknown",
    className: "border-zinc-500/50 bg-zinc-500/12 text-zinc-200",
    hint: "Unclassified failure. Retry source and inspect the source detail page.",
    href: "",
    hrefLabel: "",
  };
}
