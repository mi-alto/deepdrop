"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
type Share = {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  expiresAt: number;
  protected: boolean;
};
const size = (n: number) =>
  n < 1024 ? `${n} B` : `${(n / 1024 / 1024).toFixed(2)} MB`;
const date = (n: number) =>
  new Date(n).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function AdminPanel({
  base,
  initialAuth,
}: {
  base: string;
  initialAuth: boolean;
}) {
  const [auth, setAuth] = useState(initialAuth),
    [shares, setShares] = useState<Share[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [latest, setLatest] = useState(""),
    [loading, setLoading] = useState(initialAuth),
    [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const call = useCallback(
    async (action: string, method = "GET", body?: FormData) => {
      const response = await fetch(`${base}/api/${action}`, {
        method,
        body,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 && action !== "login") setAuth(false);
        throw new Error(data.error || "Operazione non riuscita.");
      }
      return data;
    },
    [base],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setShares((await call("shares")).shares);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [call]);
  useEffect(() => {
    if (auth) void refresh();
  }, [auth, refresh]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await call("login", "POST", new FormData(e.currentTarget));
      setAuth(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const target = e.currentTarget;
    try {
      const result = await call("shares", "POST", new FormData(target));
      setLatest(`${window.location.origin}/s/${result.share.id}`);
      target.reset();
      setFile(null);
      await refresh();
      setNotice("Il tuo file è pronto. Condividi il link qui sotto.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setError("");
    setBusy(true);
    try {
      await call(`shares/${id}`, "DELETE");
      setConfirmDelete(null);
      if (latest.endsWith(id)) setLatest("");
      await refresh();
      setNotice("Link revocato e file eliminato.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copiato negli appunti.");
    } catch {
      setNotice("Copia il link dal campo visualizzato.");
      setLatest(link);
    }
  }
  if (!auth)
    return (
      <main className="login-page">
        <div className="eyebrow">AREA AMMINISTRATORE</div>
        <h1>
          Bentornato<span className="brand-dot">.</span>
        </h1>
        <p>Accedi per creare e gestire le tue condivisioni.</p>
        <form onSubmit={login} className="login-card">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            placeholder="La tua password amministratore"
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy} className="button">
            {busy ? "Accesso in corso…" : "Accedi al tuo spazio"} <span>→</span>
          </button>
          <p className="hint">Uno spazio privato, sotto il tuo controllo.</p>
        </form>
      </main>
    );
  return (
    <main className="dashboard">
      <div className="dashboard-head">
        <div>
          <div className="eyebrow">IL TUO SPAZIO</div>
          <h1>Condividi, con cura.</h1>
          <p>Carica un file. Scegli chi può aprirlo e per quanto tempo.</p>
        </div>
        <button
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await call("logout", "POST");
              setAuth(false);
              setShares([]);
              setLatest("");
              setError("");
              setNotice("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Esci ↗
        </button>
      </div>
      {error && (
        <div className="error banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice banner" role="status">
          {notice}
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel upload-panel">
          <div className="section-number">01 / NUOVA CONDIVISIONE</div>
          <h2>Un nuovo invio.</h2>
          <form onSubmit={upload}>
            <label
              className={`dropzone ${file ? "selected" : ""}`}
              htmlFor="file"
            >
              <span className="upload-icon">↑</span>
              <strong>{file ? file.name : "Scegli il tuo file"}</strong>
              <span>
                {file ? size(file.size) : "Qualsiasi documento, fino a 3 MB"}
              </span>
              <span className="small-button">
                {file ? "Cambia file" : "Sfoglia i file"}
              </span>
            </label>
            <input
              className="file-input"
              ref={fileRef}
              id="file"
              name="file"
              type="file"
              required
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > 3 * 1024 * 1024) {
                  setError("Il limite è 3 MB per file.");
                  e.target.value = "";
                  setFile(null);
                } else {
                  setFile(f);
                  setError("");
                }
              }}
            />
            <div className="form-grid">
              <div>
                <label htmlFor="hours">Disponibile per</label>
                <select id="hours" name="hours" defaultValue="168">
                  <option value="1">1 ora</option>
                  <option value="24">24 ore</option>
                  <option value="72">3 giorni</option>
                  <option value="168">7 giorni</option>
                  <option value="720">30 giorni</option>
                </select>
              </div>
              <div>
                <label htmlFor="share-password">
                  Password <span className="optional">facoltativa</span>
                </label>
                <input
                  id="share-password"
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={256}
                  autoComplete="new-password"
                  placeholder="Almeno 8 caratteri"
                />
              </div>
            </div>
            <p className="hint">
              Invia l’eventuale password separatamente dal link.
            </p>
            <button disabled={busy || !file} className="button">
              {busy ? "Operazione in corso…" : "Crea link di condivisione"}
              <span>↗</span>
            </button>
          </form>
          {latest && (
            <div className="link-result">
              <label htmlFor="new-link">IL LINK È PRONTO</label>
              <div>
                <input
                  id="new-link"
                  readOnly
                  value={latest}
                  onFocus={(e) => e.target.select()}
                />
                <button onClick={() => void copy(latest)}>Copia</button>
              </div>
            </div>
          )}
        </section>
        <aside className="side-note">
          <div className="note-orbit">◈</div>
          <h2>
            Solo il tempo
            <br />
            che serve.
          </h2>
          <p>
            Ogni link ha una scadenza. Puoi proteggerlo con una password e
            revocarlo quando vuoi.
          </p>
          <div className="note-divider" />
          <span>FILE PRIVATI</span>
          <p>
            I contenuti sono accessibili solo attraverso il link che condividi.
          </p>
        </aside>
      </div>
      <section className="panel shares-panel">
        <div className="list-heading">
          <div>
            <div className="section-number">02 / LE TUE CONDIVISIONI</div>
            <h2>
              Tutto sotto controllo
              <span className="count">{shares.length}</span>
            </h2>
          </div>
          <button
            className="text-button"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            {loading ? "Aggiornamento…" : "Aggiorna ↻"}
          </button>
        </div>
        {loading && shares.length === 0 ? (
          <p className="empty">Caricamento delle condivisioni…</p>
        ) : shares.length === 0 ? (
          <div className="empty">
            <span>↗</span>
            <h3>Il prossimo invio parte da qui.</h3>
            <p>Carica il tuo primo file per creare una condivisione.</p>
          </div>
        ) : (
          <div className="share-list">
            {shares.map((s) => {
              const expired = s.expiresAt <= Date.now();
              return (
                <div className="share-row" key={s.id}>
                  <span className="file-badge">↓</span>
                  <div className="share-details">
                    <strong title={s.filename}>{s.filename}</strong>
                    <span>
                      {size(s.size)} ·{" "}
                      {s.protected ? "Con password" : "Accesso con link"}
                    </span>
                  </div>
                  <div className="share-expiry">
                    <span className={`status ${expired ? "expired" : ""}`}>
                      {expired ? "Scaduto" : "Attivo"}
                    </span>
                    <span>
                      {expired ? "Scaduto il" : "Fino al"} {date(s.expiresAt)}
                    </span>
                  </div>
                  <div className="share-actions">
                    {!expired && (
                      <button
                        className="small-button"
                        onClick={() =>
                          void copy(`${window.location.origin}/s/${s.id}`)
                        }
                      >
                        Copia link
                      </button>
                    )}
                    {confirmDelete === s.id ? (
                      <>
                        <button
                          disabled={busy}
                          className="danger"
                          onClick={() => void revoke(s.id)}
                        >
                          Conferma elimina
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => setConfirmDelete(s.id)}
                      >
                        Revoca
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
