import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@vercel/firewall";
import {
  adminVersion,
  origin,
  HttpError,
  readSession,
  type Session,
  ID_RE,
} from "./security";
import { getAdminSession } from './store';
export const ADMIN_COOKIE = "dd_admin";
export function shareCookie(id: string) {
  return `dd_share_${id}`;
}
export async function adminSession(token: string | undefined): Promise<Session | null> {
  const claim = readSession(token, {
      kind: "admin",
      version: adminVersion(),
  });
  if (!claim?.sessionId || !ID_RE.test(claim.sessionId)) return null;
  const stored = await getAdminSession(claim.sessionId);
  if (!stored || stored.expiresAt <= Date.now() || stored.expiresAt !== claim.exp || stored.version !== claim.version) return null;
  return claim;
}
export async function requireAdmin(request: NextRequest) {
  const session = await adminSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!session)
    throw new HttpError(401, "Accedi per continuare.");
  return session;
}
export function allowedShare(
  request: NextRequest,
  share: { id: string; version: string; passwordHash: string },
) {
  return (
    !share.passwordHash ||
    !!readSession(request.cookies.get(shareCookie(share.id))?.value, {
      kind: "share",
      version: share.version,
      id: share.id,
    })
  );
}
export function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  exp: number,
  path = "/",
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path,
    expires: new Date(exp),
  });
}
export async function rateLimit(request: NextRequest, target?: string) {
  // Il WAF mantiene i contatori fuori dalle istanze serverless. In locale nessuna garanzia equivalente.
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") return;
  const id = process.env.WAF_RATE_LIMIT_ID;
  if (!id) throw new HttpError(503, "Protezione accessi non configurata.");
  try {
    // The SDK forwards headers to its API: do not forward app cookies, credentials
    // or arbitrary client-controlled routing headers.
    const headers = new Headers({host: new URL(origin()).host});
    for (const name of ['x-real-ip','x-forwarded-for']) {
      const value = request.headers.get(name);
      if (value) headers.set(name,value);
    }
    const result = await checkRateLimit(id, {
      request: new Request(request.url, { headers }),
      timeout: 1000,
    });
    validateRateLimit(result);
    if (target) {
      const scoped = await checkRateLimit(process.env.WAF_TARGET_RATE_LIMIT_ID || id, {
        request: new Request(request.url, {headers}),
        rateLimitKey: `deepdrop:${target}`, timeout: 1000,
      });
      validateRateLimit(scoped);
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      503,
      "Protezione accessi temporaneamente non disponibile.",
    );
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(
    "[DeepDrop] Operazione fallita",
    e instanceof Error ? e.name : "Unknown",
  );
  return json(
    {
      error:
        "Servizio temporaneamente non disponibile. Verifica la configurazione o riprova.",
    },
    503,
  );
}

export function validateRateLimit(result: {
  rateLimited: boolean;
  error?: string;
}) {
  if (result.error)
    throw new HttpError(503, "Protezione accessi non disponibile.");
  if (result.rateLimited)
    throw new HttpError(429, "Troppi tentativi. Riprova tra qualche minuto.");
}
