import { NextRequest } from "next/server";
import {
  adminPath,
  adminVersion,
  csrf,
  form,
  hashPassword,
  HttpError,
  ID_RE,
  MAX_FILE,
  newId,
  safeFilename,
  signSession,
  text,
  verifyPassword,
} from "@/lib/security";
import {
  ADMIN_COOKIE,
  errorResponse,
  json,
  rateLimit,
  requireAdmin,
  setCookie,
} from "@/lib/http";
import { createShare, deleteShare, listShares } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ adminPath: string; action: string[] }> };
function publicShare(s: Awaited<ReturnType<typeof listShares>>[number]) {
  return {
    id: s.id,
    filename: s.filename,
    size: s.size,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    protected: !!s.passwordHash,
  };
}
async function handle(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    if (`/${params.adminPath}` !== adminPath())
      return json({ error: "Non trovato." }, 404);
    const action = params.action.join("/");
    if (request.method !== "GET") csrf(request);
    if (action === "login" && request.method === "POST") {
      await rateLimit(request);
      const password = text(await form(request), "password", 256);
      const hash = process.env.ADMIN_PASSWORD_HASH || "";
      if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash))
        throw new HttpError(503, "Accesso amministratore non configurato.");
      if (!(await verifyPassword(password, hash)))
        throw new HttpError(401, "Password non corretta.");
      const exp = Date.now() + 8 * 60 * 60 * 1000;
      const response = json({ ok: true });
      setCookie(
        response,
        ADMIN_COOKIE,
        signSession({ kind: "admin", version: adminVersion(), exp }),
        exp,
        adminPath(),
      );
      return response;
    }
    requireAdmin(request);
    if (action === "logout" && request.method === "POST") {
      const response = json({ ok: true });
      setCookie(response, ADMIN_COOKIE, "", 0, adminPath());
      return response;
    }
    if (action === "shares" && request.method === "GET")
      return json({ shares: (await listShares()).map(publicShare) });
    if (action === "shares" && request.method === "POST") {
      const data = await form(request, MAX_FILE + 64 * 1024);
      const file = data.get("file");
      if (!(file instanceof File) || !file.size || file.size > MAX_FILE)
        throw new HttpError(400, "Scegli un file da 1 byte a 3 MB.");
      const password = text(data, "password", 256);
      if (password && password.length < 8)
        throw new HttpError(400, "La password deve avere almeno 8 caratteri.");
      const hours = Number(text(data, "hours", 4));
      if (![1, 24, 72, 168, 720].includes(hours))
        throw new HttpError(400, "Scadenza non valida.");
      const share = {
        id: newId(),
        filename: safeFilename(file.name),
        size: file.size,
        createdAt: Date.now(),
        expiresAt: Date.now() + hours * 3600000,
        passwordHash: password ? await hashPassword(password) : "",
        version: newId(),
      };
      await createShare(share, new Uint8Array(await file.arrayBuffer()));
      return json({ share: publicShare(share) }, 201);
    }
    if (
      params.action[0] === "shares" &&
      params.action.length === 2 &&
      request.method === "DELETE"
    ) {
      const id = params.action[1];
      if (!ID_RE.test(id)) throw new HttpError(400, "Link non valido.");
      await deleteShare(id);
      return json({ ok: true });
    }
    return json({ error: "Non trovato." }, 404);
  } catch (e) {
    return errorResponse(e);
  }
}
export { handle as GET, handle as POST, handle as DELETE };
