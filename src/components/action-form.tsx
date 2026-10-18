"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { t, type Locale } from "@/lib/i18n";

export function ActionForm({
  action,
  locale,
  label,
  children,
  className = "",
  operationKey,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  locale: Locale;
  label: string;
  children?: React.ReactNode;
  className?: string;
  operationKey?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className={`action-form ${className}`}>
      <input type="hidden" name="locale" value={locale} />
      {operationKey ? (
        <input type="hidden" name="operation_key" value={operationKey} />
      ) : null}
      <fieldset disabled={pending}>
        {children}
        <button className="button primary" type="submit">
          {pending ? t(locale, "working") : label}
        </button>
      </fieldset>
      <div aria-live="polite">
        {state.error ? (
          <p className="form-error" role="alert">
            {t(locale, state.error)}
            {state.fields?.length
              ? ` (${state.fields.map((f) => t(locale, ({ driver_profile_id: "driverName", truck_id: "truck", gate_id: "gate", cargo_type: "cargoType", cargo_weight_kg: "cargoWeight", container_number: "containerNumber", appointment_end_at: "ends", appointment_start_at: "starts", planned_departure_at: "departure", travel_minutes: "travel" } as Record<string, string>)[f] ?? "invalid_input")).join("، ")})`
              : ""}
          </p>
        ) : null}
        {state.success ? (
          <p className="form-success">{t(locale, "success")}</p>
        ) : null}
      </div>
    </form>
  );
}
