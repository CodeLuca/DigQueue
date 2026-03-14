"use client";

import type { MouseEvent } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { FormSubmitButtonProps } from "@/components/form-submit-button";

type ConfirmedFormButtonProps = FormSubmitButtonProps & {
  confirmMessage: string;
};

export function ConfirmedFormButton({ confirmMessage, onClick, ...props }: ConfirmedFormButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return <FormSubmitButton {...props} onClick={handleClick} />;
}
