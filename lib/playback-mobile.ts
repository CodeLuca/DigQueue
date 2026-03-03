export function isIOSLikeDevice(input: {
  userAgent?: string | null;
  platform?: string | null;
  maxTouchPoints?: number | null;
}) {
  const ua = input.userAgent || "";
  const platform = input.platform || "";
  const maxTouchPoints = Number.isFinite(input.maxTouchPoints) ? Number(input.maxTouchPoints) : 0;
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function buildYouTubeHandoffTargets(videoId: string, isIOS: boolean) {
  const trimmed = (videoId || "").trim();
  if (!trimmed) return null;
  const encodedVideoId = encodeURIComponent(trimmed);
  const watchUrl = `https://www.youtube.com/watch?v=${encodedVideoId}`;
  if (!isIOS) {
    return {
      primaryUrl: watchUrl,
      fallbackUrl: null,
      needsDeepLinkFallback: false,
    };
  }
  return {
    primaryUrl: `youtube://www.youtube.com/watch?v=${encodedVideoId}`,
    fallbackUrl: watchUrl,
    needsDeepLinkFallback: true,
  };
}
