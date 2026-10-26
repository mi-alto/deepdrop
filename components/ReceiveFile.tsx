"use client";
import { FormEvent, useState } from "react";
import { Icon } from "./Interface";
export default function ReceiveFile({
  id,
  protected: locked,
  filename,
  size,
  expiresAt,
}: {
  id: string;
  protected: boolean;
  filename: string | null;
  size: number | null;
  expiresAt: number;
}) {
  const [unlocked, setUnlocked] = useState(!locked),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [downloaded, setDownloaded] = useState(false);
  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/share/${id}/unlock`, {
        method: "POST",
        body: new FormData(e.currentTarget),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message || "Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/share/${id}/download`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) setUnlocked(false);
        throw new Error(data.error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const header = response.headers.get("content-disposition") || "";
      const encoded = header.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      link.download = encoded
        ? decodeURIComponent(encoded)
        : filename || "documento";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDownloaded(true);
    } catch (e) {
      setError((e as Error).message || "Download non disponibile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="receive-page">
      <div className="eyebrow">
        <span className="tiny-square" /> DESTINAZIONE RAGGIUNTA
      </div>
      <h1>{unlocked ? "Il tuo file è pronto." : "Una consegna riservata."}</h1>
      <p>
        {unlocked
          ? "Un ultimo passaggio e il documento è sul tuo dispositivo."
          : "Il mittente ha protetto questo file. Inserisci la password per accedere."}
      </p>
      <section className="receive-card">
        <div className="receive-card-top">
          <span>DEEPDROP / FILE DELIVERY</span>
          <span>
            <span className="tiny-square" />
            {unlocked ? "PRONTO" : "ACCESSO RICHIESTO"}
          </span>
        </div>
        <div className="receive-file-icon">
          <Icon name={unlocked ? "file" : "lock"} size={29} />
        </div>
        <h2>{filename || "Documento riservato"}</h2>
        <p className="receive-meta">
          {size !== null ? `${(size / 1024 / 1024).toFixed(2)} MB · ` : ""}
          Disponibile fino al{" "}
          {new Date(expiresAt).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="receive-divider">
          {unlocked ? "IL PROSSIMO PASSO È TUO" : "VERIFICA DI ACCESSO"}
        </div>
        {unlocked ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy
              ? "Preparazione del file…"
              : downloaded
                ? "Scarica di nuovo"
                : "Scarica il file"}
            <Icon name="download" size={18} />
          </button>
        ) : (
          <form onSubmit={unlock}>
            <label htmlFor="password">Password del file</label>
            <div className="input-with-icon">
              <Icon name="lock" size={16} />
              <input
                id="password"
                name="password"
                type="password"
                maxLength={256}
                required
                autoComplete="off"
                placeholder="La password ricevuta dal mittente"
              />
            </div>
            <button className="button" disabled={busy}>
              {busy ? "Verifica in corso…" : "Accedi al file"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
        )}
        {downloaded && !error && (
          <div className="download-complete" role="status">
            <Icon name="check" size={15} />
            Download avviato. Controlla i file del tuo dispositivo.
          </div>
        )}
        {error && (
          <p className="error banner" role="alert">
            <Icon name="shield" size={16} />
            {error}
          </p>
        )}
        <p className="hint">
          <Icon name={locked ? "lock" : "link"} size={12} />
          {locked
            ? "Condivisione protetta da password"
            : "Chi possiede il link può scaricare il file"}
        </p>
      </section>
      <div className="receive-footnote">
        <Icon name="clock" size={12} />
        IL LINK SCADE AUTOMATICAMENTE ALLA DATA INDICATA.
      </div>
    </main>
  );
}
