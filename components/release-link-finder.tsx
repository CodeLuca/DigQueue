"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Candidate = {
  provider: string;
  url: string;
  title: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reason: string;
};

type FinderPayload = {
  bandcamp: Candidate[];
  fallback: Candidate[];
  bestBandcamp: Candidate | null;
};

function confidenceClass(confidence: Candidate["confidence"]) {
  if (confidence === "high") return "text-emerald-300";
  if (confidence === "medium") return "text-amber-300";
  return "text-[var(--color-muted)]";
}

export function ReleaseLinkFinder({ releaseId }: { releaseId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinderPayload | null>(null);

  const runFinder = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/finder/release/${releaseId}`);
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Could not find links");
      }
      const payload = (await response.json()) as FinderPayload;
      setResult(payload);
    } catch (finderError) {
      setError(finderError instanceof Error ? finderError.message : "Could not find links");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Best Buy Link Finder</CardTitle>
        <Button type="button" variant="secondary" onClick={() => void runFinder()} disabled={loading}>
          {loading ? "Searching..." : "Find Best Links"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-[var(--color-muted)]">
          Bandcamp-first ranked matching for obscure records, with store fallbacks when no high-confidence result appears.
        </p>
        {error ? <p className="text-red-300">{error}</p> : null}

        {result?.bestBandcamp ? (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Best Bandcamp Match</p>
            <a className="block text-sm font-medium text-[var(--color-accent)] hover:underline" href={result.bestBandcamp.url} target="_blank" rel="noreferrer">
              {result.bestBandcamp.title}
            </a>
            <p className={`text-xs ${confidenceClass(result.bestBandcamp.confidence)}`}>
              Confidence: {result.bestBandcamp.confidence} • {result.bestBandcamp.reason}
            </p>
          </div>
        ) : null}

        {result?.bandcamp?.length ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Bandcamp Candidates</p>
            {result.bandcamp.map((item) => (
              <div key={item.url} className="rounded-md border border-[var(--color-border)] p-2">
                <div className="min-w-0">
                  <a href={item.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-[var(--color-accent)] hover:underline">{item.title}</a>
                  <p className={`text-xs ${confidenceClass(item.confidence)}`}>{item.confidence} • score {item.score}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {result?.fallback?.length ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Fallback Stores</p>
            {result.fallback.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-surface2)]"
              >
                {item.title}
              </a>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
