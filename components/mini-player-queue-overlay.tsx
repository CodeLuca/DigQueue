"use client";

import { X } from "lucide-react";
import { MediaActionRow } from "@/components/media-action-row";

type MiniPlayerQueueOverlayItem = {
  id: number;
  priority?: number | null;
  track?: { title?: string | null } | null;
  release?: { title?: string | null; thumbUrl?: string | null } | null;
  label?: { name?: string | null } | null;
};

export function MiniPlayerQueueOverlay<TItem extends MiniPlayerQueueOverlayItem>({
  items,
  loading,
  error,
  open,
  onClose,
  onPlayNow,
  onRemove,
}: {
  items: TItem[];
  loading: boolean;
  error: string | null;
  open: boolean;
  onClose: () => void;
  onPlayNow: (item: TItem) => void;
  onRemove: (itemId: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-40 mb-2 flex justify-center px-4">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[100vh] bg-black/40" aria-hidden />
      <div className="pointer-events-auto relative z-10 w-full max-w-[900px] rounded-xl border border-[color-mix(in_oklab,var(--color-border)_78%,white_22%)] bg-[color-mix(in_oklab,var(--color-surface2)_88%,black_12%)] shadow-[0_32px_96px_rgba(0,0,0,0.72),0_12px_36px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <p className="text-sm font-semibold">Up Next ({items.length})</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] p-1 hover:bg-[var(--color-surface)]"
            aria-label="Close queue overlay"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[45vh] overflow-y-auto p-2">
          {loading ? <p className="p-2 text-xs text-[var(--color-muted)]">Loading queue…</p> : null}
          {error ? <p className="p-2 text-xs text-rose-300">{error}</p> : null}
          {!loading && items.length === 0 ? <p className="p-2 text-xs text-[var(--color-muted)]">Queue is empty.</p> : null}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                <MediaActionRow
                  size="sm"
                  artworkAlt={`${item.release?.title ?? item.track?.title ?? "Queue item"} artwork`}
                  artworkUrl={item.release?.thumbUrl}
                  title={item.track?.title || item.release?.title || "Untitled"}
                  meta={
                    <>
                      {item.label?.name || "Unknown label"} • {item.release?.title || "Unknown release"}
                    </>
                  }
                  actions={(
                    <div className="flex items-center gap-1.5">
                      {(item.priority ?? 0) > 0 ? (
                        <span className="rounded border border-[var(--color-accent)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">NEXT</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onPlayNow(item)}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase hover:bg-[var(--color-surface)]"
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase hover:bg-[var(--color-surface)]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
