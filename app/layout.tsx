import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DeepDrop · Condivisioni riservate",
  description: "Un modo semplice e riservato per ricevere i tuoi file.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            <span className="brand-icon">↓</span>DeepDrop
            <span className="brand-dot">.</span>
          </a>
          <span className="top-label">
            <i /> CONDIVISIONI RISERVATE
          </span>
        </header>
        {children}
        <footer>
          <span>DeepDrop</span>
          <span>Un file. Un link. Solo chi scegli tu.</span>
          <span className="footer-lock">◈ Accesso protetto</span>
        </footer>
      </body>
    </html>
  );
}
