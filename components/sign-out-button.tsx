"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { useSignOutAction } from "@/lib/use-account-settings-actions";

export function SignOutButton() {
  const { pending, run } = useSignOutAction();

  return (
    <MutationActionButton
      preset="account"
      variant="outline"
      className="w-full px-3 py-1.5 text-xs sm:w-auto"
      pending={pending}
      pendingChildren="Signing out..."
      onClick={() => void run()}
      title="Sign out"
    >
      Sign Out
    </MutationActionButton>
  );
}
