import { NextRequest } from "next/server";
import {
  adminPath,
  adminVersion,
  csrf,
  form,
  hashPassword,
  HttpError,
  validShareId,
  MAX_FILE,
  newId,
  newShareId,
  safeFilename,
  signSession,
  text,
  verifyPassword,
  isPasswordHash,
  boundedBody,
} from "@/lib/security";
import {
  ADMIN_COOKIE,
  errorResponse,
  json,
  rateLimit,
  requireAdmin,
  setCookie,
} from "@/lib/http";
import { createShare, deleteShare, listShares, createAdminSession, deleteAdminSession, beginUpload, uploadPart, completeUpload } from "@/lib/store";
import { CHUNK_SIZE } from '@/lib/transfer';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
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
      await rateLimit(request, 'admin-login');
      const password = text(await form(request), "password", 256);
      const hash = process.env.ADMIN_PASSWORD_HASH || "";
      if (!isPasswordHash(hash))
        throw new HttpError(503, "Accesso amministratore non configurato.");
      if (!(await verifyPassword(password, hash)))
        throw new HttpError(401, "Password non corretta.");
      const exp = Date.now() + 8 * 60 * 60 * 1000;
      const sessionId = newId();
      const version = adminVersion();
      const token = signSession({ kind: 'admin', version, exp, sessionId });
      await createAdminSession({id: sessionId, expiresAt: exp, version});
      const response = json({ ok: true });
      setCookie(
        response,
        ADMIN_COOKIE,
        token,
        exp,
        adminPath(),
      );
      return response;
    }
    const session = await requireAdmin(request);
    if (action === "logout" && request.method === "POST") {
      await deleteAdminSession(session.sessionId!);
      const response = json({ ok: true });
      setCookie(response, ADMIN_COOKIE, "", 0, adminPath());
      return response;
    }
    if (action === "shares" && request.method === "GET")
      return json({ shares: (await listShares()).map(publicShare) });
    if (params.action[0] === 'uploads' && params.action.length === 3) {
      const [, id, part] = params.action;
      if (!validShareId(id)) throw new HttpError(400, 'Link non valido.');
      if (part === 'complete' && request.method === 'POST')
        return json({ share: publicShare(await completeUpload(id)) }, 201);
      if (/^(0|[1-9][0-9]*)$/.test(part) && request.method === 'PUT') {
        await uploadPart(id, Number(part), await boundedBody(request, CHUNK_SIZE));
        return json({ ok: true });
      }
    }
    if ((action === "shares" || action === 'uploads') && request.method === "POST") {
      const chunked = action === 'uploads';
      const data = await form(request, chunked ? 8192 : CHUNK_SIZE + 64 * 1024);
      const file = data.get("file");
      if (!chunked && (!(file instanceof File) || !file.size || file.size > CHUNK_SIZE))
        throw new HttpError(400, "Scegli un file da 1 byte a 3 MB.");
      const size = chunked ? Number(text(data, 'size', 16)) : (file as File).size;
      const filename = chunked ? text(data, 'filename', 1024) : (file as File).name;
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE)
        throw new HttpError(400, 'Il limite è 250 MB per file.');
      const password = text(data, "password", 256);
      if (password && password.length < 12)
        throw new HttpError(400, "La password deve avere almeno 12 caratteri.");
      const hours = Number(text(data, "hours", 4));
      if (![1, 24, 72, 168, 720].includes(hours))
        throw new HttpError(400, "Scadenza non valida.");
      const share = {
        id: newShareId(),
        filename: safeFilename(filename),
        size,
        createdAt: Date.now(),
        expiresAt: Date.now() + hours * 3600000,
        passwordHash: password ? await hashPassword(password) : "",
        version: newId(),
      };
      if (chunked) {
        await beginUpload(share);
        return json({ id: share.id, chunkSize: CHUNK_SIZE }, 201);
      }
      await createShare(share, new Uint8Array(await (file as File).arrayBuffer()));
      return json({ share: publicShare(share) }, 201);
    }
    if (
      params.action[0] === "shares" &&
      params.action.length === 2 &&
      request.method === "DELETE"
    ) {
      const id = params.action[1];
      if (!validShareId(id)) throw new HttpError(400, "Link non valido.");
      await deleteShare(id);
      return json({ ok: true });
    }
    return json({ error: "Non trovato." }, 404);
  } catch (e) {
    return errorResponse(e);
  }
}
export { handle as GET, handle as POST, handle as DELETE, handle as PUT };
