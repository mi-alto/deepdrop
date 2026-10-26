import { serverTranslation } from "@/lib/locale";
import {
  LanguageProvider,
  LanguageSelector,
} from "@/components/LanguageProvider";
import type { Metadata } from "next";
import { Mark, Icon } from "@/components/Interface";
import "./globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverTranslation();
  return {
    title: t("DeepDrop · Condivisioni riservate"),
    description: t("I tuoi file. La tua destinazione. Il tuo controllo."),
    robots: { index: false, follow: false },
  };
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale } = await serverTranslation();
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <a href="#main-content" className="skip-link">
            {t("Vai al contenuto")}
          </a>
          <header className="topbar">
            <a
              href="/"
              className="brand"
              aria-label={t("DeepDrop, pagina iniziale")}
            >
              <Mark />
              <span>
                deepdrop<span className="brand-dot">_</span>
              </span>
            </a>
            <div className="topbar-rule" />
            <span className="top-label">
              <span className="tiny-square" />
              {t("PRIVATE FILE DELIVERY")}
              <span className="top-version">/ 01</span>
            </span>
            <LanguageSelector />
          </header>
          {children}
          <footer>
            <a href="/" className="footer-brand">
              DEEPDROP<span>®</span>
            </a>
            <span>{t("Condividi con precisione. Conserva il controllo.")}</span>
            <span className="footer-lock">
              <Icon name="lock" size={12} />
              {t("LINK A SCADENZA")}
            </span>
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
