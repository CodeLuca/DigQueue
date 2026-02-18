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
  const [active, setActive] = useState(initialActive);
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    runningRef.current = active && status !== "complete";
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
          setStatus("complete");
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
  }, [active, labelId, status, router]);

  const setRemoteActive = async (nextActive: boolean) => {
    setPending(true);
    const response = await fetch(`/api/labels/${labelId}/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (response.ok) {
      const data = (await response.json()) as { active: boolean; status: string };
      setActive(data.active);
      setStatus(data.status);
    }
    setPending(false);
    router.refresh();
  };

  return (
    <Button
      size="sm"
      variant={active ? "secondary" : "outline"}
      onClick={() => void setRemoteActive(!active)}
      disabled={disabled || pending}
    >
      {pending ? "..." : active ? "Deactivate" : "Activate"}
    </Button>
  );
}
