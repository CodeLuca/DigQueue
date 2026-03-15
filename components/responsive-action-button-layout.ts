export function responsiveActionButtonLayout({
  compact = false,
  fullSpan = false,
}: {
  compact?: boolean;
  fullSpan?: boolean;
}) {
  if (compact) {
    return fullSpan ? "col-span-2 w-full justify-center" : "w-full justify-center";
  }

  return fullSpan
    ? "col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
    : "w-full justify-center sm:w-auto sm:justify-start";
}

export function responsiveActionWidthClassName() {
  return "w-full sm:w-auto";
}
