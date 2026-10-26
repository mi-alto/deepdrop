"use client";
import { FormEvent, useState } from "react";
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
    [busy, setBusy] = useState(false);
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
    } catch (e) {
      setError((e as Error).message || "Download non disponibile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="receive-page">
      <div className="eyebrow">UNA CONDIVISIONE PER TE</div>
      <h1>{unlocked ? "Il tuo file è qui." : "Un file, solo per te."}</h1>
      <p>
        {unlocked
          ? "È tutto pronto. Scaricalo quando vuoi."
          : "Inserisci la password che hai ricevuto dal mittente."}
      </p>
      <section className="receive-card">
        <div className="receive-file-icon">{unlocked ? "↓" : "⌑"}</div>
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
        {unlocked ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? "Preparazione del file…" : "Scarica il file"}
            <span>↓</span>
          </button>
        ) : (
          <form onSubmit={unlock}>
            <label htmlFor="password">Password del file</label>
            <input
              id="password"
              name="password"
              type="password"
              maxLength={256}
              required
              autoComplete="off"
              placeholder="Inserisci la password"
            />
            <button className="button" disabled={busy}>
              {busy ? "Verifica in corso…" : "Accedi al file"}
              <span>→</span>
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint">
          {locked
            ? "Condivisione protetta da password"
            : "Chi possiede questo link può scaricare il file."}
        </p>
      </section>
      <div className="receive-footnote">
        ◷ Il link scade automaticamente. I tuoi file restano riservati.
      </div>
    </main>
  );
}
