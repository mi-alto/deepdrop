import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adminPath,
  adminVersion,
  boundedBody,
  csrf,
  disposition,
  hashPassword,
  HttpError,
  newId,
  readSession,
  signSession,
  verifyPassword,
} from "../lib/security";
import { validateRateLimit } from "../lib/http";
process.env.SESSION_SECRET = "test-secret-".repeat(5);
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.ADMIN_PATH = "/secret-test";
process.env.ADMIN_PASSWORD_HASH = "test-admin-config";
test("password KDF uses unique salts and accepts only the matching password", async () => {
  const first = await hashPassword("correct-password");
  const second = await hashPassword("correct-password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct-password", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword("anything", "malformed"), false);
});
test("signed cookies reject tampering, expiry, wrong subject and config rotation", () => {
  const session = {
    kind: "share" as const,
    id: newId(),
    version: newId(),
    exp: Date.now() + 60000,
  };
  const token = signSession(session);
  assert.deepEqual(readSession(token, session), session);
  assert.equal(readSession(token + "x", session), null);
  assert.equal(readSession(token, { ...session, id: newId() }), null);
  assert.equal(readSession(token, { ...session, version: newId() }), null);
  assert.equal(readSession(token, { ...session, kind: "admin" }), null);
  assert.equal(readSession(token, session, session.exp), null);
  const secret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "rotated-".repeat(8);
  assert.equal(readSession(token, session), null);
  process.env.SESSION_SECRET = secret;
});
test("admin path change invalidates sessions and reserved paths are rejected", () => {
  const original = process.env.ADMIN_PATH;
  const version = adminVersion();
  process.env.ADMIN_PATH = "/another-path";
  assert.notEqual(adminVersion(), version);
  for (const path of [
    "/admin",
    "/api",
    "/s",
    "/_next",
    "/a/b",
    "https://example.com",
    "/a?x=1",
  ]) {
    process.env.ADMIN_PATH = path;
    assert.throws(adminPath);
  }
  process.env.ADMIN_PATH = original;
  assert.equal(adminPath(), "/secret-test");
});
test("origin protection rejects absent and cross-origin requests", () => {
  assert.throws(() => csrf(new Request("http://localhost:3000")));
  assert.throws(() =>
    csrf(
      new Request("http://localhost:3000", {
        headers: { Origin: "https://attacker.example" },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    csrf(
      new Request("http://localhost:3000", {
        headers: { Origin: "http://localhost:3000" },
      }),
    ),
  );
});
test("untrusted body is bounded even without content length", async () => {
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(9));
      c.enqueue(new Uint8Array(9));
      c.close();
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    boundedBody(request, 10),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
});
test("download disposition cannot inject headers or traverse directories", () => {
  const header = disposition("../evil\\name\r\nX-Test: injected-é.pdf");
  assert.equal(/[\r\n]/.test(header), false);
  assert.ok(!header.includes("../"));
  assert.ok(header.includes("filename*=UTF-8''"));
  assert.ok(header.includes("%C3%A9"));
});
test("WAF missing/blocked rule fails closed; active rate limit is 429", () => {
  assert.throws(
    () => validateRateLimit({ rateLimited: false, error: "not-found" }),
    (e: unknown) => e instanceof HttpError && e.status === 503,
  );
  assert.throws(
    () => validateRateLimit({ rateLimited: false, error: "blocked" }),
    (e: unknown) => e instanceof HttpError && e.status === 503,
  );
  assert.throws(
    () => validateRateLimit({ rateLimited: true }),
    (e: unknown) => e instanceof HttpError && e.status === 429,
  );
  assert.doesNotThrow(() => validateRateLimit({ rateLimited: false }));
});
