"use client";

import type { FormEvent } from "react";
import { deleteLabelAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LabelDeleteButton({ labelId, labelName }: { labelId: number; labelName: string }) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const confirmed = window.confirm(`Delete label "${labelName}"? This also removes its releases, tracks, and queue items.`);
    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <form action={deleteLabelAction} onSubmit={onSubmit}>
      <input type="hidden" name="labelId" value={labelId} />
      <Button type="submit" size="sm" variant="destructive">Delete</Button>
    </form>
  );
}
