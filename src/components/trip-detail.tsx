import { randomUUID } from "node:crypto";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { tripCommandAction, resetAction } from "@/app/actions";
import { dateTime, t, type Locale } from "@/lib/i18n";
import { recommend, estimateWait } from "@/lib/domain/journey";
import type { Tables, Json } from "@/types/database";
import type { EntryReport, Delivery } from "@/lib/trip-data";
import { ActionForm } from "./action-form";
import { Badge } from "./workspace";
import { QrScanner } from "./qr-scanner";

type Trip = Tables<"trips">;
function obj(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
export function Command({
  locale,
  trip,
  command,
  label,
  payload,
  children,
}: {
  locale: Locale;
  trip: Trip;
  command: string;
  label: string;
  payload?: Record<string, string>;
  children?: React.ReactNode;
}) {
  return (
    <ActionForm
      action={tripCommandAction}
      locale={locale}
      label={t(locale, label)}
      operationKey={randomUUID()}
    >
      <input type="hidden" name="trip_id" value={trip.id} />
      <input type="hidden" name="command" value={command} />
      {Object.entries(payload ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </ActionForm>
  );
}
export function TripNotice({ locale, trip }: { locale: Locale; trip: Trip }) {
  const key =
    trip.status === "barrier_open"
      ? "crossingHint"
      : trip.status === "barrier_failed"
        ? "failureHint"
        : trip.status === "verification_failed"
          ? "mismatchHint"
          : trip.status === "completed"
            ? "entry_completed"
            : trip.barrier_requested
              ? "waitingRequest"
              : null;
  return key ? (
    <section
      className={`notice ${trip.status === "completed" ? "success" : ["barrier_failed", "verification_failed"].includes(trip.status) ? "error" : ""}`}
    >
      <h2>{t(locale, trip.status)}</h2>
      <p>{t(locale, key)}</p>
    </section>
  ) : null;
}
export function TripIdentity({
  locale,
  trip,
  report,
  gate,
}: {
  locale: Locale;
  trip: Trip;
  report: EntryReport;
  gate?: Tables<"gates">;
}) {
  const fields = [
    ["company_admin", report.company_name],
    ["driverName", report.driver_name],
    ["truck", report.plate_number],
    ["gate", gate?.code ?? t(locale, "unavailable")],
    ["operation", t(locale, trip.operation_type)],
    ["containerNumber", trip.container_number ?? t(locale, "notApplicable")],
    ["cargoType", trip.cargo_type ?? t(locale, "unavailable")],
    [
      "cargoWeight",
      trip.cargo_weight_kg?.toLocaleString(locale) ?? t(locale, "unavailable"),
    ],
    ["departure", dateTime(locale, trip.planned_departure_at)],
    ["starts", dateTime(locale, trip.appointment_start_at)],
    ["ends", dateTime(locale, trip.appointment_end_at)],
    ["status", t(locale, trip.status)],
  ];
  return (
    <section className="panel">
      <h2 className="section-heading">{t(locale, "identity")}</h2>
      <dl className="detail-grid">
        {fields.map(([key, value]) => (
          <div key={key}>
            <dt>{t(locale, key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function Timeline({
  locale,
  events,
  gates,
}: {
  locale: Locale;
  events: Tables<"trip_events">[];
  gates: Tables<"gates">[];
}) {
  return (
    <section className="panel">
      <h2>{t(locale, "timeline")}</h2>
      <ol className="timeline">
        {events.map((event) => {
          const payload = obj(event.payload);
          const checks = obj(payload.checks);
          const details = obj(payload.details);
          return (
            <li key={event.id}>
              <time dateTime={event.occurred_at}>
                {dateTime(locale, event.occurred_at)}
              </time>
              <div>
                <strong>
                  {t(
                    locale,
                    payload.command === "notification_failed"
                      ? "notificationFailureRecorded"
                      : event.event_type,
                  )}
                </strong>
                {event.reason && event.reason !== details.reason ? (
                  <p>{t(locale, event.reason)}</p>
                ) : null}
                {Object.keys(checks).length ? (
                  <div className="checks">
                    {Object.entries(checks).map(([key, value]) => (
                      <span
                        className={`check-result ${value === null ? "na" : value ? "" : "failed"}`}
                        key={key}
                      >
                        {t(locale, key)}:{" "}
                        {t(
                          locale,
                          value === null
                            ? "notApplicable"
                            : value
                              ? "passed"
                              : "mismatch",
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                {details.reason ? (
                  <p>
                    {t(locale, String(details.reason))} ·{" "}
                    {t(locale, "waitChange")}:{" "}
                    <bdi>
                      {String(details.wait_before)} /{" "}
                      {String(details.wait_after)}
                    </bdi>
                  </p>
                ) : null}
                <small>
                  {t(locale, "actor")}:{" "}
                  {t(
                    locale,
                    payload.actor_role
                      ? `role_${String(payload.actor_role)}`
                      : "unavailable",
                  )}
                  {event.gate_id ? (
                    <>
                      {" "}
                      · {t(locale, "gate")}:{" "}
                      <bdi>
                        {gates.find((g) => g.id === event.gate_id)?.code ??
                          t(locale, "unavailable")}
                      </bdi>
                    </>
                  ) : null}
                </small>
              </div>
              <span className="badge">
                {t(
                  locale,
                  event.source === "simulation" ? "simulated" : "source",
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export async function TripQR({ locale, trip }: { locale: Locale; trip: Trip }) {
  const data = await QRCode.toDataURL(trip.id, {
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return (
    <section className="panel qr-panel">
      <h2>{t(locale, "qrTitle")}</h2>
      <Image
        className="qr-image"
        src={data}
        alt={t(locale, "qrTitle")}
        width={240}
        height={240}
        unoptimized
      />
      <strong>
        <bdi>{trip.request_number}</bdi>
      </strong>
      <code className="qr-reference" dir="ltr">
        {trip.id}
      </code>
      <p>{t(locale, "qrHint")}</p>
    </section>
  );
}
export function Recommendation({
  locale,
  trip,
  gates,
  canAccept,
}: {
  locale: Locale;
  trip: Trip;
  gates: Tables<"gates">[];
  canAccept: boolean;
}) {
  const now = new Date();
  const result = recommend(gates, trip, now);
  const current = gates.find((g) => g.id === trip.gate_id);
  return (
    <section className="panel">
      <h2 className="section-heading">{t(locale, "recommendation")}</h2>
      <dl className="detail-grid">
        <div>
          <dt>{t(locale, "currentGate")}</dt>
          <dd>{current?.code ?? t(locale, "unavailable")}</dd>
        </div>
        <div>
          <dt>{t(locale, "wait")}</dt>
          <dd>
            {current && estimateWait(current) !== null
              ? `${estimateWait(current)} ${t(locale, "minutes")}`
              : t(locale, "unavailable")}
          </dd>
        </div>
        <div>
          <dt>{t(locale, "eta")}</dt>
          <dd>{dateTime(locale, result.eta.toISOString())}</dd>
        </div>
      </dl>
      {result.gate ? (
        <div className="notice" style={{ marginTop: 20 }}>
          <h3>
            {t(locale, "proposedGate")}: {result.gate.code}
          </h3>
          <p>
            {t(locale, "betterGate")} · {estimateWait(result.gate)}{" "}
            {t(locale, "minutes")}
          </p>
          <p>{t(locale, "recommendationHint")}</p>
          {canAccept ? (
            <Command
              locale={locale}
              trip={trip}
              command="accept_recommendation"
              label="accept"
              payload={{ gate_id: result.gate.id }}
            />
          ) : null}
        </div>
      ) : (
        <p style={{ marginTop: 16 }}>{t(locale, result.reason)}</p>
      )}
      <p className="calculation-note">{t(locale, "gateHint")}</p>
      <p className="calculation-note">
        {t(locale, "updated")}:{" "}
        {dateTime(locale, current?.telemetry_updated_at ?? null)}
      </p>
    </section>
  );
}
export function TripControls({
  locale,
  trip,
  profile,
  report,
}: {
  locale: Locale;
  trip: Trip;
  profile: Tables<"profiles">;
  report: EntryReport;
}) {
  const driver = profile.role === "driver";
  const operator = profile.role === "gate_operator";
  const simulation = profile.role === "demo_admin";
  return (
    <>
      {(driver && ["planned", "in_transit"].includes(trip.status)) ||
      (operator && ["verified", "barrier_failed"].includes(trip.status)) ||
      simulation ? (
        <section className="panel">
          <h2 className="section-heading">{t(locale, "actions")}</h2>
          <div className="action-stack">
            {driver && trip.status === "planned" ? (
              <Command
                locale={locale}
                trip={trip}
                command="start"
                label="start"
              />
            ) : null}
            {driver && trip.status === "in_transit" ? (
              <Command
                locale={locale}
                trip={trip}
                command="arrive"
                label="arrive"
              />
            ) : null}
            {operator &&
            ["verified", "barrier_failed"].includes(trip.status) &&
            !trip.barrier_requested ? (
              <Command
                locale={locale}
                trip={trip}
                command="request_open"
                label="request_open"
              />
            ) : null}
            {simulation &&
            ["at_gate", "verification_failed"].includes(trip.status) ? (
              <Command
                locale={locale}
                trip={trip}
                command="verify"
                label="verify"
              >
                <QrScanner locale={locale} initialValue={trip.id} />
                <label>
                  {t(locale, "plate")}
                  <input
                    name="plate"
                    required
                    defaultValue={report.plate_number}
                  />
                </label>
                {trip.operation_type === "container" ? (
                  <label>
                    {t(locale, "containerNumber")}
                    <input
                      name="container"
                      required
                      defaultValue={trip.container_number ?? ""}
                    />
                  </label>
                ) : null}
              </Command>
            ) : null}
            {simulation && trip.barrier_requested ? (
              <>
                <Command
                  locale={locale}
                  trip={trip}
                  command="barrier_opened"
                  label="simulateOpen"
                />
                <Command
                  locale={locale}
                  trip={trip}
                  command="barrier_failed"
                  label="simulateFailure"
                />
              </>
            ) : null}
            {simulation && trip.status === "barrier_open" ? (
              <Command
                locale={locale}
                trip={trip}
                command="crossing_confirmed"
                label="crossing"
              />
            ) : null}
            {simulation && trip.status === "completed"
              ? report.notifications.map((n) => (
                  <Command
                    key={n.id}
                    locale={locale}
                    trip={trip}
                    command="notification_failed"
                    label="failNotification"
                    payload={{ recipient: n.recipient_profile_id }}
                  >
                    <p>{t(locale, `role_${n.recipient_role}`)}</p>
                  </Command>
                ))
              : null}
          </div>
          <p className="calculation-note">{t(locale, "crossingHint")}</p>
        </section>
      ) : null}
      {simulation ? (
        <details className="panel">
          <summary>{t(locale, "reset")}</summary>
          <ActionForm
            action={resetAction}
            locale={locale}
            label={t(locale, "reset")}
          >
            <input type="hidden" name="trip_id" value={trip.id} />
            <label className="check-label">
              <input name="confirm" type="checkbox" required />
              {t(locale, "resetConfirm")}
            </label>
          </ActionForm>
        </details>
      ) : null}
    </>
  );
}
export function Deliveries({
  locale,
  notifications,
}: {
  locale: Locale;
  notifications: Delivery[];
}) {
  return (
    <section className="panel">
      <h2>{t(locale, "delivery")}</h2>
      <p>{t(locale, "notificationsHint")}</p>
      <div className="delivery-list">
        {notifications.map((n) => (
          <div className="delivery-row" key={n.id}>
            <strong>{t(locale, `role_${n.recipient_role}`)}</strong>
            <Badge locale={locale} status={n.status} />
            <span>{dateTime(locale, n.delivered_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
export function ReportLink({ locale, trip }: { locale: Locale; trip: Trip }) {
  return (
    <Link
      className="button primary"
      href={`/${locale}/trips/${trip.id}/report`}
    >
      {t(locale, trip.status === "completed" ? "report" : "pendingReport")}
    </Link>
  );
}
