import Link from "next/link";
import { requireIdentity } from "@/lib/auth";
import { localeOf, t, dateTime } from "@/lib/i18n";
import { scenarios, scenarioForCargo, scenarioText } from "@/lib/scenarios";
import { Shell, PageHeading, Badge } from "@/components/workspace";
import { Refresh } from "@/components/refresh";
export default async function Scenarios({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { db, profile } = await requireIdentity(locale);
  const { data, error } = await db
    .from("trips")
    .select("*")
    .eq("is_simulated", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Scenarios unavailable");
  return (
    <Shell locale={locale} profile={profile} section="scenarios">
      <PageHeading
        locale={locale}
        title={t(locale, "scenarios")}
        hint={t(locale, "scenariosHint")}
      >
        <Refresh locale={locale} />
      </PageHeading>
      <section className="notice">
        <h2>{t(locale, "scenarioAccounts")}</h2>
        <p>{t(locale, "scenarioAccountsHint")}</p>
        <Link className="text-link" href={`/${locale}/help`}>
          {t(locale, "help")}
        </Link>
      </section>
      <div className="scenario-grid">
        {scenarios.map((scenario) => {
          const trip = data.find(
            (trip) => scenarioForCargo(trip.cargo_type)?.code === scenario.code,
          );
          return (
            <article className="panel scenario-card" key={scenario.code}>
              <div className="scenario-meta">
                <bdi>{scenario.code}</bdi>
                <span>{t(locale, `scenarioGroup_${scenario.group}`)}</span>
              </div>
              <h2>{scenarioText(scenario.title, locale)}</h2>
              <p>{scenarioText(scenario.description, locale)}</p>
              <details>
                <summary>{t(locale, "scenarioSteps")}</summary>
                <ol className="help-list">
                  {scenario.steps.map((step) => (
                    <li key={step}>{t(locale, `scenarioStep_${step}`)}</li>
                  ))}
                </ol>
              </details>
              {trip ? (
                <div className="scenario-instance">
                  <div>
                    <Link
                      className="text-link"
                      href={`/${locale}/trips/${trip.id}`}
                    >
                      <bdi>{trip.request_number}</bdi>
                    </Link>
                    <Badge locale={locale} status={trip.status} />
                  </div>
                  <small>
                    {t(locale, "updated")}: {dateTime(locale, trip.updated_at)}
                  </small>
                  {new Date(trip.appointment_end_at) < new Date() &&
                  trip.status !== "completed" ? (
                    <p className="field-error">
                      {t(locale, "scenarioExpired")}
                    </p>
                  ) : null}
                  <Link
                    className="button"
                    href={`/${locale}/trips/${trip.id}${trip.status === "completed" ? "/report" : ""}`}
                  >
                    {t(locale, trip.status === "completed" ? "report" : "view")}
                  </Link>
                </div>
              ) : (
                <p className="muted">{t(locale, "scenarioUnavailable")}</p>
              )}
              {profile.role === "company_admin" && scenario.code !== "SC13" ? (
                <Link
                  className="button primary"
                  href={`/${locale}/company/new?scenario=${scenario.code}`}
                >
                  {t(locale, "newScenarioRun")}
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
