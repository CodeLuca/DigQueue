export const dynamic = "force-dynamic";

import { runUserJsonRoute } from "@/lib/api-user-route";
import { upNext } from "@/lib/processing";

export async function GET(request: Request) {
  return runUserJsonRoute(
    async (userId) => {
      const rawLimit = new URL(request.url).searchParams.get("limit");
      const parsedLimit = rawLimit ? Number(rawLimit) : 24;
      const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(60, Math.floor(parsedLimit))) : 24;
      const items = await upNext(userId, limit);
      return { items };
    },
    { errorMessage: "Unable to load queue list." },
  );
}
