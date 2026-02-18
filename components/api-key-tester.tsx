"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type TestResult = {
  discogs: { ok: boolean; message: string };
  youtube: { ok: boolean; message: string };
};

export function ApiKeyTester() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    setLoading(true);
    const response = await fetch("/api/settings/keys/test");
    if (response.ok) {
      setResult((await response.json()) as TestResult);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={() => void run()} disabled={loading}>
        {loading ? "Testing..." : "Test Keys"}
      </Button>
      {result ? (
        <div className="space-y-1 text-xs">
          <p className={result.discogs.ok ? "text-emerald-300" : "text-amber-300"}>Discogs: {result.discogs.message}</p>
          <p className={result.youtube.ok ? "text-emerald-300" : "text-amber-300"}>YouTube: {result.youtube.message}</p>
        </div>
      ) : null}
    </div>
  );
}
