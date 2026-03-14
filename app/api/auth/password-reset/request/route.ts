export const dynamic = "force-dynamic";

import { z } from "zod";
import { handlePublicMutation } from "@/lib/api-public-mutation";
import { requestPasswordReset } from "@/lib/auth-email";

const requestResetSchema = z.object({
  email: z.string().trim(),
});

export async function POST(request: Request) {
  return handlePublicMutation(
    request,
    requestResetSchema,
    requestPasswordReset,
    "Password reset request failed.",
  );
}
