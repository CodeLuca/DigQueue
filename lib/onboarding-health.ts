import { buildDiscogsConnectPath } from "@/lib/auth-provider-paths";

export type OnboardingHealthAction = {
  href: string;
  label: string;
};

export type OnboardingHealth = {
  tone: "blocked" | "attention" | "ready";
  label: string;
  title: string;
  summary: string;
  nextSteps: OnboardingHealthAction[];
  optionalStep: OnboardingHealthAction | null;
};

export function buildOnboardingHealth(input: {
  discogsConnected: boolean;
  youtubeOAuthConfigured: boolean;
  youtubeOAuthConnected: boolean;
  sourceCount: number;
  activeSourceCount: number;
  erroredSourceCount: number;
  queueCount: number;
}): OnboardingHealth {
  const optionalStep =
    input.youtubeOAuthConfigured && !input.youtubeOAuthConnected
      ? { href: "/settings", label: "Connect YouTube for playlist export" }
      : null;

  if (!input.discogsConnected) {
    return {
      tone: "blocked",
      label: "Blocked",
      title: "Connect Discogs first",
      summary: "DigQueue cannot ingest sources or sync wishlist data until Discogs personal OAuth is connected.",
      nextSteps: [
        { href: "/settings", label: "Open Settings" },
        { href: buildDiscogsConnectPath("/settings"), label: "Start Discogs connect" },
      ],
      optionalStep,
    };
  }

  if (input.sourceCount === 0) {
    return {
      tone: "attention",
      label: "Next step",
      title: "Add your first sources",
      summary: "Discogs is connected, but there are no label or artist sources yet. Start with 1-3 focused sources.",
      nextSteps: [
        { href: "/?tab=step-1", label: "Open Sources" },
        { href: "/welcome", label: "Review quick start" },
      ],
      optionalStep,
    };
  }

  if (input.activeSourceCount === 0) {
    return {
      tone: "attention",
      label: "Action needed",
      title: "All sources are paused",
      summary: "Sources exist, but none are active, so no new queue items will be generated until you resume one.",
      nextSteps: [
        { href: "/?tab=step-1", label: "Resume a source" },
        { href: "/?tab=step-2", label: "Open sync status" },
      ],
      optionalStep,
    };
  }

  if (input.erroredSourceCount > 0) {
    return {
      tone: "attention",
      label: "Attention",
      title: `${input.erroredSourceCount} source${input.erroredSourceCount === 1 ? " needs" : "s need"} attention`,
      summary: "Your pipeline is live, but at least one active source is failing. Clear or pause the broken source before errors pile up.",
      nextSteps: [
        { href: "/?tab=step-2", label: "Open Failure Center" },
        { href: "/?tab=step-1", label: "Review sources" },
      ],
      optionalStep,
    };
  }

  if (input.queueCount === 0) {
    return {
      tone: "attention",
      label: "Next step",
      title: "Run sync to fill the queue",
      summary: "Your sources are connected and active, but there are no queue-ready items right now.",
      nextSteps: [
        { href: "/?tab=step-2", label: "Open Listening Station" },
        { href: "/?tab=step-1", label: "Check source progress" },
      ],
      optionalStep,
    };
  }

  return {
    tone: "ready",
    label: "Ready",
    title: "System ready to dig",
    summary: "Discogs is connected, active sources are healthy, and the queue has playable items. Keep reviewing tracks and trim weak sources as needed.",
    nextSteps: [
      { href: "/?tab=step-2", label: "Open Listening Station" },
      { href: "/?tab=library", label: "Review Library" },
    ],
    optionalStep,
  };
}
