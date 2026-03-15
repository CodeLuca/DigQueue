"use client";

import { useState } from "react";
import { ResponsiveLabel } from "@/components/responsive-label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addSourceAndDispatchClient } from "@/lib/client-source-intake";
import { useAsyncTaskAction } from "@/lib/use-async-task-action";

export function SourceIntakeForm() {
  const [source, setSource] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const { pending, error, run } = useAsyncTaskAction<[string], Awaited<ReturnType<typeof addSourceAndDispatchClient>>>(
    (trimmed) => addSourceAndDispatchClient({ source: trimmed }),
    {
      mapError: (submitError) => submitError instanceof Error ? submitError.message : "Unable to add source.",
      onSuccess: (result) => {
        setSource("");
        setFeedback(`Queued ${result.entityKind} source - ${result.sourceName}`);
      },
    },
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = source.trim();
    if (!trimmed || pending) return;
    setFeedback(null);
    await run(trimmed);
  };

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="label-input"
          name="source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Paste Discogs URL, ID, or source name"
          required
        />
        <Button type="submit" disabled={pending || source.trim().length === 0}>
          {pending ? "Adding..." : <ResponsiveLabel compact="Add" full="Add Source" />}
        </Button>
      </form>
      {feedback ? <p className="text-xs text-emerald-200">{feedback}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
