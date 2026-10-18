"use client";
import { useActionState, useState, type ChangeEvent } from "react";
import { createTripAction } from "@/app/actions";
import { t, type Locale } from "@/lib/i18n";
import type { Tables } from "@/types/database";

type Props = {
  locale: Locale;
  drivers: Tables<"profiles">[];
  trucks: Tables<"trucks">[];
  gates: Tables<"gates">[];
  defaults: { departure: string; start: string; end: string };
  operationKey: string;
  preset?: Record<string, string>;
};
export function TripForm({
  locale,
  drivers,
  trucks,
  gates,
  defaults,
  operationKey,
  preset,
}: Props) {
  const [state, submit, pending] = useActionState(createTripAction, {});
  // Keep user input after a server validation error; React resets uncontrolled action forms.
  const [values, setValues] = useState<Record<string, string>>({
    driver_profile_id: "",
    truck_id: "",
    gate_id: "",
    operation_type: "container",
    container_number: "",
    cargo_type: "",
    cargo_weight_kg: "",
    travel_minutes: "30",
    planned_departure_at: defaults.departure,
    appointment_start_at: defaults.start,
    appointment_end_at: defaults.end,
    ...preset,
  });
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.currentTarget;
    setValues((previous) => ({ ...previous, [name]: value }));
  };
  const field = (name: string, label: string, type = "text") => {
    const invalid = state.fields?.includes(name);
    return (
      <div className="form-field" key={name}>
        <label htmlFor={name}>{t(locale, label)}</label>
        <input
          id={name}
          name={name}
          type={type}
          value={values[name]}
          onChange={change}
          required={name !== "container_number"}
          min={type === "number" ? 0 : undefined}
          max={
            name === "travel_minutes"
              ? 1440
              : name === "cargo_weight_kg"
                ? 999999999
                : undefined
          }
          step={name === "cargo_weight_kg" ? "0.001" : undefined}
          maxLength={name === "container_number" ? 40 : 200}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${name}-error` : undefined}
          dir={type === "datetime-local" ? "ltr" : undefined}
        />
        {invalid ? (
          <span id={`${name}-error`} className="field-error">
            {t(locale, "invalid_input")}
          </span>
        ) : null}
      </div>
    );
  };
  const select = (
    name: string,
    label: string,
    options: { id: string; label: string }[],
    placeholder = true,
  ) => (
    <div className="form-field">
      <label htmlFor={name}>{t(locale, label)}</label>
      <select
        id={name}
        name={name}
        required
        value={values[name]}
        onChange={change}
      >
        {placeholder ? (
          <option value="" disabled>
            {t(locale, "choose")}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form action={submit} className="action-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="operation_key" value={operationKey} />
      <fieldset disabled={pending}>
        <div className="form-grid">
          {select(
            "driver_profile_id",
            "driverName",
            drivers.map((d) => ({ id: d.id, label: d.full_name })),
          )}
          {select(
            "truck_id",
            "truck",
            trucks.map((v) => ({ id: v.id, label: v.plate_number })),
          )}
          {select(
            "operation_type",
            "operation",
            ["container", "general_cargo"].map((id) => ({
              id,
              label: t(locale, id),
            })),
            false,
          )}
          {select(
            "gate_id",
            "gate",
            gates.map((g) => ({
              id: g.id,
              label: `${g.code} — ${g.eligible_operations.map((o) => t(locale, o)).join(" / ")}`,
            })),
          )}
          {field("container_number", "containerNumber")}
          {field("cargo_type", "cargoType")}
          {field("cargo_weight_kg", "cargoWeight", "number")}
          {field("travel_minutes", "travel", "number")}
          {field("planned_departure_at", "departure", "datetime-local")}
          {field("appointment_start_at", "starts", "datetime-local")}
          {field("appointment_end_at", "ends", "datetime-local")}
        </div>
        <p className="muted">
          {t(locale, "timezone")} · {t(locale, "optional")}
        </p>
        <button className="button primary" type="submit">
          {t(locale, pending ? "working" : "save")}
        </button>
      </fieldset>
      <div aria-live="polite">
        {state.error ? (
          <p className="form-error" role="alert">
            {t(locale, state.error)}
          </p>
        ) : null}
      </div>
    </form>
  );
}
