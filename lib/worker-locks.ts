import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const DEFAULT_LEASE_MS = 120_000;

type SourceLock = {
  lockKey: string;
  leaseToken: string;
};

export async function acquireSourceWorkerLock(userId: string, sourceId: number, leaseMs = DEFAULT_LEASE_MS): Promise<SourceLock | null> {
  const now = Date.now();
  const leaseToken = randomUUID();
  const lockKey = `${userId}:${sourceId}`;
  const lockedUntil = now + leaseMs;

  const result = await db.execute(sql`
    insert into worker_locks (lock_key, user_id, source_id, lease_token, locked_until, updated_at)
    values (${lockKey}, ${userId}::uuid, ${sourceId}, ${leaseToken}, ${lockedUntil}, ${now})
    on conflict (lock_key)
    do update set
      user_id = excluded.user_id,
      source_id = excluded.source_id,
      lease_token = excluded.lease_token,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
    where worker_locks.locked_until < ${now}
    returning lock_key, lease_token
  `);

  if (result.length === 0) return null;
  return {
    lockKey: String(result[0].lock_key),
    leaseToken: String(result[0].lease_token),
  };
}

export async function releaseSourceWorkerLock(lock: SourceLock) {
  await db.execute(sql`
    delete from worker_locks
    where lock_key = ${lock.lockKey}
      and lease_token = ${lock.leaseToken}
  `);
}

export async function purgeExpiredWorkerLocks() {
  const now = Date.now();
  await db.execute(sql`delete from worker_locks where locked_until < ${now}`);
}
