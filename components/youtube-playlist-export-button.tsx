"use client";
import { useMemo, useState } from "react";
import { ExternalLink, ListVideo, Youtube } from "lucide-react";
import { ExternalActionLink } from "@/components/external-action-link";
import { HighlightActionLink } from "@/components/highlight-action";
import { MutationActionButton } from "@/components/mutation-action-button";
import { buildYoutubeOAuthStartPath } from "@/lib/auth-provider-paths";
import { useYoutubePlaylistExportAction } from "@/lib/use-account-settings-actions";

type Props = {
  oauthConfigured: boolean;
  youtubeConnected: boolean;
  eligibleSavedCount: number;
  channelTitle?: string | null;
  connectNextPath?: string | null;
};

export function YoutubePlaylistExportButton(props: Props) {
  const { pending, error, result, playlistUrl, run } = useYoutubePlaylistExportAction();
  const [playlistTitle, setPlaylistTitle] = useState("DigQueue Saved Tracks");
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">("private");

  const helperText = useMemo(() => {
    if (!props.oauthConfigured) return "YouTube export is not configured on this deployment yet.";
    if (!props.youtubeConnected) return "Connect YouTube first. This is separate from how you sign in.";
    if (props.eligibleSavedCount === 0) return "No saved tracks with matched YouTube videos to export yet.";
    return `Exports ${props.eligibleSavedCount} saved track${props.eligibleSavedCount === 1 ? "" : "s"} to a new private playlist.`;
  }, [props.eligibleSavedCount, props.oauthConfigured, props.youtubeConnected]);

  const runExport = async () => {
    await run({ title: playlistTitle, visibility: privacy });
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
          <HighlightActionLink
            href={buildYoutubeOAuthStartPath(props.connectNextPath)}
            size="sm"
            weight="bold"
          >
            Connect YouTube
          </HighlightActionLink>
        ) : (
          <MutationActionButton
            preset="account"
            size="sm"
            className="h-8"
            pending={pending}
            pendingChildren={
              <>
                <ListVideo className="h-3.5 w-3.5" />
                Exporting...
              </>
            }
            disabled={!props.oauthConfigured || props.eligibleSavedCount === 0 || !playlistTitle.trim()}
            onClick={() => void runExport()}
            title="Export saved tracks to a new YouTube playlist"
            error={error}
            message={result}
          >
            <ListVideo className="h-3.5 w-3.5" />
            Export Saved to Playlist
          </MutationActionButton>
        )}

        {playlistUrl ? (
          <ExternalActionLink
            href={playlistUrl}
            variant="compactButton"
            title="Open exported YouTube playlist"
          >
            Open Playlist
            <ExternalLink className="h-3 w-3" />
          </ExternalActionLink>
        ) : null}
      </div>
    </div>
  );
}
