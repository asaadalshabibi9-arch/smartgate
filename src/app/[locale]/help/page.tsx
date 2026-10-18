import { requireIdentity } from "@/lib/auth";
import { localeOf, t } from "@/lib/i18n";
import { Shell, PageHeading } from "@/components/workspace";
import Link from "next/link";
export default async function Help({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { profile } = await requireIdentity(locale);
  return (
    <Shell locale={locale} profile={profile} section="help">
      <PageHeading locale={locale} title={t(locale, "help")} />
      <Link className="button primary" href={`/${locale}/scenarios`}>
        {t(locale, "scenarios")}
      </Link>
      <section className="panel">
        <h2>{t(locale, "actions")}</h2>
        <ol className="help-list">
          {["helpFlow", "helpFailure", "helpRefresh", "helpScope"].map(
            (key) => (
              <li key={key}>{t(locale, key)}</li>
            ),
          )}
        </ol>
      </section>
    </Shell>
  );
}
