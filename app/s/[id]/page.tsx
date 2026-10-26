import { getShare } from "@/lib/store";
import ReceiveFile from "@/components/ReceiveFile";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Receive({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const share = await getShare(id);
    if (share && share.expiresAt > Date.now())
      return (
        <ReceiveFile
          id={id}
          protected={!!share.passwordHash}
          filename={share.passwordHash ? null : share.filename}
          size={share.passwordHash ? null : share.size}
          expiresAt={share.expiresAt}
        />
      );
  } catch {
    return (
      <main className="center-page">
        <div className="state-icon">◷</div>
        <div className="eyebrow">TORNA TRA POCO</div>
        <h1>Una breve attesa.</h1>
        <p>Il servizio è temporaneamente non disponibile. Riprova più tardi.</p>
      </main>
    );
  }
  return (
    <main className="center-page">
      <div className="state-icon">◷</div>
      <div className="eyebrow">QUESTA CONDIVISIONE È TERMINATA</div>
      <h1>Il link non è più disponibile.</h1>
      <p>
        Potrebbe essere scaduto o essere stato revocato.
        <br />
        Chiedi al mittente un nuovo link.
      </p>
      <a href="/" className="button secondary">
        Torna all’inizio
      </a>
    </main>
  );
}
