import { z } from "zod";

export const queueNextPostSchema = z.object({
  currentId: z.number().optional(),
  action: z.enum(["next", "played", "listened"]).optional(),
  mode: z.enum(["track", "release", "hybrid"]).optional(),
  order: z.enum(["in_order", "shuffle"]).optional(),
});

export function parseQueueNextPostBody(payload: unknown) {
  return queueNextPostSchema.safeParse(payload);
}
