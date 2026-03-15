"use client";

import { AccountActionButton } from "@/components/account-action-button";
import { useIntegrationDisconnectAction } from "@/lib/use-account-settings-actions";

export function IntegrationDisconnectButton({
  provider,
  label,
  confirmMessage,
  className,
}: {
  provider: "discogs" | "youtube";
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  const { pending, run } = useIntegrationDisconnectAction(provider);

  return (
    <AccountActionButton
      variant="outline"
      className={className}
      pending={pending}
      pendingChildren="Disconnecting..."
      onClick={() => void run(confirmMessage)}
      title={label}
    >
      {label}
    </AccountActionButton>
  );
}
