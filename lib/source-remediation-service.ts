import { and, eq, inArray } from "drizzle-orm";
import type { SourceRemediationAction } from "@/lib/source-action-contract";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { refreshSourceMetadata } from "@/lib/label-metadata";
import { extendRemediationPayload } from "@/lib/remediation-actions";
import { appendRemediationResult, resolveActionNextPath } from "@/lib/remediation-feedback";
import { parsePositiveSourceIds } from "@/lib/source-id-list";
import { toSourceKind } from "@/lib/source-kind";
import { pauseAllActiveSourcesForUser, retryErroredActiveSourcesForUser } from "@/lib/source-batch-actions";
import { buildPauseAndCooldownSourceUpdate } from "@/lib/source-remediation";
import { purgeExpiredWorkerLocks } from "@/lib/worker-locks";

function labelScope(userId: string) {
  return eq(labels.userId, userId);
}

export async function retrySpecificSourcesForUser(userId: string, sourceIds: number[]) {
  const scope = labelScope(userId);
  const targets = await db.query.labels.findMany({
    where: and(inArray(labels.id, sourceIds), eq(labels.active, true), scope),
    columns: { id: true, name: true, status: true },
  });

  const now = new Date();
  let affected = 0;
  for (const source of targets) {
    if (source.status !== "error") continue;
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope));
    affected += 1;
  }

  return { affected, sources: targets };
}

export async function refreshSpecificSourcesMetadataForUser(userId: string, sourceIds: number[]) {
  const scope = labelScope(userId);
  const targets = await db.query.labels.findMany({
    where: and(inArray(labels.id, sourceIds), eq(labels.active, true), scope),
    columns: { id: true, name: true, entityKind: true },
  });

  let affected = 0;
  let failed = 0;
  for (const source of targets) {
    try {
      await refreshSourceMetadata(source.id, toSourceKind(source.entityKind), userId);
      affected += 1;
    } catch {
      failed += 1;
    }
  }

  return { affected, failed, sources: targets };
}

export async function pauseAndClearSpecificSourcesForUser(userId: string, sourceIds: number[]) {
  const scope = labelScope(userId);
  const now = new Date();
  const sources = await db.query.labels.findMany({
    where: and(inArray(labels.id, sourceIds), eq(labels.active, true), scope),
    columns: { id: true, name: true, status: true },
  });

  for (const source of sources) {
    await db
      .update(labels)
      .set(buildPauseAndCooldownSourceUpdate(source.status, now))
      .where(and(eq(labels.id, source.id), scope));
  }

  return { affected: sources.length, sources };
}

export async function clearStaleWorkerLocksForUser() {
  const affected = await purgeExpiredWorkerLocks();
  return { affected };
}

export async function runSourceRemediationActionForUser(input: {
  userId: string;
  action: SourceRemediationAction;
  nextPath?: string;
  category?: string;
  actionLabel?: string;
  scopeLabel?: string;
  sourceIds?: number[];
}) {
  const nextPath = resolveActionNextPath(input.nextPath, "/");
  const category = input.category?.trim() || undefined;
  const sourceIds = parsePositiveSourceIds((input.sourceIds ?? []).join(","), 30);

  if (input.action === "retry_all_errors") {
    const result = await retryErroredActiveSourcesForUser(input.userId);
    return {
      nextPath: appendRemediationResult(
        nextPath,
        extendRemediationPayload(
          {
            action: "clear error flags",
            scope: "all active errored sources",
            affected: result.affected,
            category: category || "all",
          },
          result.sources,
        ),
      ),
      affected: result.affected,
    };
  }

  if (input.action === "retry_specific") {
    const result = await retrySpecificSourcesForUser(input.userId, sourceIds);
    return {
      nextPath: appendRemediationResult(
        nextPath,
        extendRemediationPayload(
          {
            action: "retry",
            scope: "selected failure group",
            affected: result.affected,
            category,
          },
          result.sources,
        ),
      ),
      affected: result.affected,
    };
  }

  if (input.action === "pause_all_active") {
    const result = await pauseAllActiveSourcesForUser(input.userId);
    return {
      nextPath: appendRemediationResult(
        nextPath,
        extendRemediationPayload(
          {
            action: input.actionLabel?.trim() || "pause sources",
            scope: input.scopeLabel?.trim() || "all active sources",
            affected: result.affected,
            category,
          },
          result.sources,
        ),
      ),
      affected: result.affected,
    };
  }

  if (input.action === "pause_and_clear_specific") {
    const result = await pauseAndClearSpecificSourcesForUser(input.userId, sourceIds);
    return {
      nextPath: appendRemediationResult(
        nextPath,
        extendRemediationPayload(
          {
            action: input.actionLabel?.trim() || "cool down + clear errors",
            scope: input.scopeLabel?.trim() || "selected provider-failure group",
            affected: result.affected,
            category,
          },
          result.sources,
        ),
      ),
      affected: result.affected,
    };
  }

  if (input.action === "refresh_specific_metadata") {
    const result = await refreshSpecificSourcesMetadataForUser(input.userId, sourceIds);
    return {
      nextPath: appendRemediationResult(
        nextPath,
        extendRemediationPayload(
          {
            action: "refresh metadata",
            scope: "selected data-failure group",
            affected: result.affected,
            failed: result.failed,
            category,
          },
          result.sources,
        ),
      ),
      affected: result.affected,
      failed: result.failed,
    };
  }

  const result = await clearStaleWorkerLocksForUser();
  return {
    nextPath: appendRemediationResult(nextPath, {
      action: "clear stale locks",
      scope: "expired worker locks",
      affected: result.affected,
      category: category || "database",
      sourceCount: 0,
      sourcePreview: "",
    }),
    affected: result.affected,
  };
}
