import { NextRequest, NextResponse } from "next/server";
import {
  csrf,
  disposition,
  form,
  HttpError,
  signSession,
  text,
  verifyPassword,
} from "@/lib/security";
import {
  allowedShare,
  errorResponse,
  json,
  rateLimit,
  setCookie,
  shareCookie,
} from "@/lib/http";
import { download, getShare } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; action: string }> };
async function handle(request: NextRequest, context: Context) {
  try {
    const { id, action } = await context.params;
    if (
      !["unlock", "download"].includes(action) ||
      (action === "unlock" && request.method !== "POST") ||
      (action === "download" && request.method !== "GET")
    )
      return json({ error: "Non trovato." }, 404);
    if (request.method === "POST") {
      csrf(request);
      await rateLimit(request);
    }
    const share = await getShare(id);
    if (!share || share.expiresAt <= Date.now())
      throw new HttpError(404, "Questo link non è disponibile o è scaduto.");
    if (action === "unlock") {
      const password = text(await form(request), "password", 256);
      if (
        share.passwordHash &&
        !(await verifyPassword(password, share.passwordHash))
      )
        throw new HttpError(401, "Password non corretta.");
      const exp = Math.min(share.expiresAt, Date.now() + 60 * 60 * 1000);
      const response = json({ ok: true });
      setCookie(
        response,
        shareCookie(id),
        signSession({ kind: "share", id, version: share.version, exp }),
        exp,
        `/api/share/${id}`,
      );
      return response;
    }
    if (!allowedShare(request, share))
      throw new HttpError(401, "Inserisci la password per scaricare il file.");
    const bytes = await download(id);
    // Ricontrolla dopo la lettura del file: una revoca concorrente blocca l'inizio del download.
    const current = await getShare(id);
    if (
      !bytes ||
      !current ||
      current.expiresAt <= Date.now() ||
      current.version !== share.version
    )
      throw new HttpError(404, "Questo link non è più disponibile.");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": disposition(share.filename),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export { handle as GET, handle as POST };
