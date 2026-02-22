"use client";

import { useMemo, useState } from "react";
import { ExternalLink, ListVideo, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  oauthConfigured: boolean;
  youtubeConnected: boolean;
  eligibleSavedCount: number;
  channelTitle?: string | null;
  connectHref: string;
};

type ExportResponse = {
  ok?: boolean;
  error?: string;
  playlistUrl?: string;
  added?: number;
  totalEligible?: number;
  skippedByLimit?: number;
};

export function YoutubePlaylistExportButton(props: Props) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState("DigQueue Saved Tracks");
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("private");

  const helperText = useMemo(() => {
    if (!props.oauthConfigured) return "YouTube export is not configured on this deployment yet.";
    if (!props.youtubeConnected) return "Connect YouTube first. This is separate from how you sign in.";
    if (props.eligibleSavedCount === 0) return "No saved tracks with matched YouTube videos to export yet.";
    return `Exports ${props.eligibleSavedCount} saved track${props.eligibleSavedCount === 1 ? "" : "s"} to a new private playlist.`;
  }, [props.eligibleSavedCount, props.oauthConfigured, props.youtubeConnected]);

  const runExport = async () => {
    setRunning(true);
    setMessage(null);
    setPlaylistUrl(null);
    try {
      const response = await fetch("/api/youtube/playlist/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: playlistTitle, visibility: privacy }),
      });
      const data = (await response.json().catch(() => ({}))) as ExportResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Playlist export failed.");
      }
      setPlaylistUrl(data.playlistUrl || null);
      const skipped = Number(data.skippedByLimit || 0);
      setMessage(
        skipped > 0
          ? `Playlist created with ${data.added ?? 0} tracks. ${skipped} extra tracks were skipped (limit 200).`
          : `Playlist created with ${data.added ?? 0} tracks.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to export playlist.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
          <Youtube className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          YouTube Export
        </p>
        {props.channelTitle ? <p className="text-[11px] text-[var(--color-muted)]">Connected: {props.channelTitle}</p> : null}
      </div>

      <p className="mt-1 text-xs text-[var(--color-muted)]">{helperText}</p>

      {props.youtubeConnected ? (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <label className="md:col-span-3">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">Playlist Title</span>
            <input
              type="text"
              value={playlistTitle}
              onChange={(event) => setPlaylistTitle(event.target.value.slice(0, 140))}
              placeholder="DigQueue Saved Tracks"
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text)]"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">Privacy</span>
            <select
              value={privacy}
              onChange={(event) => setPrivacy(event.target.value as "private" | "unlisted" | "public")}
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text)]"
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!props.youtubeConnected ? (
          <a
            href={props.connectHref}
            className="inline-flex items-center rounded-md border border-[#f2cd8a] bg-[#e7b566] px-3 py-1.5 text-xs font-bold text-black shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c]"
          >
            Connect YouTube
          </a>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => void runExport()}
            disabled={!props.oauthConfigured || props.eligibleSavedCount === 0 || running || !playlistTitle.trim()}
          >
            <ListVideo className="h-3.5 w-3.5" />
            {running ? "Exporting..." : "Export Saved to Playlist"}
          </Button>
        )}

        {playlistUrl ? (
          <a
            href={playlistUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--color-surface)]"
          >
            Open Playlist
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-xs text-[var(--color-muted)]">{message}</p> : null}
    </div>
  );
}
