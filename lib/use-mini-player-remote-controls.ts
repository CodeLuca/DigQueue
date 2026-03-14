"use client";

import { useEffect } from "react";

type MediaSessionPlayerItem = {
  track?: {
    title?: string | null;
    artistsText?: string | null;
  } | null;
  release?: {
    title?: string | null;
    artist?: string | null;
    thumbUrl?: string | null;
  } | null;
};

type PlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
};

export function useMiniPlayerRemoteControls<TItem extends MediaSessionPlayerItem>(options: {
  current: TItem | null;
  playing: boolean;
  playerRef: React.RefObject<PlayerLike | null>;
  ensurePlaybackOwnership: () => boolean;
  playPause: () => void;
  nextPlayback: () => void;
  prevPlayback: () => void;
}) {
  const { current, playing, playerRef, ensurePlaybackOwnership, playPause, nextPlayback, prevPlayback } = options;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const mediaSession = navigator.mediaSession;

    if (typeof window !== "undefined" && "MediaMetadata" in window) {
      mediaSession.metadata = current
        ? new MediaMetadata({
            title: current.track?.title || "Now Playing",
            artist: current.track?.artistsText || current.release?.artist || "Unknown artist",
            album: current.release?.title || "",
            artwork: current.release?.thumbUrl
              ? [{ src: current.release.thumbUrl, sizes: "128x128", type: "image/jpeg" }]
              : undefined,
          })
        : null;
    }
    mediaSession.playbackState = playing ? "playing" : "paused";

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions are not supported on all browsers/platforms.
      }
    };

    setHandler("play", () => {
      if (!playerRef.current) return;
      if (!ensurePlaybackOwnership()) return;
      playerRef.current.playVideo();
    });
    setHandler("pause", () => {
      playerRef.current?.pauseVideo();
    });
    setHandler("nexttrack", nextPlayback);
    setHandler("previoustrack", prevPlayback);

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("nexttrack", null);
      setHandler("previoustrack", null);
    };
  }, [current, ensurePlaybackOwnership, nextPlayback, playerRef, playing, prevPlayback]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      const code = event.code;
      const key = event.key;

      if (code === "MediaTrackNext" || key === "MediaTrackNext" || key === "MediaNextTrack" || key === "AudioTrackNext") {
        event.preventDefault();
        nextPlayback();
        return;
      }

      if (code === "MediaTrackPrevious" || key === "MediaTrackPrevious" || key === "MediaPreviousTrack" || key === "AudioTrackPrevious") {
        event.preventDefault();
        prevPlayback();
        return;
      }

      if (
        code === "MediaPlayPause" ||
        key === "MediaPlayPause" ||
        key === "AudioPlay" ||
        key === "AudioPause" ||
        key === "AudioPlayPause"
      ) {
        event.preventDefault();
        playPause();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [nextPlayback, playPause, prevPlayback]);
}
