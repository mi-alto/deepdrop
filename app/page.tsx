import { Icon, TransferGraphic } from "@/components/Interface";
export default function Home() {
  return (
    <main id="main-content" className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-square" /> FILE DELIVERY, REIMMAGINATO
          </div>
          <h1>
            Il tuo file.
            <br />
            La tua rotta.
            <br />
            <span>Il tuo controllo.</span>
          </h1>
          <p>
            Un percorso diretto tra i tuoi documenti
            <br className="desktop" /> e chi deve riceverli. Niente di
            superfluo.
          </p>
          <div className="hero-instruction">
            <span className="instruction-icon">
              <Icon name="link" />
            </span>
            <div>
              <strong>Hai ricevuto un link DeepDrop?</strong>
              <span>Aprilo per accedere al file condiviso con te.</span>
            </div>
            <Icon name="arrow" size={18} />
          </div>
          <div className="hero-meta">
            <span>01 — CARICA</span>
            <i />
            <span>02 — CONDIVIDI</span>
            <i />
            <span>03 — SCARICA</span>
          </div>
        </div>
        <div className="hero-visual">
          <TransferGraphic />
          <div className="visual-tag">
            <span className="tiny-square" /> CONTENUTI PRIVATI. ACCESSO MIRATO.
          </div>
        </div>
      </section>
      <section className="principles" aria-label="Come funziona">
        <article>
          <span className="principle-index">/ 01</span>
          <Icon name="clock" />
          <h2>Il tempo lo scegli tu.</h2>
          <p>
            Un’ora o trenta giorni. Ogni condivisione ha una scadenza definita.
          </p>
        </article>
        <article>
          <span className="principle-index">/ 02</span>
          <Icon name="lock" />
          <h2>Un passaggio in più.</h2>
          <p>
            Proteggi il file con una password e comunicala separatamente dal
            link.
          </p>
        </article>
        <article>
          <span className="principle-index">/ 03</span>
          <Icon name="link" />
          <h2>Il controllo resta tuo.</h2>
          <p>
            Un link dedicato per ogni file. Revocalo quando la condivisione è
            conclusa.
          </p>
        </article>
      </section>
      <div className="landing-baseline">
        <span>LA DISTANZA PIÙ BREVE TRA UN FILE E LA SUA DESTINAZIONE.</span>
        <span>↓</span>
      </div>
    </main>
  );
}
