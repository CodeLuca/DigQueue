"use client";

import { AccountActionButton } from "@/components/account-action-button";
import { useSignOutAction } from "@/lib/use-account-settings-actions";

export function SignOutButton() {
  const { pending, run } = useSignOutAction();

  return (
    <AccountActionButton
      variant="outline"
      className="px-3 py-1.5 text-xs"
      mobileFullWidth
      pending={pending}
      pendingChildren="Signing out..."
      onClick={() => void run()}
      title="Sign out"
    >
      Sign Out
    </AccountActionButton>
  );
}
