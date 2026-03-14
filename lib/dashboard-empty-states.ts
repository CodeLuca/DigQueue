import { buildDiscogsConnectPath } from "@/lib/auth-provider-paths";
import type { ListenInboxEmptyState } from "@/lib/listen-inbox-types";

export function getListeningEmptyState(input: {
  discogsConnected: boolean;
  activeSourceCount: number;
  listeningRowCount: number;
}): ListenInboxEmptyState | undefined {
  if (!input.discogsConnected) {
    return {
      title: "Connect Discogs to start listening",
      detail: "DigQueue needs Discogs personal OAuth before it can ingest sources and build the queue.",
      actionHref: buildDiscogsConnectPath("/"),
      actionLabel: "Connect Discogs",
      secondaryActionHref: "/welcome",
      secondaryActionLabel: "Open quick start",
    };
  }

  if (input.activeSourceCount === 0) {
    return {
      title: "Add or resume an active source",
      detail: "Listening Station is empty because no active sources are feeding the queue right now.",
      actionHref: "/?tab=step-1",
      actionLabel: "Open Sources",
      secondaryActionHref: "/how-to-use",
      secondaryActionLabel: "Review setup guide",
    };
  }

  if (input.listeningRowCount === 0) {
    return {
      title: "Run sync to load tracks",
      detail: "Your sources exist, but no playable tracks are loaded yet. Start or resume sync, then come back here.",
      actionHref: "/?tab=step-1",
      actionLabel: "Check source sync",
      secondaryActionHref: "/?tab=step-2",
      secondaryActionLabel: "Open sync status",
    };
  }

  return undefined;
}

export function getLibraryItemsEmptyState(input: {
  discogsConnected: boolean;
  savedCount: number;
  wishlistedRecordCount: number;
}): ListenInboxEmptyState | undefined {
  if (!input.discogsConnected) {
    return {
      title: "Connect Discogs to fill Library",
      detail: "Library imports and wishlist sync depend on Discogs personal OAuth.",
      actionHref: buildDiscogsConnectPath("/"),
      actionLabel: "Connect Discogs",
      secondaryActionHref: "/settings",
      secondaryActionLabel: "Open Settings",
    };
  }

  if (input.savedCount === 0 && input.wishlistedRecordCount === 0) {
    return {
      title: "Library is empty for now",
      detail: "Save tracks while listening or import recent Discogs wants to give Library something to work with.",
      actionHref: "/?tab=step-2",
      actionLabel: "Open Listening Station",
      secondaryActionHref: "/?tab=library",
      secondaryActionLabel: "Stay in Library",
    };
  }

  return undefined;
}

export function getReviewedEmptyState(input: {
  selectedLibraryView: "history" | "reviewed" | "needs-review";
}): ListenInboxEmptyState {
  if (input.selectedLibraryView === "reviewed") {
    return {
      title: "No reviewed tracks yet",
      detail: "Use the single-check or double-check actions while listening, and reviewed items will land here.",
      actionHref: "/?tab=step-2",
      actionLabel: "Start reviewing",
      secondaryActionHref: "/how-to-use",
      secondaryActionLabel: "Review the controls",
    };
  }

  if (input.selectedLibraryView === "needs-review") {
    return {
      title: "Nothing needs review right now",
      detail: "You have cleared the current backlog. Keep listening and come back when more played tracks need a decision.",
      actionHref: "/?tab=step-2",
      actionLabel: "Open Listening Station",
      secondaryActionHref: "/?tab=library&libraryView=history",
      secondaryActionLabel: "Open history",
    };
  }

  return {
    title: "No history yet",
    detail: "Play a few tracks from Listening Station and your play history will show up here.",
    actionHref: "/?tab=step-2",
    actionLabel: "Start listening",
    secondaryActionHref: "/welcome",
    secondaryActionLabel: "Open quick start",
  };
}
