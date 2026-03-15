"use client";

import { useMemo, useState } from "react";
import { ActionLink } from "@/components/action-link";
import { InstructionList } from "@/components/instruction-list";
import { SupportPanel } from "@/components/support-panel";
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
    <SupportPanel
      id="youtube-fix"
      title="YouTube Block Fix Assistant"
      description="Paste your Google Cloud project ID or number once, then use the four links in order."
    >
      <Input
        value={projectId}
        onChange={(event) => onProjectChange(event.target.value)}
        placeholder="Google Cloud project ID or number (optional but recommended)"
      />
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ActionLink href={links.enableApi} target="_blank" rel="noreferrer" className="w-full px-3 py-2 text-xs">
          1. Enable YouTube API
        </ActionLink>
        <ActionLink href={links.apiRestrictions} target="_blank" rel="noreferrer" className="w-full px-3 py-2 text-xs">
          2. Open Credentials
        </ActionLink>
        <ActionLink href={links.apiDashboard} target="_blank" rel="noreferrer" className="w-full px-3 py-2 text-xs">
          3. API Dashboard
        </ActionLink>
        <ActionLink href={links.quotaPage} target="_blank" rel="noreferrer" className="w-full px-3 py-2 text-xs">
          4. Check Quota
        </ActionLink>
      </div>
      <InstructionList
        className="mt-3"
        items={[
          "Enable YouTube Data API v3 for this project.",
          "In Credentials, edit your API key and set API restrictions to include YouTube Data API v3.",
          "Save restrictions, then return to DigQueue Settings.",
          "Click Test Keys to confirm.",
        ]}
      />
    </SupportPanel>
  );
}
