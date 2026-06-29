export const dashboardTabIds = ["listen", "sources", "library"] as const;

export type DashboardTabId = (typeof dashboardTabIds)[number];

export function normalizeDashboardTab(raw: string | null | undefined): DashboardTabId {
  if (
    raw === "listen" ||
    raw === "step-2" ||
    raw === "step-3" ||
    raw === "played-reviewed" ||
    raw === "played-done"
  ) {
    return "listen";
  }
  if (raw === "sources" || raw === "step-1") return "sources";
  if (raw === "library" || raw === "wishlist") return "library";
  return "listen";
}

export function isLegacyDiscoverTab(raw: string | null | undefined) {
  return raw === "discover" || raw === "recommendations";
}

export function dashboardTabHref(tab: DashboardTabId) {
  return tab === "listen" ? "/" : `/?tab=${tab}`;
}

export function toDashboardQueryTab(tab: DashboardTabId) {
  if (tab === "listen") return "step-2";
  if (tab === "sources") return "step-1";
  return "library";
}
