import { gateAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { Badge } from "./workspace";
import { dateTime, t, type Locale } from "@/lib/i18n";
import { estimateWait } from "@/lib/domain/journey";
import type { Tables } from "@/types/database";
import { PanelsTopLeft, Clock3, Truck } from "lucide-react";
export function GateCards({
  locale,
  gates,
  editable = false,
}: {
  locale: Locale;
  gates: Tables<"gates">[];
  editable?: boolean;
}) {
  return (
    <>
      <div className="gate-grid">
        {gates.map((gate) => (
          <article className="gate-card" key={gate.id}>
            <div className="gate-title">
              <span className="gate-icon">
                <PanelsTopLeft size={23} aria-hidden />
              </span>
              <div>
                <h3>{gate.code}</h3>
                <small>{t(locale, "simulated")}</small>
              </div>
              <Badge locale={locale} status={gate.status} />
            </div>
            <div className="gate-metrics">
              <div>
                <span>
                  <Truck size={15} aria-hidden />
                  {t(locale, "queue")}
                </span>
                <strong>{gate.queue_length ?? "—"}</strong>
              </div>
              <div>
                <span>
                  <Clock3 size={15} aria-hidden />
                  {t(locale, "wait")}
                </span>
                <strong>
                  {estimateWait(gate) ?? "—"}
                  {estimateWait(gate) !== null ? (
                    <small>{t(locale, "minutes")}</small>
                  ) : null}
                </strong>
              </div>
            </div>
            <div className="capacity-bars" aria-hidden>
              {Array.from({ length: 18 }, (_, i) => (
                <i
                  key={i}
                  className={
                    gate.status === "closed"
                      ? "off"
                      : i < Math.min(18, gate.queue_length ?? 0)
                        ? "filled"
                        : ""
                  }
                />
              ))}
            </div>
            <p className="telemetry">
              {t(locale, "updated")}:{" "}
              {dateTime(locale, gate.telemetry_updated_at)}
            </p>
            {gate.queue_length === null ||
            gate.service_rate_per_hour === null ? (
              <p className="muted">{t(locale, "missingData")}</p>
            ) : null}
            {editable ? (
              <details className="gate-edit">
                <summary>{t(locale, "updateGate")}</summary>
                <ActionForm
                  action={gateAction}
                  locale={locale}
                  label={t(locale, "updateGate")}
                >
                  <input type="hidden" name="gate_id" value={gate.id} />
                  <label>
                    {t(locale, "status")}
                    <select name="status" defaultValue={gate.status}>
                      {["open", "busy", "closed", "out_of_service"].map((s) => (
                        <option value={s} key={s}>
                          {t(locale, s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t(locale, "queue")}
                    <input
                      name="queue_length"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue={gate.queue_length ?? ""}
                    />
                  </label>
                  <label>
                    {t(locale, "rate")}
                    <input
                      name="service_rate_per_hour"
                      type="number"
                      min="0.01"
                      step="any"
                      max="10000"
                      defaultValue={gate.service_rate_per_hour ?? ""}
                    />
                  </label>
                </ActionForm>
              </details>
            ) : null}
          </article>
        ))}
      </div>
      <p className="calculation-note">{t(locale, "gateHint")}</p>
    </>
  );
}
