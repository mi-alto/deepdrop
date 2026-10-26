import type { Metadata } from "next";
import { Mark, Icon } from "@/components/Interface";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DeepDrop · Condivisioni riservate",
  description: "I tuoi file. La tua destinazione. Il tuo controllo.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <a href="#main-content" className="skip-link">
          Vai al contenuto
        </a>
        <header className="topbar">
          <a href="/" className="brand" aria-label="DeepDrop, pagina iniziale">
            <Mark />
            <span>
              deepdrop<span className="brand-dot">_</span>
            </span>
          </a>
          <div className="topbar-rule" />
          <span className="top-label">
            <span className="tiny-square" />
            PRIVATE FILE DELIVERY<span className="top-version">/ 01</span>
          </span>
        </header>
        {children}
        <footer>
          <a href="/" className="footer-brand">
            DEEPDROP<span>®</span>
          </a>
          <span>Condividi con precisione. Conserva il controllo.</span>
          <span className="footer-lock">
            <Icon name="lock" size={12} /> LINK A SCADENZA
          </span>
        </footer>
      </body>
    </html>
  );
}
