import "server-only";
import { cache } from "react";
import { requireIdentity } from "./auth";
import type { Locale } from "./i18n";
import type { Tables } from "@/types/database";

export const administratorAllowed = cache(async (locale: Locale) => {
  const { db } = await requireIdentity(locale);
  const { data, error } = await db.rpc("is_platform_administrator");
  // An unapplied migration never grants administrative access.
  return !error && data === true;
});
export type AdministrationData = {
  companies: Tables<"companies">[];
  profiles: (Tables<"profiles"> & { email: string })[];
  trucks: Tables<"trucks">[];
  gates: Tables<"gates">[];
  assignments: { profile_id: string; gate_id: string }[];
  audit: { command: string; occurred_at: string; actor_user_id: string }[];
};
