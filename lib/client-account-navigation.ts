"use client";

import { navigateClientPath } from "@/lib/client-navigation";

export function navigateClientAccountRedirect(redirectTo: string | null | undefined, fallbackPath: string) {
  navigateClientPath(redirectTo, fallbackPath);
}
