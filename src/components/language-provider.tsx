"use client";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Globe2 } from "lucide-react";
import {
  locales,
  localeNames,
  translate,
  type Locale,
} from "@/lib/i18n/messages";
const Language = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  return (
    <Language.Provider value={{ locale, setLocale }}>
      {children}
    </Language.Provider>
  );
}
export function useTranslation() {
  const { locale } = useContext(Language);
  return useCallback((text: string) => translate(locale, text), [locale]);
}
export function Text({ value }: { value: string }) {
  const t = useTranslation();
  return <>{t(value)}</>;
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useContext(Language);
  const t = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="language-switcher">
      <Globe2 size={16} aria-hidden="true" />
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          document.cookie = `painradar-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          document.documentElement.lang = next;
          setLocale(next);
          startTransition(() => router.refresh());
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
