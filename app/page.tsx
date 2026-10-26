export default function Home() {
  return (
    <main className="landing">
      <div className="eyebrow">SEMPLICE DA INVIARE. RISERVATO DA RICEVERE.</div>
      <h1>
        I file giusti.
        <br />
        <span>Alle persone giuste.</span>
      </h1>
      <p>
        Uno spazio essenziale per condividere documenti,
        <br className="desktop" /> con un link dedicato e il tempo che serve.
      </p>
      <div className="landing-card">
        <div className="document-icon">↓</div>
        <div>
          <strong>Hai ricevuto un link?</strong>
          <p>
            Aprilo per accedere al tuo file.
            <br />
            Se richiesto, inserisci la password ricevuta dal mittente.
          </p>
        </div>
        <span className="card-arrow">↗</span>
      </div>
      <div className="assurances">
        <span>◷ Scadenza del link</span>
        <span>⌑ Password facoltativa</span>
        <span>↓ Download diretto</span>
      </div>
    </main>
  );
}
