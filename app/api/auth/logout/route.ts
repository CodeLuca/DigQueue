export const dynamic = "force-dynamic";

import { okJson } from "@/lib/api-response";
import { clearCurrentSession } from "@/lib/auth-email";

export async function POST() {
  return okJson(await clearCurrentSession());
}
