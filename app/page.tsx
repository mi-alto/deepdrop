import { serverTranslation } from "@/lib/locale";
import { Icon, TransferGraphic } from "@/components/Interface";
export default async function Home() {
  const { t } = await serverTranslation();
  return (
    <main id="main-content" className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-square" /> DEEPDROP BY DEEP4IT
          </div>
          <h1>
            {t("Condivisione file,")}
            <br />
            <span>{t("senza complicazioni.")}</span>
          </h1>
          <p>{t("Il sistema di sharing sviluppato da Deep4IT.")}</p>
          <div className="hero-instruction">
            <span className="instruction-icon">
              <Icon name="link" />
            </span>
            <div>
              <strong>{t("Hai ricevuto un link?")}</strong>
              <span>{t("Aprilo per scaricare il file.")}</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <TransferGraphic />
        </div>
      </section>
    </main>
  );
}
