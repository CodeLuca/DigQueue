import { cn } from "@/lib/utils";

export function SourceSyncHealthAlert({
  severity,
  summary,
}: {
  severity: "critical" | "warning";
  summary: string;
}) {
  return (
    <div
      className={cn(
        "rounded border px-2 py-1 text-[10px]",
        severity === "critical"
          ? "border-rose-500/50 bg-rose-500/12 text-rose-100"
          : "border-amber-500/50 bg-amber-500/12 text-amber-100",
      )}
    >
      {summary}
    </div>
  );
}
