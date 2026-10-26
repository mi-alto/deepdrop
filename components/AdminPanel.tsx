"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Icon, Mark, TransferGraphic } from "./Interface";
type Share = {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  expiresAt: number;
  protected: boolean;
};
const size = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1024 / 1024).toFixed(2)} MB`;
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
    [confirmDelete, setConfirmDelete] = useState<string | null>(null),
    [protect, setProtect] = useState(true),
    [showPassword, setShowPassword] = useState(false),
    [hours, setHours] = useState("168"),
    [dragging, setDragging] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [now, setNow] = useState(0);
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
    setError("");
    try {
      setShares((await call("shares")).shares);
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [call]);
  useEffect(() => {
    if (auth) void refresh();
  }, [auth, refresh]);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
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
    if (!file) return;
    setError("");
    setNotice("");
    setBusy(true);
    const target = e.currentTarget;
    try {
      const data = new FormData(target);
      data.set("file", file);
      if (!protect) data.set("password", "");
      const result = await call("shares", "POST", data);
      setLatest(`${window.location.origin}/s/${result.share.id}`);
      target.reset();
      setFile(null);
      setProtect(true);
      setShowPassword(false);
      setHours("168");
      await refresh();
      setNotice("Condivisione creata. Il link è pronto per essere inviato.");
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
      setNotice("Seleziona e copia il link nel campo visualizzato.");
      setLatest(link);
    }
  }
  function choose(f: File | null) {
    if (f && (f.size > 3 * 1024 * 1024 || f.size === 0)) {
      setError(
        f.size === 0
          ? "Il file è vuoto. Scegli un altro documento."
          : "Il limite è 3 MB per file.",
      );
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
    } else {
      setFile(f);
      setError("");
    }
  }
  async function logout() {
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
  }
  const active = shares.filter((s) => s.expiresAt > now),
    protectedCount = active.filter((s) => s.protected).length,
    soon = active.filter((s) => s.expiresAt <= now + 86400000).length;
  const visible = shares.filter(
    (s) =>
      s.filename
        .toLocaleLowerCase("it")
        .includes(query.toLocaleLowerCase("it")) &&
      (filter === "all" ||
        (filter === "active" ? s.expiresAt > now : s.expiresAt <= now)),
  );
  if (!auth)
    return (
      <main id="main-content" className="login-page">
        <section className="login-story">
          <div className="eyebrow">
            <span className="tiny-square" /> IL TUO PUNTO DI CONTROLLO
          </div>
          <h1>
            Condividere.
            <br />
            <span>Alle tue condizioni.</span>
          </h1>
          <p>
            Un file, una destinazione, un tempo preciso.
            <br />
            Il resto lo lasciamo fuori.
          </p>
          <TransferGraphic compact />
          <div className="login-story-bottom">
            <span>ACCESSO RISERVATO</span>
            <span>DEEPDROP / CONSOLE</span>
          </div>
        </section>
        <section className="login-panel">
          <div className="section-number">
            <span>01</span> / AUTENTICAZIONE
          </div>
          <div className="login-lock">
            <Icon name="lock" size={26} />
          </div>
          <h2>Entra nel tuo spazio.</h2>
          <p>La prossima condivisione parte da qui.</p>
          <form onSubmit={login} className="login-card">
            <label htmlFor="admin-password">Password amministratore</label>
            <div className="input-with-icon">
              <Icon name="lock" size={17} />
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                placeholder="Inserisci la tua password"
              />
            </div>
            {error && (
              <div className="error banner" role="alert">
                <Icon name="shield" size={16} />
                {error}
              </div>
            )}
            <button disabled={busy} className="button">
              {busy ? "Accesso in corso…" : "Accedi alla console"}
              <Icon name="arrow" size={18} />
            </button>
            <div className="login-info">
              <Icon name="shield" size={15} />
              <p>
                Solo chi è autorizzato può creare
                <br />e gestire le condivisioni.
              </p>
            </div>
          </form>
          <div className="login-panel-bottom">
            <span className="tiny-square" /> PRIVATE BY DESIGN. DIRECT BY
            NATURE.
          </div>
        </section>
      </main>
    );
  return (
    <main id="main-content" className="dashboard">
      <aside className="console-sidebar">
        <div className="sidebar-title">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Navigazione console">
          <a className="side-nav active" href="#overview">
            <Icon name="grid" size={17} />
            Panoramica
            <span className="nav-indicator" />
          </a>
          <a className="side-nav" href="#new-share">
            <Icon name="plus" size={17} />
            Nuova condivisione
          </a>
          <a className="side-nav" href="#shares">
            <Icon name="file" size={17} />I tuoi file
            <span className="nav-count">{shares.length}</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <Icon name="shield" size={21} />
          <strong>Condividi con intenzione.</strong>
          <p>
            Proteggi i file con una password. Scegli una scadenza. Revoca i link
            quando non servono più.
          </p>
          <span>IL CONTROLLO RESTA TUO</span>
        </div>
        <div className="sidebar-bottom">
          <div className="admin-avatar">
            A<span />
          </div>
          <div>
            <strong>Amministratore</strong>
            <span>Workspace privato</span>
          </div>
          <button
            title="Esci dalla console"
            aria-label="Esci dalla console"
            disabled={busy}
            onClick={() => void logout()}
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <div className="console-content">
        <div className="console-breadcrumb">
          <span>WORKSPACE</span>
          <span>/</span>
          <span>OVERVIEW</span>
          <span className="console-mode">
            <span className="tiny-square" /> ADMIN CONSOLE
          </span>
        </div>
        <div className="dashboard-head" id="overview">
          <div>
            <div className="eyebrow">MENO ATTRITO. PIÙ CONTROLLO.</div>
            <h1>
              La tua prossima
              <br className="mobile-only" /> destinazione<span>.</span>
            </h1>
            <p>Prepara il file. Definisci l’accesso. Condividi il link.</p>
          </div>
          <a href="#new-share" className="outline-button">
            <Icon name="plus" size={16} />
            Nuovo invio
          </a>
        </div>
        <section className="stats-grid" aria-label="Riepilogo condivisioni">
          <article>
            <span className="stat-label">
              <Icon name="link" size={15} />
              LINK ATTIVI
            </span>
            <div>
              <strong>
                {loading && shares.length === 0
                  ? "—"
                  : active.length.toString().padStart(2, "0")}
              </strong>
              <span className="stat-code">/ IN CONDIVISIONE</span>
            </div>
            <div className="stat-bottom">
              <span className="tiny-square" />
              Disponibili al download
            </div>
          </article>
          <article>
            <span className="stat-label">
              <Icon name="lock" size={15} />
              CON PASSWORD
            </span>
            <div>
              <strong>
                {loading && shares.length === 0
                  ? "—"
                  : protectedCount.toString().padStart(2, "0")}
              </strong>
              <span className="stat-code">/ LINK ATTIVI</span>
            </div>
            <div className="stat-bottom">Un ulteriore livello di accesso</div>
          </article>
          <article>
            <span className="stat-label">
              <Icon name="clock" size={15} />
              IN SCADENZA
            </span>
            <div>
              <strong className={soon ? "amber" : ""}>
                {loading && shares.length === 0
                  ? "—"
                  : soon.toString().padStart(2, "0")}
              </strong>
              <span className="stat-code">/ ENTRO 24 ORE</span>
            </div>
            <div className="stat-bottom">Scadenza automatica del link</div>
          </article>
        </section>
        {error && (
          <div className="error banner" role="alert">
            <Icon name="shield" size={17} />
            <span>{error}</span>
            <button aria-label="Chiudi errore" onClick={() => setError("")}>
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice banner" role="status">
            <Icon name="check" size={17} />
            <span>{notice}</span>
            <button aria-label="Chiudi notifica" onClick={() => setNotice("")}>
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
        <section className="panel upload-panel" id="new-share">
          <div className="panel-heading">
            <div>
              <div className="section-number">
                <span>01</span> / PREPARA UN INVIO
              </div>
              <h2>Da file a destinazione.</h2>
            </div>
            <span className="panel-corner">
              <Icon name="upload" size={16} /> NEW TRANSFER
            </span>
          </div>
          <form onSubmit={upload} className="transfer-form">
            <div className="upload-file-area">
              <div className="field-heading">
                <span>FILE DA CONDIVIDERE</span>
                <span>MAX 3 MB</span>
              </div>
              <button
                type="button"
                className={`dropzone ${file ? "selected" : ""} ${dragging ? "dragging" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files.length > 1) {
                    setError("Scegli un solo file per condivisione.");
                    return;
                  }
                  choose(e.dataTransfer.files[0] || null);
                }}
              >
                <div className="drop-corners" />
                <span className="upload-symbol">
                  <Icon name={file ? "file" : "upload"} size={30} />
                </span>
                <strong>{file ? file.name : "Trascina qui il tuo file"}</strong>
                <span>
                  {file
                    ? `${size(file.size)} · Pronto per l’invio`
                    : "oppure selezionalo dal tuo dispositivo"}
                </span>
                <span className="small-button">
                  {file ? "Cambia file" : "Sfoglia i file"}
                  <Icon name="plus" size={13} />
                </span>
                <span className="dropzone-baseline">
                  UN FILE. UNA DESTINAZIONE.
                </span>
              </button>
              <input
                className="visually-hidden"
                ref={fileRef}
                id="file"
                aria-label="Scegli il file da condividere"
                name="file"
                type="file"
                tabIndex={-1}
                onChange={(e) => choose(e.target.files?.[0] || null)}
              />
              <p className="file-area-note">
                <Icon name="file" size={13} />
                Documenti, archivi, immagini. Fino a 3 MB per file.
              </p>
            </div>
            <div className="upload-settings">
              <div className="field-heading">
                <span>REGOLE DI ACCESSO</span>
                <Icon name="shield" size={14} />
              </div>
              <label htmlFor="hours">Scadenza del link</label>
              <div className="input-with-icon">
                <Icon name="clock" size={17} />
                <select
                  id="hours"
                  name="hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                >
                  <option value="1">Tra 1 ora</option>
                  <option value="24">Tra 24 ore</option>
                  <option value="72">Tra 3 giorni</option>
                  <option value="168">Tra 7 giorni</option>
                  <option value="720">Tra 30 giorni</option>
                </select>
              </div>
              <div className="protection-setting">
                <div>
                  <label htmlFor="protect">Proteggi con password</label>
                  <span>Consigliato per documenti riservati</span>
                </div>
                <input
                  className="toggle"
                  id="protect"
                  type="checkbox"
                  checked={protect}
                  onChange={(e) => setProtect(e.target.checked)}
                />
              </div>
              {protect ? (
                <>
                  <label htmlFor="share-password" className="visually-hidden">
                    Password della condivisione
                  </label>
                  <div className="input-with-icon password-input">
                    <Icon name="lock" size={16} />
                    <input
                      id="share-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={12}
                      maxLength={256}
                      autoComplete="new-password"
                      placeholder="Almeno 12 caratteri"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Nascondi password" : "Mostra password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Icon name="eye" size={16} />
                    </button>
                  </div>
                  <p className="hint">
                    Invia la password su un canale separato dal link.
                  </p>
                </>
              ) : (
                <div className="link-warning">
                  <Icon name="link" size={15} />
                  <p>Chiunque possieda il link potrà scaricare il file.</p>
                </div>
              )}
              <div className="transfer-submit">
                <button disabled={busy || !file} className="button">
                  {busy ? "Operazione in corso…" : "Crea link di condivisione"}
                  <Icon name="arrow" size={18} />
                </button>
                <span>
                  <Icon name="clock" size={11} />
                  Il link scadrà automaticamente
                </span>
              </div>
            </div>
          </form>
          {latest && (
            <div className="link-result">
              <div className="result-icon">
                <Icon name="check" size={19} />
              </div>
              <div className="result-content">
                <label htmlFor="new-link">DESTINAZIONE PRONTA</label>
                <div>
                  <input
                    id="new-link"
                    readOnly
                    value={latest}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => void copy(latest)}
                  >
                    <Icon name="copy" size={14} />
                    Copia link
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
        <section className="panel shares-panel" id="shares">
          <div className="list-heading">
            <div>
              <div className="section-number">
                <span>02</span> / GESTISCI LE DESTINAZIONI
              </div>
              <h2>
                Le tue condivisioni
                <span className="count">{shares.length}</span>
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Aggiorna condivisioni"
              title="Aggiorna condivisioni"
              disabled={loading || busy}
              onClick={() => void refresh()}
            >
              <Icon name="refresh" size={17} />
            </button>
          </div>
          <div className="list-controls">
            <div
              className="filter-tabs"
              role="group"
              aria-label="Filtra per stato"
            >
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                Tutte<span>{shares.length}</span>
              </button>
              <button
                className={filter === "active" ? "active" : ""}
                onClick={() => setFilter("active")}
              >
                Attive
              </button>
              <button
                className={filter === "expired" ? "active" : ""}
                onClick={() => setFilter("expired")}
              >
                Scadute
              </button>
            </div>
            <div className="search-field">
              <Icon name="search" size={15} />
              <input
                aria-label="Cerca un file"
                placeholder="Cerca un file…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  aria-label="Cancella ricerca"
                  onClick={() => setQuery("")}
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>
          {loading && shares.length === 0 ? (
            <div className="empty" role="status">
              <span className="loading-ring" />
              <h3>Recupero delle condivisioni…</h3>
              <p>Un momento, stiamo preparando il tuo spazio.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <div className="empty-diagram">
                <span />
                <Icon name={shares.length ? "search" : "file"} size={27} />
                <span />
              </div>
              <h3>
                {shares.length
                  ? "Nessun file trovato."
                  : "Il tuo prossimo invio inizia qui."}
              </h3>
              <p>
                {shares.length
                  ? "Prova un altro nome o cambia il filtro."
                  : "Carica un file per creare la tua prima condivisione."}
              </p>
              {!shares.length && (
                <a href="#new-share" className="text-button">
                  Prepara un invio
                  <Icon name="arrow" size={14} />
                </a>
              )}
            </div>
          ) : (
            <div className="share-list">
              <div className="table-heading">
                <span>FILE / DIMENSIONE</span>
                <span>ACCESSO</span>
                <span>SCADENZA</span>
                <span>AZIONI</span>
              </div>
              {visible.map((s) => {
                const expired = s.expiresAt <= now;
                return (
                  <article
                    className={`share-row ${expired ? "is-expired" : ""}`}
                    key={s.id}
                  >
                    <div className="file-cell">
                      <span className="file-badge">
                        <Icon name="file" size={22} />
                      </span>
                      <div className="share-details">
                        <strong title={s.filename}>{s.filename}</strong>
                        <span>
                          {size(s.size)}
                          <i />
                          Creato il {date(s.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="share-access">
                      <Icon name={s.protected ? "lock" : "link"} size={13} />
                      {s.protected ? "Password" : "Solo link"}
                    </div>
                    <div className="share-expiry">
                      <span className={`status ${expired ? "expired" : ""}`}>
                        <span />
                        {expired ? "Scaduto" : "Attivo"}
                      </span>
                      <span>{date(s.expiresAt)}</span>
                    </div>
                    <div className="share-actions">
                      {confirmDelete === s.id ? (
                        <div className="delete-confirm">
                          <span>Revocare il link?</span>
                          <button
                            disabled={busy}
                            className="danger"
                            onClick={() => void revoke(s.id)}
                          >
                            Conferma
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Annulla revoca"
                            onClick={() => setConfirmDelete(null)}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {!expired && (
                            <button
                              className="small-button"
                              disabled={busy}
                              onClick={() =>
                                void copy(`${window.location.origin}/s/${s.id}`)
                              }
                            >
                              <Icon name="copy" size={13} />
                              Copia link
                            </button>
                          )}
                          <button
                            className="icon-button danger"
                            title="Revoca ed elimina"
                            aria-label={`Revoca ${s.filename}`}
                            disabled={busy}
                            onClick={() => setConfirmDelete(s.id)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="list-footer">
            <span>
              {visible.length}{" "}
              {visible.length === 1
                ? "condivisione visualizzata"
                : "condivisioni visualizzate"}
            </span>
            <span>
              <Icon name="clock" size={12} />
              Orari locali
            </span>
          </div>
        </section>
        <div className="console-footer">
          <span>DEEPDROP / IL TUO SPAZIO DI CONDIVISIONE</span>
          <span>POCHE MOSSE. NESSUN GIRO IN PIÙ.</span>
        </div>
      </div>
    </main>
  );
}
