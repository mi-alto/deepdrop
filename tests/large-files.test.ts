import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beginUpload, uploadPart, completeUpload, getShare, listShares, downloadStream, deleteShare, cleanup, type Share } from '../lib/store';
import { newId, newShareId } from '../lib/security';
import { CHUNK_SIZE, MAX_FILE, UPLOAD_TTL } from '../lib/transfer';

process.env.FILE_ENCRYPTION_KEY = 'b1'.repeat(32);
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

test('chunk uploads are private, bounded, immutable, authenticated and revocable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'deepdrop-chunks-'));
  process.env.LOCAL_STORAGE_DIR = dir;
  const makeShare = (size: number): Share => ({
    id: newShareId(), filename: 'large.zip', size, createdAt: Date.now(),
    expiresAt: Date.now() + 86_400_000, version: newId(), passwordHash: '',
  });
  try {
    await assert.rejects(beginUpload(makeShare(MAX_FILE + 1)), /250 MB/);
    await assert.rejects(beginUpload(makeShare(0)), /250 MB/);
    const share = makeShare(CHUNK_SIZE + 17);
    await beginUpload(share);
    assert.equal(await getShare(share.id), null);
    assert.equal((await listShares()).length, 0);
    await assert.rejects(completeUpload(share.id), /incompleto/);
    await assert.rejects(uploadPart(share.id, -1, new Uint8Array(17)), /non valida/);
    await assert.rejects(uploadPart(share.id, 2, new Uint8Array(17)), /non valida/);
    await assert.rejects(uploadPart(share.id, 0, new Uint8Array(17)), /non valida/);
    const first = Buffer.alloc(CHUNK_SIZE, 0x53), last = Buffer.alloc(17, 0x71);
    await uploadPart(share.id, 0, first);
    await uploadPart(share.id, 0, first); // Lost response, identical retry.
    await assert.rejects(uploadPart(share.id, 0, Buffer.alloc(CHUNK_SIZE, 0x42)));
    await uploadPart(share.id, 1, last);
    const stored = await readFile(join(dir, 'deepdrop/chunk', share.id, '0'));
    assert.equal(stored.subarray(0, 4).toString(), 'DD01');
    assert.equal(stored.includes(first.subarray(0, 100)), false);
    const ready = await completeUpload(share.id);
    assert.equal(ready.pending, false);
    assert.deepEqual(await completeUpload(share.id), ready);
    await assert.rejects(uploadPart(share.id, 1, last), /non disponibile/);
    const stream = await downloadStream(ready);
    assert.deepEqual(Buffer.from(await new Response(stream).arrayBuffer()), Buffer.concat([first, last]));

    // An authenticated first chunk must not mask corruption in a later chunk.
    const lastPath = join(dir, 'deepdrop/chunk', share.id, '1');
    const encrypted = await readFile(lastPath);
    const damaged = Buffer.from(encrypted); damaged[32] ^= 1;
    await writeFile(lastPath, damaged);
    const corrupted = (await downloadStream(ready)).getReader();
    assert.deepEqual(Buffer.from((await corrupted.read()).value!), first);
    await assert.rejects(corrupted.read());
    await writeFile(lastPath, encrypted);

    const interrupted = (await downloadStream(ready)).getReader();
    await interrupted.read();
    await deleteShare(share.id);
    await assert.rejects(interrupted.read(), /disponibile/);
    assert.equal(await getShare(share.id), null);
    await assert.rejects(readFile(lastPath), { code: 'ENOENT' });

    const abandoned = makeShare(17);
    await beginUpload(abandoned);
    await uploadPart(abandoned.id, 0, last);
    await deleteShare(abandoned.id);
    await assert.rejects(completeUpload(abandoned.id), /non disponibile/);
    const timedOut = makeShare(17);
    await beginUpload(timedOut);
    await uploadPart(timedOut.id, 0, last);
    assert.equal(await cleanup(), 0, 'An aborted upload waits for in-flight writes');
    const originalNow = Date.now;
    const future = originalNow() + UPLOAD_TTL + 300_001;
    Date.now = () => future;
    try {
      await assert.rejects(completeUpload(timedOut.id), /non disponibile/);
      assert.equal(await cleanup(), 2);
    } finally { Date.now = originalNow; }
    assert.equal(await getShare(abandoned.id, true), null);
    assert.equal(await getShare(timedOut.id, true), null);
    await assert.rejects(readFile(join(dir, 'deepdrop/chunk', abandoned.id, '0')), { code: 'ENOENT' });
  } finally {
    delete process.env.LOCAL_STORAGE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
