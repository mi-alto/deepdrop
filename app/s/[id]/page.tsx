import { serverTranslation } from "@/lib/locale";
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
  const { t } = await serverTranslation();
  const { id } = await params;
  try {
    if (validShareId(id))
      await rateLimit(
        new NextRequest(`${origin()}/s/${id}`, { headers: await headers() }),
        `page:${id}`,
      );
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
          <span className="tiny-square" />
          {t("TRANSFER IN PAUSA")}
        </div>
        <h1>{t("Una breve pausa sulla rotta.")}</h1>
        <p>
          {t(
            "Il servizio è temporaneamente non disponibile. Riprova più tardi.",
          )}
        </p>
      </main>
    );
  }
  return (
    <main id="main-content" className="center-page">
      <div className="state-visual">
        <Icon name="clock" />
      </div>
      <div className="eyebrow">
        <span className="tiny-square" />
        {t("CONDIVISIONE TERMINATA")}
      </div>
      <h1>{t("Il link non è più disponibile.")}</h1>
      <p>
        {t("Potrebbe essere scaduto o essere stato revocato.")}
        <br />
        {t("Chiedi al mittente un nuovo link.")}
      </p>
      <a href="/" className="button secondary">
        {t("Torna all’inizio")} <Icon name="arrow" size={16} />
      </a>
      <span className="state-reference">{t("DEEPDROP / TRANSFER CLOSED")}</span>
    </main>
  );
}
