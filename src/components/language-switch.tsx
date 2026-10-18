"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { locales, languageNames, direction, t, type Locale } from "@/lib/i18n";
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  const urlFor = (lang: Locale) =>
    `${pathname.replace(/^\/(ar|en|hi|ur|bn|ml|ta|ne)(?=\/|$)/, `/${lang}`)}${search.size ? `?${search}` : ""}`;
  // Full navigation updates document direction while retaining the trip and query.
  return (
    <div className="language-controls">
      <a
        className="language"
        href={urlFor(other)}
        hrefLang={other}
        lang={other}
      >
        <Languages size={17} aria-hidden />
        {other === "en" ? "English" : "العربية"}
      </a>
      <select
        className="language-picker"
        aria-label={t(locale, "language")}
        value={locale}
        onChange={(event) =>
          window.location.assign(urlFor(event.target.value as Locale))
        }
      >
        {locales.map((lang) => (
          <option key={lang} value={lang} lang={lang} dir={direction(lang)}>
            {languageNames[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
