import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getVisibleLabelError(error: string | null | undefined) {
  if (!error) return null
  const normalized = error.toLowerCase()
  if (normalized.includes("discogs rate limit retries exhausted")) return null
  if (normalized.includes("maxclientsinsessionmode")) return "Database is temporarily overloaded. Use Reload tracks to retry."
  if (normalized.includes("failed query:")) return "Temporary database failure. Use Reload tracks to retry."
  return error
}
