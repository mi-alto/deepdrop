import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { shareAuthenticationTag } from './encryption';
const scrypt = promisify(scryptCallback);
export const MAX_FILE = 3 * 1024 * 1024;
export const ID_RE = /^[A-Za-z0-9_-]{32}$/;
export const SHARE_ID_RE = /^[A-Za-z0-9_-]{43}$/;
export function newShareId() {
  const random = randomBytes(16);
  return Buffer.concat([random, shareAuthenticationTag(random)]).toString('base64url');
}
export function validShareId(id: string): boolean {
  if (!SHARE_ID_RE.test(id)) return false;
  const bytes = Buffer.from(id, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === id &&
    timingSafeEqual(bytes.subarray(16), shareAuthenticationTag(bytes.subarray(0,16)));
}
export function newId() {
  return randomBytes(24).toString("base64url");
}
export function adminPath() {
  const path = process.env.ADMIN_PATH || "/admin123";
  if (
    !/^\/[A-Za-z0-9_-]{1,64}$/.test(path) ||
    ["s", "api", "_next", "favicon.ico", "admin"].includes(path.slice(1))
  )
    throw new Error("ADMIN_PATH non valido");
  return path;
}
export function origin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("APP_ORIGIN mancante");
  const parsed = new URL(value);
  if (
    parsed.origin !== value ||
    (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
  )
    throw new Error("APP_ORIGIN non valido");
  return value;
}
export function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET deve contenere almeno 32 caratteri");
  return value;
}
export function adminVersion() {
  return createHash("sha256")
    .update(`${process.env.ADMIN_PASSWORD_HASH || ""}:${adminPath()}`)
    .digest("hex");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derivePassword(password, salt, true);
  return `scrypt-v2:${salt}:${key.toString("hex")}`;
}
export function isPasswordHash(encoded: string) {
  return /^scrypt(?:-v2)?:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded);
}
function derivePassword(password: string, salt: string, strong: boolean): Promise<Buffer> {
  if (!strong) return scrypt(password, salt, 64) as Promise<Buffer>;
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024}, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}
export async function verifyPassword(password: string, encoded: string) {
  if (
    password.length > 256 ||
    !isPasswordHash(encoded)
  )
    return false;
  const [, salt, hash] = encoded.split(":");
  const actual = await derivePassword(password, salt, encoded.startsWith('scrypt-v2:'));
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export type Session = {
  kind: "admin" | "share";
  exp: number;
  version: string;
  id?: string;
  sessionId?: string;
};
export function signSession(data: Session) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
export function readSession(
  token: string | undefined,
  expected: Pick<Session, "kind" | "version" | "id">,
  now = Date.now(),
): Session | null {
  if (!token || token.length > 2048) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra) return null;
  const wanted = createHmac("sha256", secret()).update(body).digest();
  const provided = Buffer.from(sig, "base64url");
  if (provided.length !== wanted.length || !timingSafeEqual(wanted, provided))
    return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as Session;
    return data.kind === expected.kind &&
      data.version === expected.version &&
      data.id === expected.id &&
      Number.isFinite(data.exp) &&
      data.exp > now
      ? data
      : null;
  } catch {
    return null;
  }
}
export function csrf(request: Request) {
  if (request.headers.get("origin") !== origin())
    throw new HttpError(403, "Richiesta non consentita.");
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "Il file supera il limite di 3 MB.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Richiesta troppo grande.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function form(request: Request, limit = 8192) {
  const bytes = await boundedBody(request, limit);
  try {
    return await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new HttpError(400, "Dati non validi.");
  }
}
export function text(form: FormData, key: string, max: number) {
  const value = form.get(key);
  if (typeof value !== "string" || value.length > max)
    throw new HttpError(400, "Dati non validi.");
  return value;
}
export function safeFilename(name: string) {
  return (
    Array.from(name.toWellFormed().replace(/[\\/\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "_")).slice(0, 180).join('') || "documento"
  );
}
export function disposition(name: string) {
  const safe = safeFilename(name);
  const fallback = safe.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
