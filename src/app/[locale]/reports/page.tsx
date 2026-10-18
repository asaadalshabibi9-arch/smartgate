import { requireIdentity } from "@/lib/auth";
import { localeOf, t } from "@/lib/i18n";
import { Shell, PageHeading, TripTable } from "@/components/workspace";
export default async function Reports({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { db, profile } = await requireIdentity(locale);
  const { data, error } = await db
    .from("trips")
    .select("*")
    .eq("status", "completed")
    .order("crossed_at", { ascending: false });
  if (error) throw new Error("Reports unavailable");
  return (
    <Shell locale={locale} profile={profile} section="reports">
      <PageHeading
        locale={locale}
        title={t(locale, "reports")}
        hint={t(locale, "crossingHint")}
      />
      <section className="panel">
        <TripTable locale={locale} trips={data} reports />
      </section>
    </Shell>
  );
}
