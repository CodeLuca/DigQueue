export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { parseMutationBody, requireMutationUser } from "@/lib/api-mutation";
import { requireRouteUserId } from "@/lib/app-user";
import { queueNextPostSchema } from "@/lib/queue-next-post";
import { parseQueueNextGetParams } from "@/lib/queue-next-request";
import { advanceQueueForUser, resolveNextQueueItemForUser } from "@/lib/queue-next-service";

export async function GET(request: Request) {
  const auth = await requireRouteUserId();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const { currentId, mode, order } = parseQueueNextGetParams(new URL(request.url));
  const item = await resolveNextQueueItemForUser({
    userId,
    currentId,
    mode,
    order,
  });
  return NextResponse.json(item || null);
}

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "queue/next",
    limit: 120,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, queueNextPostSchema);
  if (parsed.response) return parsed.response;

  const next = await advanceQueueForUser({
    userId,
    currentId: parsed.data.currentId,
    action: parsed.data.action,
    mode: parsed.data.mode,
    order: parsed.data.order,
  });
  return NextResponse.json(next || null);
}
