export const dynamic = "force-dynamic";

import { z } from "zod";
import { handlePublicMutation } from "@/lib/api-public-mutation";
import { loginWithPassword } from "@/lib/auth-email";

const loginSchema = z.object({
  email: z.string().trim(),
  password: z.string(),
  next: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  return handlePublicMutation(request, loginSchema, loginWithPassword, "Login failed.");
}
