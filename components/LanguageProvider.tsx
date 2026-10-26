"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE, translate, localeTag, type Locale } from "@/lib/i18n";
const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Context.Provider value={{ locale, setLocale }}>
      {children}
    </Context.Provider>
  );
}
export function useTranslation() {
  const { locale } = useContext(Context);
  const t = useCallback(
    (message: string) => translate(locale, message),
    [locale],
  );
  return { locale, localeTag: localeTag(locale), t };
}
export function LanguageSelector() {
  const { locale, setLocale } = useContext(Context);
  const router = useRouter();
  return (
    <label className="language-switch">
      <span className="visually-hidden">
        {locale === "it" ? "Lingua" : "Language"}
      </span>
      <select
        aria-label={locale === "it" ? "Lingua" : "Language"}
        value={locale}
        onChange={(event) => {
          const next = event.target.value === "it" ? "it" : "en";
          // This preference grants no access and never changes authentication cookies.
          document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          setLocale(next);
          router.refresh();
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="it" lang="it">
          Italiano
        </option>
      </select>
    </label>
  );
}
