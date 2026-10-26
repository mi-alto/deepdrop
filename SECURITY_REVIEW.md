# DeepDrop — Valutazione di sicurezza

Data: 26 ottobre 2026. Ambito: codice dell’applicazione, flussi HTTP locali e configurazione prevista per Vercel. La valutazione riguarda una piccola applicazione con un amministratore, condivisioni a scadenza e storage privato senza database.

## Esito e confini

Sono stati rafforzati protezione dello storage, identificativi condivisi, logout, password, limiti dei tentativi e policy del browser. Le decisioni di accesso avvengono sul server, vicino alla lettura dei contenuti. Questo documento descrive controlli e rischi residui, non certifica l’assenza di vulnerabilità.

È stata eseguita una revisione statica aggiuntiva con **Claude Opus 5.5**, identificativo restituito dal processo `claude-opus-5-5`. La revisione ha segnalato logout non revocabile, costi delle letture pubbliche, limiti solo per IP, robustezza dei metadati, nomi Unicode e inoltro degli header al WAF. Una seconda revisione statica con lo stesso modello ha riconosciuto le sei correzioni e segnalato i compromessi residui di disponibilità, rollback e configurazione WAF. Non costituisce una certificazione.

Le verifiche eseguite nell’attività sono locali. **Nessun deployment Vercel, store Blob privato reale o regola WAF pubblicata è stato verificato in questo ambiente.** Coerenza delle letture, autorizzazioni dei servizi, regole applicate, limiti regionali e cron richiedono verifica su una preview isolata prima dell’utilizzo operativo.

## Modello di minaccia

Si considerano richieste anonime, identificativi alterati, password errate, cookie manipolati o riutilizzati dopo il logout, richieste cross-origin, file e nomi ostili, corruzione o sostituzione di oggetti nello storage e indisponibilità dei servizi esterni. Un attaccante con accesso al runtime, all’account di deployment o alle variabili ambiente supera il confine di fiducia dell’applicazione.

## Controlli applicati

| Area                                  | Protezione presente                                                                                                                                                                                                                                                                               | Limite pratico                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File, metadati e sessioni persistenti | AES-256-GCM prima della scrittura, anche nello store locale; nonce casuale di 96 bit, tag di 128 bit e AAD vincolata al percorso logico. Oggetti alterati o spostati non sono decifrati.                                                                                                          | È cifratura server-side a riposo, **non end-to-end**. Percorsi, dimensioni e informazioni operative dello storage restano visibili.                     |
| Chiave di cifratura                   | `FILE_ENCRYPTION_KEY` obbligatoria, 32 byte rappresentati da 64 caratteri esadecimali; separata dal segreto delle sessioni.                                                                                                                                                                       | La perdita della chiave rende i contenuti irrecuperabili. Non esiste rotazione automatica o migrazione del vecchio storage in chiaro.                   |
| ID delle condivisioni                 | 43 caratteri base64url canonici, 128 bit casuali e HMAC troncato a 128 bit, con chiave derivata e separazione di dominio. Validazione prima della lettura di Blob.                                                                                                                                | Chi riceve un link valido può inoltrarlo. Gli ID non identificano una persona e non sono monouso.                                                       |
| Admin e logout                        | Password scrypt; cookie firmato con scadenza di otto ore e registro sessioni cifrato persistente. Il logout elimina il record e impedisce il replay del cookie revocato. Hash admin, percorso e segreto entrano nella validità delle sessioni.                                                    | Un cookie rubato resta sfruttabile fino a revoca o scadenza. Nessuna MFA o gestione di utenti nominativi.                                               |
| Password dei file                     | Attiva di default nell’interfaccia, disattivabile esplicitamente; minimo 12 caratteri per le nuove password. Nuovi hash `scrypt-v2`, N=32768, r=8, p=3, salt casuale.                                                                                                                             | Lunghezza minima e KDF non garantiscono una password imprevedibile. Comunicarla separatamente dal link.                                                 |
| Cookie di sblocco                     | Vincolato a ID e versione della condivisione, durata massima un’ora e comunque non oltre la scadenza del file. Cookie HttpOnly, SameSite Strict e Secure in produzione, con percorso limitato.                                                                                                    | Chi controlla browser o runtime può operare nel contesto dell’utente.                                                                                   |
| WAF                                   | Controllo per IP più chiave logica per admin o destinazione; applicato a login, sblocco, download e apertura dei link validi. Host fidato e soli header IP necessari inoltrati all’SDK; timeout un secondo. Configurazione assente, errore o regola non trovata bloccano l’accesso in produzione. | Soglie e regole vanno pubblicate e verificate su Vercel. Gli utenti dietro NAT condividono l’IP; un attaccante può consumare il limite di un link noto. |
| Scadenza e revoca                     | Metadati riletti con `useCache:false`, controlli prima e dopo la lettura del file. Revoca con tombstone persistente prima di eliminare il contenuto.                                                                                                                                              | Un download già iniziato può terminare; le copie già scaricate non sono revocabili.                                                                     |
| Richieste e browser                   | Origin esatto sulle mutazioni, cookie Strict, CSP con nonce, nessun asset/font esterno, no-store, nosniff, allegati e nomi sanificati anche per Unicode e controlli bidirezionali. Corpo limitato prima del parsing.                                                                              | La CSP riduce il rischio XSS, non sostituisce escaping e controllo accessi. Il codice di sviluppo ha concessioni CSP per gli strumenti locali.          |
| Manutenzione                          | Cleanup autenticato con segreto separato; isolamento dei manifesti corrotti nell’elenco; revoche incomplete riprendibili.                                                                                                                                                                         | Oggetti orfani o corrotti possono richiedere intervento manuale; non esiste una riparazione generale dello store.                                       |

## Gestione delle chiavi e compatibilità

Generare `SESSION_SECRET`, `FILE_ENCRYPTION_KEY` e `CRON_SECRET` separatamente con un generatore crittografico. La validazione del formato non misura l’entropia: ripetere lo stesso carattere 64 volte non crea una chiave sicura.

Conservare un backup protetto di `FILE_ENCRYPTION_KEY` separato dallo store e testare il ripristino in un ambiente isolato. La chiave autentica anche gli identificativi: cambiarla senza una procedura dedicata rende inutilizzabili file, manifesti, sessioni persistenti e link esistenti. Il codice non accetta automaticamente oggetti precedenti in chiaro e non migra gli identificativi da 32 caratteri. Una migrazione richiede esportazione autorizzata dalla vecchia istanza e nuove condivisioni, preferibilmente in uno store separato.

La cifratura autenticata protegge contenuto e integrità contro modifiche arbitrarie, ma **non garantisce freschezza contro rollback dello storage**: chi controlla il backend può ripristinare un oggetto precedente ancora valido, oltre a cancellare dati. La disponibilità e l’integrità operativa del provider restano parte del modello di fiducia.

## Copertura delle verifiche

Le suite del repository includono controlli su KDF e firme, rotazione e scadenze, CSRF, limiti corpo, intestazioni download, manomissione e sostituzione dei ciphertext, autenticazione degli ID, replay admin dopo logout, errori WAF, revoca e pulizia. Il test HTTP usa un server reale in sviluppo e dati temporanei. I test dell’integrazione WAF usano simulazioni: non dimostrano che una regola cloud sia pubblicata o applicata.

Per riprodurre le verifiche:

```sh
npm ci
npm test
npm run build
npm run typecheck
npm run test:smoke
npm audit --omit=dev
```

Una build riuscita e un audit senza advisory note non equivalgono a un penetration test. Il risultato dei comandi va registrato sul commit effettivamente distribuito.

## Rischi residui e verifiche prima del rilascio

- **Link come credenziale:** un link senza password è una credenziale bearer; cronologia, chat, email e inoltro sono fuori dal controllo dell’applicazione. Un destinatario autorizzato può sempre conservare o redistribuire il contenuto.
- **Compromissione del runtime:** il server possiede chiavi e accesso ai contenuti decifrati. Account Vercel, segreti, dipendenze e accessi operativi vanno protetti. La soluzione non offre end-to-end encryption, certificazione o garanzie normative.
- **Lockout intenzionale:** i contatori aggregati possono essere saturati da chi conosce il percorso admin o un link valido. `WAF_TARGET_RATE_LIMIT_ID` permette una seconda regola con soglia superiore a quella per IP; se omessa si riusa la stessa regola. Questo attenua i falsi positivi ma non elimina un attacco distribuito alla disponibilità. Per un admin esposto, una allowlist IP al perimetro è una difesa aggiuntiva.
- **Disponibilità e costi:** il WAF può rifiutare richieste legittime o essere indisponibile; il comportamento chiuso protegge l’accesso ma interrompe il servizio. Blob, WAF e traffico hanno quote, limiti e costi. Impostare monitoraggio e limiti di spesa del progetto; i contatori possono avere ambito regionale.
- **Configurazione cloud:** verificare Blob effettivamente privato, origine e dominio corretti, regola SDK pubblicata e applicata alle chiavi previste, timeout, risposta 429 e comportamento di errore. Provare revoca e logout contro letture reali senza cache; verificare anche la CSP nella build di produzione.
- **Preview e vecchi deployment:** usare store e segreti separati; limitare l’accesso ai deployment vecchi o di anteprima. Una vecchia versione raggiungibile non diventa sicura perché il dominio principale punta al codice nuovo.
- **Manutenzione dello storage:** un crash fra file e manifesto può lasciare ciphertext orfani. I manifesti corrotti vengono isolati e richiedono verifica manuale; gli errori sui singoli record non interrompono gli altri tentativi di pulizia, ma il job segnala il fallimento parziale. Nessuna scansione antivirus o procedura generale di recupero automatico è presente.
- **Scala e funzionalità:** elenco e cleanup leggono manifesti con paginazione; il progetto è pensato per piccoli volumi. Non sono presenti audit persistente, link monouso, quote per utente o massimo numero di download.
- **Sviluppo:** il rate limiting cloud è disabilitato fuori produzione/Vercel. Avviare il server locale su `127.0.0.1`, usare dati di prova e non esporre la modalità sviluppo su reti non fidate.
