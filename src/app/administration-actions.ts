"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireIdentity } from "@/lib/auth";
import { localeOf, locales } from "@/lib/i18n";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Json, Database } from "@/types/database";
import type { FormState } from "./actions";

const accountSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(16).max(128),
  full_name: z.string().trim().min(1).max(160),
  role: z.enum(["company_admin", "driver", "gate_operator", "demo_admin"]),
  locale: z.enum(locales),
  company_id: z.string().uuid().nullable(),
});

export async function administrationAction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = localeOf(String(form.get("locale")));
  const { db } = await requireIdentity(locale);
  const capability = await db.rpc("is_platform_administrator");
  if (capability.error || capability.data !== true)
    return { error: "forbidden" };
  const key = z.uuid().safeParse(form.get("operation_key"));
  if (!key.success) return { error: "invalid_input" };
  const command = String(form.get("admin_command"));
  let input: Record<string, Json>;
  let dbCommand = command;
  let operationKey = key.data;
  try {
    if (command === "company") {
      const name = z
        .string()
        .trim()
        .min(1)
        .max(160)
        .safeParse(form.get("companyName"));
      if (!name.success) return { error: "invalid_input" };
      input = { name: name.data };
    } else if (command === "truck") {
      const parsed = z
        .object({
          company_id: z.uuid(),
          plate_number: z.string().trim().min(1).max(40),
          vehicle_type: z.string().trim().max(80),
        })
        .safeParse({
          company_id: form.get("company_id"),
          plate_number: form.get("plate_number"),
          vehicle_type: form.get("vehicle_type"),
        });
      if (!parsed.success) return { error: "invalid_input" };
      input = parsed.data;
    } else if (command === "gate_coordinates") {
      const coordinate = (value: FormDataEntryValue | null, limit: number) => {
        const text = z.string().parse(value).trim();
        return text === ""
          ? null
          : z.coerce.number().finite().min(-limit).max(limit).parse(text);
      };
      const latitude = coordinate(form.get("latitude"), 90),
        longitude = coordinate(form.get("longitude"), 180);
      if ((latitude === null) !== (longitude === null))
        return { error: "invalid_input" };
      input = {
        gate_id: z.uuid().parse(form.get("gate_id")),
        latitude,
        longitude,
      };
    } else if (command === "assign_gate" || command === "unassign_gate") {
      const parsed = z
        .object({ profile_id: z.uuid(), gate_id: z.uuid() })
        .safeParse({
          profile_id: form.get("profile_id"),
          gate_id: form.get("gate_id"),
        });
      if (!parsed.success) return { error: "invalid_input" };
      input = parsed.data;
    } else if (command === "account") {
      const role = String(form.get("role"));
      const companyId = ["company_admin", "driver"].includes(role)
        ? String(form.get("company_id") ?? "")
        : null;
      const parsed = accountSchema.safeParse({
        email: String(form.get("account_email") ?? "")
          .trim()
          .toLowerCase(),
        password: form.get("account_password"),
        full_name: form.get("full_name"),
        role,
        locale: form.get("account_locale"),
        company_id: companyId,
      });
      if (!parsed.success) return { error: "invalid_input" };
      // All checks above use the caller's session. The privileged Auth client is
      // constructed only after capability verification, never from a client key.
      const secret = process.env.SUPABASE_SECRET_KEY;
      if (!secret) return { error: "adminNotConfigured" };
      if (companyId) {
        const overview = await db.rpc("administration_overview");
        const companies = (
          overview.data as { companies?: { id: string }[] } | null
        )?.companies;
        if (
          overview.error ||
          !companies?.some((company) => company.id === companyId)
        )
          return { error: "invalid_membership" };
      }
      const reservationInput = {
        email: parsed.data.email,
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        company_id: parsed.data.company_id,
        locale: parsed.data.locale,
      };
      const reservation = await db.rpc("administration_command", {
        p_command: "reserve_account",
        p_input: reservationInput,
        p_key: key.data,
      });
      const reservedId = z
        .uuid()
        .safeParse((reservation.data as { id?: string } | null)?.id);
      if (reservation.error || !reservedId.success)
        return { error: "adminError" };
      const accountId = reservedId.data;
      // Reservation and profile creation have separate audit keys; the account
      // UUID binds Auth to the durable, password-free reservation.
      operationKey = accountId;
      const admin = createSupabaseClient<Database>(
        getSupabaseConfig().url,
        secret,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const existing = await admin.auth.admin.getUserById(accountId);
      let user = existing.data.user;
      if (!user) {
        const created = await admin.auth.admin.createUser({
          id: accountId,
          email: parsed.data.email,
          password: parsed.data.password,
          email_confirm: true,
          app_metadata: {
            smartgate_managed: true,
            provisioning_key: accountId,
          },
        });
        if (created.error || !created.data.user) {
          // Diagnose provider failures without logging credentials, emails or payloads.
          console.warn("smartgate_account_provision_failed", {
            stage: "create_user",
            code: created.error?.code ?? "missing_user",
            status: created.error?.status ?? 0,
          });
          return { error: "adminError" };
        }
        user = created.data.user;
      }
      if (
        user.id !== accountId ||
        user.email?.toLowerCase() !== parsed.data.email ||
        user.app_metadata.smartgate_managed !== true ||
        user.app_metadata.provisioning_key !== accountId
      )
        return { error: "forbidden" };
      // Passwords are never put in RPC payloads, logs, audit records or responses.
      input = {
        user_id: user.id,
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        company_id: parsed.data.company_id,
        locale: parsed.data.locale,
      };
      dbCommand = "profile";
    } else return { error: "invalid_input" };
    const result = await db.rpc("administration_command", {
      p_command: dbCommand,
      p_input: input,
      p_key: operationKey,
    });
    if (result.error)
      return {
        error: result.error.message.includes("idempotency_conflict")
          ? "idempotency_conflict"
          : "adminError",
      };
  } catch {
    return { error: "adminError" };
  }
  revalidatePath("/[locale]", "layout");
  return { success: true };
}
