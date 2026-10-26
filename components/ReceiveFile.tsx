"use client";
import { useTranslation } from "./LanguageProvider";
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
  const { t, localeTag } = useTranslation();
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
        <span className="tiny-square" />
        {t("DESTINAZIONE RAGGIUNTA")}
      </div>
      <h1>
        {unlocked ? t("Il tuo file è pronto.") : t("Una consegna riservata.")}
      </h1>
      <p>
        {unlocked
          ? t("Un ultimo passaggio e il documento è sul tuo dispositivo.")
          : t(
              "Il mittente ha protetto questo file. Inserisci la password per accedere.",
            )}
      </p>
      <section className="receive-card">
        <div className="receive-card-top">
          <span>{t("DEEPDROP / FILE DELIVERY")}</span>
          <span>
            <span className="tiny-square" />
            {unlocked ? t("PRONTO") : t("ACCESSO RICHIESTO")}
          </span>
        </div>
        <div className="receive-file-icon">
          <Icon name={unlocked ? "file" : "lock"} size={29} />
        </div>
        <h2>{filename || t("Documento riservato")}</h2>
        <p className="receive-meta">
          {size !== null
            ? `${new Intl.NumberFormat(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(size / 1024 / 1024)} MB · `
            : ""}
          {t("Disponibile fino al")}{" "}
          {new Date(expiresAt).toLocaleDateString(localeTag, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="receive-divider">
          {unlocked ? t("IL PROSSIMO PASSO È TUO") : t("VERIFICA DI ACCESSO")}
        </div>
        {unlocked ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy
              ? t("Preparazione del file…")
              : downloaded
                ? t("Scarica di nuovo")
                : t("Scarica il file")}
            <Icon name="download" size={18} />
          </button>
        ) : (
          <form onSubmit={unlock}>
            <label htmlFor="password">{t("Password del file")}</label>
            <div className="input-with-icon">
              <Icon name="lock" size={16} />
              <input
                id="password"
                name="password"
                type="password"
                maxLength={256}
                required
                autoComplete="off"
                placeholder={t("La password ricevuta dal mittente")}
              />
            </div>
            <button className="button" disabled={busy}>
              {busy ? t("Verifica in corso…") : t("Accedi al file")}
              <Icon name="arrow" size={18} />
            </button>
          </form>
        )}
        {downloaded && !error && (
          <div className="download-complete" role="status">
            <Icon name="check" size={15} />
            {t("Download avviato. Controlla i file del tuo dispositivo.")}
          </div>
        )}
        {error && (
          <p className="error banner" role="alert">
            <Icon name="shield" size={16} />
            {t(error)}
          </p>
        )}
        <p className="hint">
          <Icon name={locked ? "lock" : "link"} size={12} />
          {locked
            ? t("Condivisione protetta da password")
            : t("Chi possiede il link può scaricare il file")}
        </p>
      </section>
      <div className="receive-footnote">
        <Icon name="clock" size={12} />
        {t("IL LINK SCADE AUTOMATICAMENTE ALLA DATA INDICATA.")}
      </div>
    </main>
  );
}
