import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createShare,
  getShare,
  deleteShare,
  download,
  listShares,
  cleanup,
  type Share,
} from "../lib/store";
import { newShareId, newId } from "../lib/security";
process.env.FILE_ENCRYPTION_KEY = 'a7'.repeat(32);
test("private storage lifecycle, expiry cleanup and resumable revocation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deepdrop-unit-"));
  process.env.LOCAL_STORAGE_DIR = dir;
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const share: Share = {
    id: newShareId(),
    filename: "report.pdf",
    size: 4,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
    passwordHash: "",
    version: newId(),
  };
  try {
    await createShare(share, new Uint8Array([1, 2, 3, 4]));
    assert.deepEqual(await getShare(share.id), share);
    assert.equal((await download(share.id))?.length, 4);
    assert.equal((await listShares()).length, 1);
    assert.equal(await getShare("../secret"), null);
    // Simula un errore storage durante l'eliminazione del file.
    const file = join(dir, "deepdrop/file", share.id);
    await unlink(file);
    await mkdir(file);
    await assert.rejects(deleteShare(share.id));
    assert.equal((await getShare(share.id))?.expiresAt, 0);
    await rm(file, { recursive: true });
    await cleanup();
    assert.equal(await getShare(share.id), null);
    assert.equal((await listShares()).length, 0);
    const expired = { ...share, id: newShareId(), expiresAt: Date.now() - 1 };
    await createShare(expired, new Uint8Array([4]));
    assert.equal(await cleanup(), 1);
    assert.equal(await download(expired.id), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
    delete process.env.LOCAL_STORAGE_DIR;
  }
});
test("missing private Blob configuration never falls back on Vercel", async () => {
  const original = process.env.VERCEL;
  process.env.VERCEL = "1";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await assert.rejects(
      getShare(newShareId()),
      /Store Blob privato non configurato/,
    );
  } finally {
    if (original) process.env.VERCEL = original;
    else delete process.env.VERCEL;
  }
});
