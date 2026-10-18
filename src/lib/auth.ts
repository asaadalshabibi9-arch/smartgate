import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";
export const rolePath = {
  company_admin: "company",
  driver: "driver",
  gate_operator: "operator",
  demo_admin: "simulation",
} as const;

export const getIdentity = cache(async () => {
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", data.claims.sub)
    .maybeSingle();
  if (profileError) throw new Error("Profile lookup failed");
  return { db, profile, userId: data.claims.sub };
});
export async function requireIdentity(locale: Locale) {
  const identity = await getIdentity();
  if (!identity) redirect(`/${locale}/login`);
  if (!identity.profile) redirect(`/${locale}/login?error=noProfile`);
  return { ...identity, profile: identity.profile };
}
