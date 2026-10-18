import Image from "next/image";
import { Suspense } from "react";
import { ArrowUpRight, Route, ScanLine, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LanguageSwitch } from "@/components/language-switch";
import { localeOf, t } from "@/lib/i18n";
export default async function Login({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-story">
        <Image
          src="/brand/smartgate-logo-white.svg"
          alt="SmartGate"
          width={150}
          height={137}
          priority
        />
        <div className="story-content">
          <h1>{t(locale, "tagline")}</h1>
          <p>{t(locale, "overviewHint")}</p>
          <div className="journey-line">
            <span>
              <Route aria-hidden />
            </span>
            <i />
            <span>
              <ScanLine aria-hidden />
            </span>
            <i />
            <span>
              <ShieldCheck aria-hidden />
            </span>
          </div>
          <div className="story-foot">
            <ArrowUpRight aria-hidden />
            <span>{t(locale, "demoShort")}</span>
          </div>
        </div>
        <div className="story-grid" />
      </section>
      <section className="login-panel">
        <div className="login-top">
          <span className="environment">
            <span />
            {t(locale, "demoShort")}
          </span>
          <Suspense>
            <LanguageSwitch locale={locale} />
          </Suspense>
        </div>
        <div className="login-card">
          <Image
            className="mobile-logo"
            src="/brand/smartgate-logo-color.svg"
            alt="SmartGate"
            width={105}
            height={96}
          />
          <h2>{t(locale, "login")}</h2>
          <p className="muted">{t(locale, "loginHint")}</p>
          {error === "noProfile" ? (
            <p role="alert" className="form-error">
              {t(locale, "noProfile")}
            </p>
          ) : null}
          <ActionForm
            action={loginAction}
            locale={locale}
            label={t(locale, "login")}
          >
            <label>
              {t(locale, "email")}
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                dir="ltr"
                placeholder="name@example.com"
              />
            </label>
            <label>
              {t(locale, "password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                dir="ltr"
              />
            </label>
          </ActionForm>
          <p className="login-note">
            <ShieldCheck size={16} aria-hidden />
            {t(locale, "noSignup")}
          </p>
        </div>
        <p className="login-disclaimer">{t(locale, "demo")}</p>
      </section>
    </main>
  );
}
