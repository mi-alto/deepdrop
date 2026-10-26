import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { rateLimit } from '../lib/http';
import { newShareId, validShareId } from '../lib/security';
import { getShare } from '../lib/store';

test('signed IDs reject forged or noncanonical IDs before storage access', async () => {
  process.env.FILE_ENCRYPTION_KEY = 'b2'.repeat(32);
  process.env.VERCEL = '1';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const id = newShareId();
  assert.equal(validShareId(id), true);
  const forged = Buffer.alloc(32).toString('base64url');
  assert.equal(validShareId(forged), false);
  assert.equal(await getShare(forged), null);
  assert.equal(await getShare('../secret'), null);
  const altered = Buffer.from(id,'base64url'); altered[0] ^= 1;
  assert.equal(validShareId(altered.toString('base64url')), false);
  delete process.env.VERCEL;
});

test('WAF pins destination, strips secrets, limits target separately and fails closed', async () => {
  const originalFetch = globalThis.fetch;
  const env = process.env as Record<string,string|undefined>;
  const oldEnv = env.NODE_ENV;
  env.NODE_ENV = 'production';
  process.env.APP_ORIGIN = 'https://files.example.test';
  process.env.WAF_RATE_LIMIT_ID = 'test-rule';
  const calls: {url:string,headers:Headers}[] = [];
  let status = 204;
  globalThis.fetch = (async (url,options) => {
    calls.push({url:String(url),headers:new Headers(options?.headers)});
    return new Response(null,{status});
  }) as typeof fetch;
  const request = new NextRequest('https://files.example.test/s/test',{headers:{
    host:'attacker.invalid', 'x-forwarded-host':'attacker.invalid',
    cookie:'dd_admin=secret', authorization:'Bearer secret', 'x-real-ip':'192.0.2.1',
  }});
  try {
    await rateLimit(request,'unlock:test');
    assert.equal(calls.length,2);
    for (const call of calls) {
      assert.equal(new URL(call.url).host,'files.example.test');
      assert.equal(call.headers.has('x-rr-cookie'),false);
      assert.equal(call.headers.has('x-rr-authorization'),false);
      assert.equal(call.headers.has('x-rr-x-forwarded-host'),false);
    }
    assert.match(calls[1].headers.get('x-vercel-rate-limit-key')!,/^deepdrop:unlock:test-/);
    assert.notEqual(calls[0].headers.get('x-vercel-rate-limit-key'),calls[1].headers.get('x-vercel-rate-limit-key'));
    process.env.WAF_TARGET_RATE_LIMIT_ID = 'target-rule';
    await rateLimit(request,'unlock:test');
    assert.match(calls[3].url,/target-rule$/);
    delete process.env.WAF_TARGET_RATE_LIMIT_ID;
    status=429; await assert.rejects(rateLimit(request),{status:429});
    status=404; await assert.rejects(rateLimit(request),{status:503});
    status=403; await assert.rejects(rateLimit(request),{status:503});
    globalThis.fetch = async () => {throw new Error('Network unavailable');};
    await assert.rejects(rateLimit(request),{status:503});
    delete process.env.WAF_RATE_LIMIT_ID;
    await assert.rejects(rateLimit(request),{status:503});
  } finally {
    globalThis.fetch=originalFetch;
    if(oldEnv) env.NODE_ENV=oldEnv; else delete env.NODE_ENV;
  }
});
