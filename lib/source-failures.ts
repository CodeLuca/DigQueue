export type FailureCategory = "auth" | "rate_limit" | "provider" | "database" | "data" | "unknown";
export type FailureProvider = "discogs" | "youtube" | "unknown";
export type FailureSourceKind = "label" | "artist";
export type FailureCategoryMeta = {
  label: string;
  className: string;
  hint: string;
  href: string | null;
  hrefLabel: string | null;
};

export type GroupedSourceFailures<T> = Array<{
  category: FailureCategory;
  items: Array<{ label: T; error: string }>;
}>;

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

export function inferFailureProvider(error: string | null | undefined): FailureProvider {
  const value = (error || "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("youtube") || value.includes("yt")) return "youtube";
  if (value.includes("discogs")) return "discogs";
  return "unknown";
}

export function summarizeFailureProviders<T>(
  items: T[],
  resolveVisibleError: (item: T) => string,
): Record<FailureProvider, number> {
  const summary: Record<FailureProvider, number> = {
    discogs: 0,
    youtube: 0,
    unknown: 0,
  };
  for (const item of items) {
    const provider = inferFailureProvider(resolveVisibleError(item));
    summary[provider] += 1;
  }
  return summary;
}

export function summarizeFailureSourceKinds<T>(
  items: T[],
  resolveKind: (item: T) => FailureSourceKind,
): Record<FailureSourceKind, number> {
  const summary: Record<FailureSourceKind, number> = {
    label: 0,
    artist: 0,
  };
  for (const item of items) {
    summary[resolveKind(item)] += 1;
  }
  return summary;
}

export function getFailureCategoryMeta(category: FailureCategory): FailureCategoryMeta {
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
      hint: "Pause all active sources briefly, then retry this group.",
      href: null,
      hrefLabel: null,
    };
  }
  if (category === "database") {
    return {
      label: "Database",
      className: "border-rose-500/50 bg-rose-500/12 text-rose-200",
      hint: "Transient DB saturation. Clear stale locks, then retry.",
      href: null,
      hrefLabel: null,
    };
  }
  if (category === "provider") {
    return {
      label: "Provider/API",
      className: "border-fuchsia-500/50 bg-fuchsia-500/12 text-fuchsia-200",
      hint: "Upstream provider response failed. Retry this source.",
      href: null,
      hrefLabel: null,
    };
  }
  if (category === "data") {
    return {
      label: "Data",
      className: "border-indigo-500/50 bg-indigo-500/12 text-indigo-200",
      hint: "Record payload looked malformed. Retry source and refresh metadata.",
      href: null,
      hrefLabel: null,
    };
  }
  return {
    label: "Unknown",
    className: "border-zinc-500/50 bg-zinc-500/12 text-zinc-200",
    hint: "Unclassified failure. Retry source and inspect the source detail page.",
    href: null,
    hrefLabel: null,
  };
}

export function groupSourceFailuresByCategory<T>(
  items: T[],
  resolveVisibleError: (item: T) => string,
): GroupedSourceFailures<T> {
  const categoryPriority: Record<FailureCategory, number> = {
    auth: 0,
    database: 1,
    rate_limit: 2,
    provider: 3,
    data: 4,
    unknown: 5,
  };
  const grouped = new Map<FailureCategory, Array<{ label: T; error: string }>>();
  for (const item of items) {
    const visibleError = resolveVisibleError(item) || "Unknown source failure.";
    const category = classifySourceFailure(visibleError);
    const current = grouped.get(category) ?? [];
    current.push({ label: item, error: visibleError });
    grouped.set(category, current);
  }
  return [...grouped.entries()]
    .map(([category, groupedItems]) => ({ category, items: groupedItems }))
    .sort((a, b) => {
      const countDelta = b.items.length - a.items.length;
      if (countDelta !== 0) return countDelta;
      return categoryPriority[a.category] - categoryPriority[b.category];
    });
}
