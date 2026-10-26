import { Icon } from "@/components/Interface";
export default function NotFound() {
  return (
    <main id="main-content" className="center-page">
      <div className="state-visual">
        <Icon name="search" />
      </div>
      <div className="eyebrow">
        <span className="tiny-square" /> DESTINAZIONE NON TROVATA
      </div>
      <h1>Qui la rotta si interrompe.</h1>
      <p>
        La pagina non è disponibile.
        <br />
        Controlla il link che hai ricevuto e riprova.
      </p>
      <a className="button secondary" href="/">
        Torna all’inizio
        <Icon name="arrow" size={16} />
      </a>
      <span className="state-reference">DEEPDROP / 404 — ROUTE NOT FOUND</span>
    </main>
  );
}
