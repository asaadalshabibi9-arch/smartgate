import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowUpRight,
  Truck,
  CheckCircle2,
  CircleAlert,
  PanelsTopLeft,
  Plus,
} from "lucide-react";
import { Shell, TripTable, PageHeading } from "@/components/workspace";
import { Refresh } from "@/components/refresh";
import { GateCards } from "@/components/gates";
import { requireIdentity, rolePath } from "@/lib/auth";
import { localeOf, t } from "@/lib/i18n";
export default async function Dashboard({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale: raw, workspace } = await params;
  const locale = localeOf(raw);
  if (!["company", "driver", "operator", "simulation"].includes(workspace))
    notFound();
  const { db, profile } = await requireIdentity(locale);
  if (rolePath[profile.role] !== workspace)
    redirect(`/${locale}/${rolePath[profile.role]}`);
  const [tripsResult, gatesResult] = await Promise.all([
    db.from("trips").select("*").order("created_at", { ascending: false }),
    db.from("gates").select("*").order("code"),
  ]);
  if (tripsResult.error || gatesResult.error)
    throw new Error("Workspace query failed");
  const trips = tripsResult.data;
  const gates = gatesResult.data;
  const stats = [
    {
      key: "active",
      value: trips.filter((x) => x.status !== "completed").length,
      icon: Truck,
      color: "teal",
    },
    {
      key: "completedCount",
      value: trips.filter((x) => x.status === "completed").length,
      icon: CheckCircle2,
      color: "green",
    },
    {
      key: "exceptions",
      value: trips.filter((x) =>
        ["verification_failed", "barrier_failed", "exception"].includes(
          x.status,
        ),
      ).length,
      icon: CircleAlert,
      color: "amber",
    },
    {
      key: "availableGates",
      value: gates.filter((x) => ["open", "busy"].includes(x.status)).length,
      icon: PanelsTopLeft,
      color: "blue",
    },
  ];
  return (
    <Shell locale={locale} profile={profile}>
      <PageHeading
        locale={locale}
        title={t(
          locale,
          profile.role === "company_admin" ? "entryJourneys" : profile.role,
        )}
        hint={t(
          locale,
          profile.role === "demo_admin"
            ? "simulationHint"
            : profile.role === "gate_operator"
              ? "operatorHint"
              : "journeySubtitle",
        )}
      >
        {profile.role === "company_admin" ? (
          <Link className="button primary" href={`/${locale}/company/new`}>
            <Plus size={18} aria-hidden />
            {t(locale, "newTrip")}
          </Link>
        ) : null}
      </PageHeading>
      <Link className="text-link" href={`/${locale}/scenarios`}>
        {t(locale, "scenarios")}
      </Link>
      <Refresh locale={locale} />
      <div className="stats-grid">
        {stats.map(({ key, value, icon: Icon, color }) => (
          <div className="stat-card" key={key}>
            <div>
              <span>{t(locale, key)}</span>
              <strong>{value.toLocaleString(locale)}</strong>
              <small>{t(locale, "simulated")}</small>
            </div>
            <span className={`stat-icon ${color}`}>
              <Icon size={24} aria-hidden />
            </span>
          </div>
        ))}
      </div>
      <section className="panel" id="journeys">
        <div className="section-heading">
          <div>
            <h2>{t(locale, "allTrips")}</h2>
            <p>{t(locale, "timezone")}</p>
          </div>
          <span className="count-pill">{trips.length}</span>
        </div>
        <TripTable locale={locale} trips={trips} />
      </section>
      <section className="gate-section">
        <div className="section-heading">
          <h2>{t(locale, "gates")}</h2>
          <Link className="text-link" href={`/${locale}/gates`}>
            {t(locale, "view")}
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
        <GateCards
          locale={locale}
          gates={gates}
          editable={profile.role === "demo_admin"}
        />
      </section>
    </Shell>
  );
}
