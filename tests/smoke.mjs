import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Exercise real routes with disposable local storage. No Vercel credentials required.
const storage = await mkdtemp(join(tmpdir(), 'deepdrop-smoke-'));
const listener = createServer();
await new Promise((resolve, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', resolve);
});
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const admin = '/test-private-door';
const password = randomBytes(20).toString('hex');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const cronSecret = randomBytes(32).toString('hex');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: {
    ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    VERCEL: '', BLOB_READ_WRITE_TOKEN: '', BLOB_STORE_ID: '', VERCEL_OIDC_TOKEN: '',
    ADMIN_PATH: admin, APP_ORIGIN: origin, ADMIN_PASSWORD_HASH: hash,
    SESSION_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: cronSecret,
    LOCAL_STORAGE_DIR: storage,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', b => { output = (output + b).slice(-16000); });
child.stderr.on('data', b => { output = (output + b).slice(-16000); });
function cookie(response) { return response.headers.getSetCookie().map(v => v.split(';')[0]).join('; '); }
async function request(path, options = {}) {
  return fetch(`${origin}${path}`, { redirect: 'manual', ...options });
}
async function expectStatus(response, status, description) {
  assert.equal(response.status, status, `${description}: ${await response.clone().text()}`);
  return response;
}
function form(values) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.append(key, value);
  return body;
}
const payload = Buffer.from('PK\u0003\u0004DeepDrop private delivery test\n');
async function upload(adminCookie, sharePassword = '') {
  const body = form({ hours: '24', password: sharePassword });
  body.append('file', new Blob([payload]), 'consegna-à.zip');
  const response = await expectStatus(await request(`${admin}/api/shares`, {
    method: 'POST', headers: { Origin: origin, Cookie: adminCookie }, body,
  }), 201, 'Upload');
  const data = await response.json();
  assert.ok(data.share.id);
  assert.ok(!JSON.stringify(data).includes('passwordHash'));
  assert.ok(!JSON.stringify(data).includes('scrypt:'));
  return data.share;
}

try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error(`Development server exited ${child.exitCode}`);
    try {
      const response = await request('/');
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for startup. */ }
    await delay(500);
  }
  assert.ok(ready, 'Development server starts');
  const home = await request('/');
  assert.ok(!(await home.text()).includes(admin), 'Public homepage does not disclose admin URL');
  await expectStatus(await request('/admin'), 404, 'No default admin alias');
  await expectStatus(await request('/admin123'), 404, 'Default route disabled when customized');
  await expectStatus(await request(`${admin}/api/shares`), 401, 'Listing requires authentication');
  await expectStatus(await request('/admin123/api/shares'), 404, 'Admin APIs honor custom path');
  await expectStatus(await request('/api/cron/cleanup'), 401, 'Cleanup requires secret');
  await expectStatus(await request(`${admin}/api/login`, {
    method: 'POST', body: form({ password }),
  }), 403, 'Login requires same-origin request');
  await expectStatus(await request(`${admin}/api/login`, {
    method: 'POST', headers: { Origin: origin }, body: form({ password: 'wrong' }),
  }), 401, 'Incorrect admin password rejected');
  const login = await expectStatus(await request(`${admin}/api/login`, {
    method: 'POST', headers: { Origin: origin }, body: form({ password }),
  }), 200, 'Admin login');
  const adminCookie = cookie(login);
  assert.match(login.headers.get('set-cookie'), /httponly/i);
  assert.match(login.headers.get('set-cookie'), /samesite=strict/i);
  const tampered = adminCookie.replace(/=./, '=x');
  await expectStatus(await request(`${admin}/api/shares`, { headers: { Cookie: tampered } }), 401, 'Tampered session rejected');
  await expectStatus(await request(`${admin}/api/shares`, {
    method: 'POST', headers: { Origin: 'https://attacker.invalid', Cookie: adminCookie }, body: form({}),
  }), 403, 'Cross-origin upload rejected');

  const protectedShare = await upload(adminCookie, 'client-password-123');
  const downloadPath = `/api/share/${protectedShare.id}/download`;
  await expectStatus(await request(downloadPath), 401, 'Direct download cannot bypass password');
  const unlockPath = `/api/share/${protectedShare.id}/unlock`;
  await expectStatus(await request(unlockPath, { method: 'POST', body: form({ password: 'client-password-123' }) }), 403, 'Unlock origin enforced');
  await expectStatus(await request(unlockPath, {
    method: 'POST', headers: { Origin: origin }, body: form({ password: 'wrong' }),
  }), 401, 'Incorrect share password rejected');
  const unlock = await expectStatus(await request(unlockPath, {
    method: 'POST', headers: { Origin: origin }, body: form({ password: 'client-password-123' }),
  }), 200, 'Unlock');
  const shareCookie = cookie(unlock);
  const file = await expectStatus(await request(downloadPath, { headers: { Cookie: shareCookie } }), 200, 'Authorized download');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), payload);
  assert.match(file.headers.get('cache-control'), /no-store/);
  assert.match(file.headers.get('content-disposition'), /^attachment;/);
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');

  const other = await upload(adminCookie, 'another-password-123');
  await expectStatus(await request(`/api/share/${other.id}/download`, { headers: { Cookie: shareCookie } }), 401, 'Unlock is scoped to one share');
  const listing = await request(`${admin}/api/shares`, { headers: { Cookie: adminCookie } });
  const listingText = await listing.text();
  assert.ok(!listingText.includes('scrypt:') && !listingText.includes('passwordHash'), 'No password verifier exposed');
  await expectStatus(await request(`${admin}/api/shares/${protectedShare.id}`, {
    method: 'DELETE', headers: { Origin: origin, Cookie: adminCookie },
  }), 200, 'Revoke');
  await expectStatus(await request(downloadPath, { headers: { Cookie: shareCookie } }), 404, 'Revocation defeats existing unlock cookie');
  const expiredPath = join(storage, 'deepdrop', 'meta', `${other.id}.json`);
  const expired = JSON.parse(await readFile(expiredPath, 'utf8'));
  expired.expiresAt = Date.now() - 1000;
  await writeFile(expiredPath, JSON.stringify(expired));
  await expectStatus(await request(`/api/share/${other.id}/download`), 404, 'Expired share rejected before password');
  const cleanup = await expectStatus(await request('/api/cron/cleanup', {
    headers: { Authorization: `Bearer ${cronSecret}` },
  }), 200, 'Authenticated cleanup');
  assert.ok((await cleanup.json()).deleted >= 1);
  await assert.rejects(readFile(expiredPath), { code: 'ENOENT' });
  await assert.rejects(readFile(join(storage, 'deepdrop', 'file', other.id)), { code: 'ENOENT' });

  const open = await upload(adminCookie);
  await expectStatus(await request(`/api/share/${open.id}/download`), 200, 'Optional password supported');
  const oversized = form({ hours: '24', password: '' });
  oversized.append('file', new Blob([new Uint8Array(3 * 1024 * 1024 + 70 * 1024)]), 'large.zip');
  await expectStatus(await request(`${admin}/api/shares`, {
    method: 'POST', headers: { Origin: origin, Cookie: adminCookie }, body: oversized,
  }), 413, 'Oversized request rejected');
  const logout = await expectStatus(await request(`${admin}/api/logout`, {
    method: 'POST', headers: { Origin: origin, Cookie: adminCookie },
  }), 200, 'Logout');
  assert.match(logout.headers.get('set-cookie'), /expires=Thu, 01 Jan 1970/i);
  console.log('HTTP smoke: custom admin route, authentication, CSRF, upload, password, download, isolation, revocation, expiry, cleanup and limits passed.');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(storage, { recursive: true, force: true });
}
