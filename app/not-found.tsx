import { serverTranslation } from "@/lib/locale";
import { Icon } from "@/components/Interface";
export default async function NotFound() {
  const { t } = await serverTranslation();
  return (
    <main id="main-content" className="center-page">
      <div className="state-visual">
        <Icon name="search" />
      </div>
      <div className="eyebrow">
        <span className="tiny-square" />
        {t("DESTINAZIONE NON TROVATA")}
      </div>
      <h1>{t("Qui la rotta si interrompe.")}</h1>
      <p>
        {t("La pagina non è disponibile.")}
        <br />
        {t("Controlla il link che hai ricevuto e riprova.")}
      </p>
      <a className="button secondary" href="/">
        {t("Torna all’inizio")}
        <Icon name="arrow" size={16} />
      </a>
      <span className="state-reference">
        {t("DEEPDROP / 404 — ROUTE NOT FOUND")}
      </span>
    </main>
  );
}
