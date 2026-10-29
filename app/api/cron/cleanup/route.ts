import { timingSafeEqual } from "node:crypto";
import { json, errorResponse } from "@/lib/http";
import { cleanup } from "@/lib/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return json({ error: "Non autorizzato." }, 401);
  try {
    return json({ deleted: await cleanup() });
  } catch (e) {
    return errorResponse(e);
  }
}
