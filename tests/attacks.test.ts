import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptObject, decryptObject } from '../lib/encryption';
import { createShare, getShare, download, createAdminSession, deleteAdminSession } from '../lib/store';
import { newShareId, newId, adminVersion, signSession, disposition } from '../lib/security';
import { adminSession } from '../lib/http';

process.env.FILE_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_PATH = '/private-test-panel';
process.env.ADMIN_PASSWORD_HASH = 'test-config';

test('storage ciphertext resists disclosure, bit flips, truncation, path swapping and wrong keys', () => {
  const plaintext = Buffer.from('Confidential client delivery');
  const path = `deepdrop/file/${newId()}`;
  const a = encryptObject(path, plaintext);
  const b = encryptObject(path, plaintext);
  assert.notDeepEqual(a, b, 'A fresh nonce is used for every write');
  assert.equal(a.includes(plaintext), false);
  assert.deepEqual(decryptObject(path, a), plaintext);
  const damaged = Buffer.from(a); damaged[damaged.length-1] ^= 1;
  assert.throws(() => decryptObject(path, damaged));
  assert.throws(() => decryptObject(path, a.subarray(0,a.length-1)));
  assert.throws(() => decryptObject(`${path}-another`, a));
  assert.throws(() => decryptObject(path, plaintext), /non cifrato/);
  const original = process.env.FILE_ENCRYPTION_KEY;
  process.env.FILE_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  assert.throws(() => decryptObject(path, a));
  process.env.FILE_ENCRYPTION_KEY = original;
});

test('missing or malformed encryption keys fail closed', () => {
  const original = process.env.FILE_ENCRYPTION_KEY;
  for (const key of ['', 'password', 'g'.repeat(64)]) {
    process.env.FILE_ENCRYPTION_KEY = key;
    assert.throws(() => encryptObject('test',Buffer.from('secret')));
  }
  process.env.FILE_ENCRYPTION_KEY = original;
});

test('corrupt metadata cannot remove a password or substitute another share', async () => {
  const dir = await mkdtemp(join(tmpdir(),'deepdrop-attacks-'));
  process.env.LOCAL_STORAGE_DIR = dir;
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN;
  const a = {id:newShareId(),filename:'secret.zip',size:6,createdAt:Date.now(),expiresAt:Date.now()+60000,passwordHash:'',version:newId()};
  const b = {...a,id:newShareId()};
  try {
    await createShare(a,Buffer.from('secret')); await createShare(b,Buffer.from('secret'));
    const file = join(dir,'deepdrop/meta',`${a.id}.json`);
    const original = await readFile(file);
    assert.equal(original.includes(Buffer.from('secret.zip')), false, 'Metadata is encrypted too');
    await writeFile(file,JSON.stringify(a));
    await assert.rejects(getShare(a.id), /Oggetto privato non valido/);
    await writeFile(file,await readFile(join(dir,'deepdrop/meta',`${b.id}.json`)));
    await assert.rejects(getShare(a.id));
    // Even an authenticated envelope with malformed metadata is rejected by the schema.
    await writeFile(file,encryptObject(`deepdrop/meta/${a.id}.json`,Buffer.from(JSON.stringify({...a,passwordHash:null}))));
    await assert.rejects(getShare(a.id), /Oggetto privato non valido/);
    await writeFile(file,original);
    const payloadFile = join(dir,'deepdrop/file',a.id);
    const bytes = await readFile(payloadFile); bytes[bytes.length-1] ^= 1;
    await writeFile(payloadFile,bytes);
    await assert.rejects(download(a.id));
  } finally { delete process.env.LOCAL_STORAGE_DIR; await rm(dir,{recursive:true,force:true}); }
});

test('admin session registry rejects replay after logout, absent registry and expired records', async () => {
  const dir = await mkdtemp(join(tmpdir(),'deepdrop-sessions-'));
  process.env.LOCAL_STORAGE_DIR = dir;
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN;
  const sid = newId(); const exp = Date.now()+60000; const version = adminVersion();
  const token = signSession({kind:'admin',exp,version,sessionId:sid});
  try {
    assert.equal(await adminSession(token),null);
    await createAdminSession({id:sid,expiresAt:exp,version});
    assert.equal((await adminSession(token))?.sessionId,sid);
    await deleteAdminSession(sid);
    assert.equal(await adminSession(token),null);
    const old = signSession({kind:'admin',exp,version});
    assert.equal(await adminSession(old),null,'Legacy stateless admin cookies fail closed');
    await createAdminSession({id:sid,expiresAt:Date.now()-1000,version});
    assert.equal(await adminSession(token),null);
  } finally { delete process.env.LOCAL_STORAGE_DIR; await rm(dir,{recursive:true,force:true}); }
});

test('long Unicode filenames cannot split surrogates or inject response headers', () => {
  assert.doesNotThrow(() => disposition('a'.repeat(179)+'😀.zip'));
  const value = disposition('invoice\u202efdp.exe\r\nX-Injected: true');
  assert.equal(/[\r\n\u202e]/.test(value),false);
});
