# DeepDrop

Una piccola applicazione per distribuire documenti attraverso link dedicati, con scadenza e password facoltativa. Interfaccia italiana, pannello amministratore, nessun database. Next.js e Vercel Blob **privato**.

## In locale

Serve Node.js 22 o successivo (CI: Node 24).

```sh
npm ci
cp .env.example .env.local
npm run password
openssl rand -hex 32
```

Copia il valore `ADMIN_PASSWORD_HASH` generato in `.env.local`; usa l'output di `openssl` come `SESSION_SECRET`. Imposta `APP_ORIGIN=http://localhost:3000`, poi avvia:

```sh
npm run dev
```

Apri `http://localhost:3000/admin123`. Il percorso si può cambiare con `ADMIN_PATH=/un-percorso-tuoi`: deve essere un solo segmento di 1–64 lettere ASCII, numeri, trattini o underscore. `/admin`, `/s`, `/api` e `/_next` sono riservati. Nessun link pubblico porta al pannello. Il percorso aggiunge discrezione, mentre l'accesso resta protetto dalla password.

In sviluppo, senza token Blob, i dati restano nella cartella `.deepdrop/`, esclusa da Git. `LOCAL_STORAGE_DIR` cambia la cartella. Questo adattatore è **disabilitato su Vercel e in produzione**: non vengono salvati file nel filesystem effimero delle Functions. Il limite tentativi WAF non viene simulato localmente.

## Pubblicazione su Vercel

1. Importa il repository come progetto Next.js, runtime Node 24.
2. Crea e collega uno store Vercel Blob scegliendo **Private**. Usa uno store separato per ciascun ambiente: le preview non devono ricevere il token dello store produzione. La piattaforma imposta `BLOB_READ_WRITE_TOKEN`; non aggiungere prefissi `NEXT_PUBLIC_` ai segreti.
3. Configura le variabili qui sotto. Configura il dominio definitivo in `APP_ORIGIN` e distribuisci l'applicazione.
4. Configura e pubblica la regola WAF descritta nella prossima sezione. Gli accessi e lo sblocco password restano chiusi in produzione se la regola manca, fallisce o non risponde entro un secondo.
5. Verifica un caricamento, uno sblocco con password, un download e una revoca su Vercel. Questi controlli reali sono necessari per verificare anche permessi dello store, WAF e dominio.

| Variabile               | Utilizzo                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD_HASH`   | Hash scrypt ottenuto con `npm run password` (password admin da 12 a 256 caratteri). |
| `SESSION_SECRET`        | Segreto casuale separato, almeno 32 caratteri.                                      |
| `ADMIN_PATH`            | Percorso pannello; predefinito `/admin123`. Cambiarlo richiede un nuovo deployment. |
| `APP_ORIGIN`            | Origine pubblica esatta HTTPS, senza slash finale o percorsi.                       |
| `BLOB_READ_WRITE_TOKEN` | Token dello store Blob **privato**. Solo lato server.                               |
| `WAF_RATE_LIMIT_ID`     | Identificativo della regola SDK, ad esempio `deepdrop-auth`.                        |
| `CRON_SECRET`           | Segreto casuale di almeno 32 caratteri per la pulizia automatica.                   |

La build non richiede segreti, così la CI può verificarla senza credenziali. Le operazioni a runtime verificano la configurazione e restano chiuse se manca. In produzione fuori Vercel occorre un'integrazione WAF equivalente: non è previsto un fallback permissivo.

### Limite dei tentativi

Nel progetto Vercel apri **Firewall → Configure → New Rule**. Usa la condizione **@vercel/firewall**, Rate limit ID `deepdrop-auth` (uguale a `WAF_RATE_LIMIT_ID`), azione **Rate Limit**, strategia **Fixed Window**, ad esempio **10 richieste ogni 60 secondi**, chiave IP, risposta **429**. Salva e poi seleziona **Review Changes → Publish**. Non usare l'azione `Log`, che non blocca. Il limite si applica ai tentativi admin e agli sblocchi dei file, anche quando la password è corretta; gli utenti dietro lo stesso IP condividono il limite. I contatori WAF sono gestiti dalla piattaforma, possono avere ambito regionale e non costituiscono un limite globale per persona.

Il codice controlla sia `rateLimited` sia gli errori SDK (`not-found`, `blocked`), imposta un timeout e usa il dominio fidato di `APP_ORIGIN`, evitando il valore Host ricevuto. Le preview protette richiedono **Protection Bypass for Automation** e l'esposizione delle System Environment Variables, come descritto nella [documentazione SDK ufficiale](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk). Imposta un `APP_ORIGIN` corretto per ciascun ambiente: le richieste da origini diverse sono rifiutate.

### Pulizia

`vercel.json` pianifica `/api/cron/cleanup` ogni giorno alle 03:00 UTC. Vercel invia `Authorization: Bearer CRON_SECRET`; senza segreto valido la richiesta è rifiutata. L'esecuzione può essere ritardata secondo il piano Vercel, ma ogni download verifica direttamente la scadenza: la pulizia serve a liberare spazio, non ad applicare il controllo accessi. La pianificazione è per la produzione; in locale o su altre piattaforme usa un scheduler autenticato. Non mettere il segreto nella query string.

## Comportamento e protezioni

- Un file per condivisione, da 1 byte a **3 MiB**. Il limite include un controllo incrementale del corpo multipart prima del parsing, con 64 KiB di margine per il formulario. File di circa 2 MB rientrano nel limite delle richieste Vercel. Scadenze: 1 ora, 24 ore, 3, 7 o 30 giorni.
- Il link ha 192 bit casuali e funziona fino alla scadenza o alla revoca. Chi possiede un link senza password può scaricarne il contenuto; invia eventuali password (minimo 8 caratteri) su un canale separato.
- Password con scrypt e salt casuale; nessuna password o hash viene inviato al browser. Per i file protetti il nome resta nascosto fino al download.
- Sessioni admin firmate, durata 8 ore, cookie HttpOnly, Secure in produzione, SameSite Strict, limitato al percorso amministrativo. Cambiare hash admin, `ADMIN_PATH` o `SESSION_SECRET` invalida le sessioni admin. Gli sblocchi durano al massimo un'ora e mai oltre la scadenza del link; sono vincolati all'ID e alla versione casuale della condivisione.
- Le mutazioni verificano l'header Origin contro `APP_ORIGIN`. Il download ricontrolla autorizzazione, scadenza e metadati attuali; non si affida al solo middleware o all'interfaccia. Nessuna route restituisce URL o token dello store.
- Cache HTTP disabilitata con `private, no-store`; download come `application/octet-stream`, allegato con nome sanificato e `nosniff`. Nessun contenuto caricato viene servito sotto `public/`.
- Blob contiene `deepdrop/file/<id>` e un JSON `deepdrop/meta/<id>.json`. Le letture usano `get(..., { access: 'private', useCache: false })`, così le decisioni leggono l'origine e non la cache CDN. La revoca scrive prima una scadenza a zero, elimina il contenuto e infine il manifesto; se una rimozione fallisce, la pulizia ritenta il tombstone. Dopo la scrittura di revoca, i nuovi controlli rifiutano l'accesso; un download già iniziato può terminare e un file già scaricato non può essere ritirato. [Vercel documenta le letture consistenti](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage).
- Nessun contatore download, link monouso, audit persistente o accesso per utenti nominativi. L'elenco e la pulizia leggono i manifesti con paginazione e parallelismo limitato: soluzione per piccoli volumi, da evolvere con molti file. I file non hanno scansione antivirus: il destinatario deve fidarsi del mittente. I limiti di storage e traffico dipendono dal piano Vercel.

Un crash fra caricamento del file e creazione del manifesto può lasciare un oggetto privato orfano non scaricabile. In quel caso rimuovilo dallo store Vercel: il cron pulisce i manifesti scaduti e le revoche incomplete, non esegue una scansione degli oggetti orfani. Non inserire file riservati nel repository.

## Verifiche

```sh
npm test
npm run build
npm run typecheck
npm run test:smoke
npm audit --omit=dev
```

I test unitari coprono password, firme e rotazione, scadenze, origine, limite corpo, nomi download, errori WAF e ciclo di vita dello store locale con revoca riprendibile. Il test HTTP avvia un server reale in sviluppo con store e segreti temporanei e verifica accesso amministrativo, upload, password, download, revoca, scadenza, CSRF, limiti e assenza di segreti nelle risposte. Il funzionamento reale di Blob e WAF richiede anche il controllo su Vercel.

Le versioni sono bloccate nel lockfile. L'override `zod@4.6.6` corregge la dipendenza transitiva vulnerabile introdotta da `@vercel/cli-config` attraverso l'SDK Blob; mantenerlo finché la catena upstream non usa una versione corretta.
