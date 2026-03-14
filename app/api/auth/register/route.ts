export const dynamic = "force-dynamic";

import { z } from "zod";
import { handlePublicMutation } from "@/lib/api-public-mutation";
import { registerWithPassword } from "@/lib/auth-email";

const registerSchema = z.object({
  email: z.string().trim(),
  password: z.string(),
  confirmPassword: z.string(),
  next: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  return handlePublicMutation(request, registerSchema, registerWithPassword, "Registration failed.");
}
