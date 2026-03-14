"use client";

export function navigateClientPath(targetPath: string | null | undefined, fallbackPath: string) {
  const target = typeof targetPath === "string" && targetPath.trim().length > 0 ? targetPath : fallbackPath;
  window.location.assign(target);
}
