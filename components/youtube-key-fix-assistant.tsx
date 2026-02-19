"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "digqueue_gcp_project";

export function YoutubeKeyFixAssistant() {
  const [projectId, setProjectId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "";
  });

  const normalizedProjectId = projectId.trim();
  const projectQuery = normalizedProjectId ? `?project=${encodeURIComponent(normalizedProjectId)}` : "";

  const links = useMemo(
    () => ({
      enableApi: `https://console.cloud.google.com/apis/library/youtube.googleapis.com${projectQuery}`,
      apiRestrictions: `https://console.cloud.google.com/apis/credentials${projectQuery}`,
      apiDashboard: `https://console.cloud.google.com/apis/dashboard${projectQuery}`,
      quotaPage: `https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas${projectQuery}`,
    }),
    [projectQuery],
  );

  const onProjectChange = (value: string) => {
    setProjectId(value);
    window.localStorage.setItem(STORAGE_KEY, value.trim());
  };

  return (
    <div id="youtube-fix" className="rounded-md border border-[var(--color-border)] p-3">
      <p className="mb-2 font-medium">YouTube Block Fix Assistant</p>
      <p className="mb-2 text-xs text-[var(--color-muted)]">
        Paste your Google Cloud project ID/number once, then use the 4 buttons in order.
      </p>
      <Input
        value={projectId}
        onChange={(event) => onProjectChange(event.target.value)}
        placeholder="Google Cloud project ID or number (optional but recommended)"
      />
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a href={links.enableApi} target="_blank" rel="noreferrer">
          <Button type="button" size="sm" className="w-full">1) Enable YouTube API</Button>
        </a>
        <a href={links.apiRestrictions} target="_blank" rel="noreferrer">
          <Button type="button" size="sm" variant="secondary" className="w-full">2) Open Credentials</Button>
        </a>
        <a href={links.apiDashboard} target="_blank" rel="noreferrer">
          <Button type="button" size="sm" variant="outline" className="w-full">3) API Dashboard</Button>
        </a>
        <a href={links.quotaPage} target="_blank" rel="noreferrer">
          <Button type="button" size="sm" variant="outline" className="w-full">4) Check Quota</Button>
        </a>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-[var(--color-muted)]">
        <li>Enable YouTube Data API v3 for this project.</li>
        <li>In Credentials, edit your API key and set API restrictions to include YouTube Data API v3.</li>
        <li>Save restrictions, then return to DigQueue Settings.</li>
        <li>Click Test Keys to confirm.</li>
      </ol>
    </div>
  );
}
