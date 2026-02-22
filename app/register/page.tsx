import { redirect } from "next/navigation";

export default async function RegisterRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; error?: string; notice?: string }>;
}) {
  const { next, email, error, notice } = await searchParams;
  const qs = new URLSearchParams();
  qs.set("mode", "register");
  if (typeof next === "string") qs.set("next", next);
  if (typeof email === "string") qs.set("email", email);
  if (typeof error === "string") qs.set("error", error);
  if (typeof notice === "string") qs.set("notice", notice);
  redirect(`/login?${qs.toString()}`);
}
