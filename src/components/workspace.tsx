import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { rolePath } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n";
import type { Tables } from "@/types/database";
import { LanguageSwitch } from "./language-switch";

export function Shell({
  locale,
  profile,
  children,
  section = "overview",
}: {
  locale: Locale;
  profile: Tables<"profiles">;
  children: React.ReactNode;
  section?: string;
}) {
  const base = `/${locale}`;
  const items = [
    { href: `${base}/${rolePath[profile.role]}`, key: "overview" },
    { href: `${base}/gates`, key: "gates" },
    { href: `${base}/notifications`, key: "notifications" },
    { href: `${base}/reports`, key: "reports" },
    { href: `${base}/scenarios`, key: "scenarios" },
    { href: `${base}/help`, key: "help" },
  ];
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        {t(locale, "skip")}
      </a>
      <aside className="sidebar">
        <Link
          className="brand"
          href={`${base}/${rolePath[profile.role]}`}
          aria-label="SmartGate"
        >
          <Image
            src="/brand/smartgate-logo-white.svg"
            alt="SmartGate"
            width={100}
            height={92}
            priority
          />
        </Link>
        <span className="workspace-label">{t(locale, profile.role)}</span>
        <nav aria-label={t(locale, "overview")}>
          {items.map(({ href, key }) => (
            <Link
              key={key}
              className={`nav-item ${section === key ? "selected" : ""}`}
              aria-current={section === key ? "page" : undefined}
              href={href}
            >
              {t(locale, key)}
            </Link>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar">{profile.full_name.slice(0, 1)}</span>
          <div>
            <strong>{profile.full_name}</strong>
            <small>{t(locale, "demoShort")}</small>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>SmartGate</span>
            <span>/</span>
            <strong>{t(locale, section)}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">{t(locale, "demoShort")}</span>
            <Suspense>
              <LanguageSwitch locale={locale} />
            </Suspense>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                className="icon-button"
                aria-label={t(locale, "logout")}
                title={t(locale, "logout")}
              >
                <LogOut size={19} aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
        <footer className="footer">
          <span>SmartGate · {t(locale, "demoShort")}</span>
          <span>{t(locale, "timezone")}</span>
        </footer>
      </div>
    </div>
  );
}
export function Badge({ locale, status }: { locale: Locale; status: string }) {
  return <span className={`badge badge-${status}`}>{t(locale, status)}</span>;
}
export function PageHeading({
  locale,
  title,
  hint,
  children,
}: {
  locale: Locale;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {hint ? <p>{hint}</p> : null}
        </div>
        {children}
      </div>
      <div className="simulation-banner">{t(locale, "demo")}</div>
    </>
  );
}

export { TripTable } from "./trip-table";
