import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/http";
import { validShareId, origin } from "@/lib/security";
import { getShare } from "@/lib/store";
import ReceiveFile from "@/components/ReceiveFile";
import { Icon } from "@/components/Interface";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Receive({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    if (validShareId(id)) await rateLimit(new NextRequest(`${origin()}/s/${id}`, {headers: await headers()}), `page:${id}`);
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
      <main id="main-content" className="center-page">
        <div className="state-visual">
          <Icon name="clock" />
        </div>
        <div className="eyebrow">
          <span className="tiny-square" /> TRANSFER IN PAUSA
        </div>
        <h1>Una breve pausa sulla rotta.</h1>
        <p>Il servizio è temporaneamente non disponibile. Riprova più tardi.</p>
      </main>
    );
  }
  return (
    <main id="main-content" className="center-page">
      <div className="state-visual">
        <Icon name="clock" />
      </div>
      <div className="eyebrow">
        <span className="tiny-square" /> CONDIVISIONE TERMINATA
      </div>
      <h1>Il link non è più disponibile.</h1>
      <p>
        Potrebbe essere scaduto o essere stato revocato.
        <br />
        Chiedi al mittente un nuovo link.
      </p>
      <a href="/" className="button secondary">
        Torna all’inizio <Icon name="arrow" size={16} />
      </a>
      <span className="state-reference">DEEPDROP / TRANSFER CLOSED</span>
    </main>
  );
}
