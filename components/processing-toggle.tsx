"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProcessingToggle({
  labelId,
  initialActive,
  initialStatus,
  disabled = false,
}: {
  labelId: number;
  initialActive: boolean;
  initialStatus: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runningRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    runningRef.current = initialActive && (initialStatus === "queued" || initialStatus === "processing");
    if (!runningRef.current) return;

    const loop = async () => {
      if (!runningRef.current) return;
      const response = await fetch("/api/worker/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });

      if (response.ok) {
        const data = (await response.json()) as { done?: boolean; message?: string };
        if (data.done) {
          runningRef.current = false;
        } else if (typeof data.message === "string" && data.message.startsWith("Error:")) {
          runningRef.current = false;
        } else if (data.message === "Inactive" || data.message === "Paused") {
          runningRef.current = false;
        }
        router.refresh();
      }

      if (runningRef.current) setTimeout(loop, 1800);
    };

    void loop();
    return () => {
      runningRef.current = false;
    };
  }, [initialActive, initialStatus, labelId, router]);

  const setRemoteActive = async (nextActive: boolean) => {
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/labels/${labelId}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
      if (!response.ok) {
        setErrorMessage(body?.error || "Activation update failed.");
        return;
      }
    } finally {
      setPending(false);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        size="sm"
        variant={initialActive ? "secondary" : "outline"}
        onClick={() => void setRemoteActive(!initialActive)}
        disabled={disabled || pending}
      >
        {pending ? "..." : initialActive ? "Deactivate" : "Activate"}
      </Button>
      {errorMessage ? <p className="text-[11px] text-red-300">{errorMessage}</p> : null}
    </div>
  );
}
