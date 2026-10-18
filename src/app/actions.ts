"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireIdentity, rolePath } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
import { muscatToISO, tripSchema } from "@/lib/domain/journey";
import type { Json } from "@/types/database";

export type FormState = {
  error?: string;
  fields?: string[];
  success?: boolean;
};
const knownErrors = [
  "forbidden",
  "invalid_input",
  "invalid_transition",
  "invalid_membership",
  "ineligible_gate",
  "recommendation_changed",
  "outside_appointment",
  "missing_telemetry",
  "simulation_only",
  "idempotency_conflict",
];
function failure(error?: { message: string } | null): FormState {
  return {
    error:
      knownErrors.find((code) => error?.message.includes(code)) ??
      "actionError",
  };
}
export async function loginAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  try {
    const db = await createClient();
    const { error } = await db.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) return { error: "loginError" };
  } catch {
    return { error: "loginError" };
  }
  redirect(`/${locale}`);
}
export async function logoutAction(form: FormData) {
  const locale = localeOf(String(form.get("locale")));
  const db = await createClient();
  await db.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}
export async function createTripAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  const { db, profile } = await requireIdentity(locale);
  if (profile.role !== "company_admin") return { error: "forbidden" };
  let tripId: string | null = null;
  try {
    const input = Object.fromEntries(form.entries());
    const result = tripSchema.safeParse({
      ...input,
      planned_departure_at: muscatToISO(String(input.planned_departure_at)),
      appointment_start_at: muscatToISO(String(input.appointment_start_at)),
      appointment_end_at: muscatToISO(String(input.appointment_end_at)),
    });
    if (!result.success)
      return {
        error: "invalid_input",
        fields: result.error.issues.map((x) => String(x.path[0])),
      };
    const key = z.uuid().safeParse(form.get("operation_key"));
    if (!key.success) return { error: "invalid_input" };
    const { data, error } = await db.rpc("create_entry_trip", {
      p_input: result.data,
      p_key: key.data,
    });
    if (error) return failure(error);
    tripId = data;
  } catch {
    return failure();
  }
  revalidatePath("/[locale]", "layout");
  redirect(`/${locale}/trips/${tripId}`);
}
export async function tripCommandAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  const { db } = await requireIdentity(locale);
  try {
    const trip = z.uuid().parse(form.get("trip_id"));
    const key = z.uuid().parse(form.get("operation_key"));
    const payload: Record<string, Json> = {};
    for (const field of ["qr", "plate", "container", "gate_id", "recipient"])
      if (form.has(field)) payload[field] = String(form.get(field));
    const { error } = await db.rpc("apply_trip_command", {
      p_trip: trip,
      p_command: String(form.get("command")),
      p_payload: payload,
      p_key: key,
    });
    if (error) return failure(error);
  } catch {
    return failure();
  }
  revalidatePath("/[locale]", "layout");
  refresh();
  return { success: true };
}
export async function gateAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  const { db, profile } = await requireIdentity(locale);
  if (profile.role !== "demo_admin") return { error: "forbidden" };
  try {
    const schema = z.object({
      status: z.enum(["open", "busy", "closed", "out_of_service"]),
      queue_length: z.union([
        z.literal(""),
        z.coerce.number().int().min(0).max(10000),
      ]),
      service_rate_per_hour: z.union([
        z.literal(""),
        z.coerce.number().positive().max(10000),
      ]),
    });
    const data = schema.parse(Object.fromEntries(form));
    const { error } = await db.rpc("update_demo_gate", {
      p_gate: z.uuid().parse(form.get("gate_id")),
      p_input: data,
    });
    if (error) return failure(error);
  } catch {
    return { error: "invalid_input" };
  }
  revalidatePath("/[locale]", "layout");
  refresh();
  return { success: true };
}
export async function resetAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  const { db, profile } = await requireIdentity(locale);
  if (profile.role !== "demo_admin" || form.get("confirm") !== "on")
    return { error: "forbidden" };
  try {
    const { error } = await db.rpc("reset_demo_trip", {
      p_trip: z.uuid().parse(form.get("trip_id")),
    });
    if (error) return failure(error);
  } catch {
    return failure();
  }
  revalidatePath("/[locale]", "layout");
  redirect(`/${locale}/${rolePath.demo_admin}`);
}
