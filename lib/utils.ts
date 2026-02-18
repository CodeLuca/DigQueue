import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getVisibleLabelError(error: string | null | undefined) {
  if (!error) return null
  const normalized = error.toLowerCase()
  if (normalized.includes("discogs rate limit retries exhausted")) return null
  return error
}
