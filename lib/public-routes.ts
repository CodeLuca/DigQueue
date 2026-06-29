export const publicPagePaths = [
  "/welcome",
  "/login",
  "/register",
  "/reset-password",
  "/connect-discogs",
  "/directory",
  "/how-to-use",
  "/auth/callback",
  "/auth/confirm",
  "/auth/google/start",
] as const;

export function isPublicPagePath(pathname: string) {
  return publicPagePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
