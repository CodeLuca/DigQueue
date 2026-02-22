"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProcessingToggle({
  labelId,
  initialActive,
  disabled = false,
}: {
  labelId: number;
  initialActive: boolean;
  initialStatus?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

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
        title={initialActive ? "Deactivate label and pause ingestion" : "Activate label and enqueue ingestion"}
      >
        {pending ? "..." : initialActive ? "Deactivate" : "Activate + Queue"}
      </Button>
      {errorMessage ? <p className="text-[11px] text-red-300">{errorMessage}</p> : null}
    </div>
  );
}
