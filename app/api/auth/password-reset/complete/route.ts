export const dynamic = "force-dynamic";

import { z } from "zod";
import { handlePublicMutation } from "@/lib/api-public-mutation";
import { completePasswordReset } from "@/lib/auth-email";

const completeResetSchema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
});

export async function POST(request: Request) {
  return handlePublicMutation(
    request,
    completeResetSchema,
    completePasswordReset,
    "Password update failed.",
  );
}
