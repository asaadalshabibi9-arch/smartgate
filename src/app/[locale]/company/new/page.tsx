import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity, rolePath } from "@/lib/auth";
import { localeOf, t } from "@/lib/i18n";
import { muscatInput } from "@/lib/domain/journey";
import { Shell, PageHeading } from "@/components/workspace";
import { TripForm } from "@/components/trip-form";
import { scenarioByCode, scenarioText } from "@/lib/scenarios";
export default async function NewTrip({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const locale = localeOf((await params).locale);
  const scenario = scenarioByCode((await searchParams).scenario);
  const { db, profile } = await requireIdentity(locale);
  if (profile.role !== "company_admin")
    redirect(`/${locale}/${rolePath[profile.role]}`);
  const [drivers, trucks, gates] = await Promise.all([
    db
      .from("profiles")
      .select("*")
      .eq("role", "driver")
      .eq("company_id", profile.company_id!),
    db.from("trucks").select("*").eq("company_id", profile.company_id!),
    db.from("gates").select("*").in("status", ["open", "busy"]).order("code"),
  ]);
  if (drivers.error || trucks.error || gates.error)
    throw new Error("Trip resources unavailable");
  // Server-only request defaults, after authenticated dynamic data has loaded.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <Shell locale={locale} profile={profile}>
      <PageHeading
        locale={locale}
        title={t(locale, "newTrip")}
        hint={t(locale, "tripFormHint")}
      />
      {scenario ? (
        <section className="notice">
          <h2>
            {scenario.code} · {scenarioText(scenario.title, locale)}
          </h2>
          <p>{t(locale, "scenarioTemplate")}</p>
          <Link className="text-link" href={`/${locale}/scenarios`}>
            {t(locale, "scenarioSteps")}
          </Link>
        </section>
      ) : null}
      <section className="panel">
        <h2 className="section-heading">{t(locale, "identity")}</h2>
        {drivers.data.length && trucks.data.length && gates.data.length ? (
          <TripForm
            locale={locale}
            drivers={drivers.data}
            trucks={trucks.data}
            gates={gates.data}
            operationKey={randomUUID()}
            preset={
              scenario
                ? {
                    cargo_type: `[${scenario.code}] ${scenarioText(scenario.title, locale)}`,
                    cargo_weight_kg: "12000",
                    container_number:
                      scenario.code === "SC10" || scenario.code === "SC11"
                        ? ""
                        : `DEMO-${scenario.code}`,
                    operation_type:
                      scenario.code === "SC10" || scenario.code === "SC11"
                        ? "general_cargo"
                        : "container",
                  }
                : undefined
            }
            defaults={{
              departure: muscatInput(new Date(now)),
              start: muscatInput(
                new Date(
                  now +
                    (scenario?.code === "SC08"
                      ? -4 * 3600000
                      : scenario?.code === "SC09"
                        ? 2 * 3600000
                        : -15 * 60000),
                ),
              ),
              end: muscatInput(
                new Date(
                  now + (scenario?.code === "SC08" ? -3600000 : 4 * 3600000),
                ),
              ),
            }}
          />
        ) : (
          <p>{t(locale, "noResources")}</p>
        )}
      </section>
      <Link className="text-link" href={`/${locale}/company`}>
        {t(locale, "back")}
      </Link>
    </Shell>
  );
}
