import { put, get, del, list } from "@vercel/blob";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  unlink,
  rename,
  link,
} from "node:fs/promises";
import { join } from "node:path";
import { ID_RE, SHARE_ID_RE, validShareId, MAX_FILE, isPasswordHash, newId } from "./security";
import { encryptObject, decryptObject, InvalidCiphertextError } from './encryption';
import { CHUNK_SIZE, UPLOAD_TTL } from './transfer';
import { HttpError } from './security';
export type Share = {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  expiresAt: number;
  passwordHash: string;
  version: string;
  chunkCount?: number;
  uploadExpiresAt?: number;
  pending?: boolean;
};
export class CorruptObjectError extends Error {
  constructor() { super('Oggetto privato non valido'); this.name = 'CorruptObjectError'; }
}
function decrypt(name: string, bytes: Uint8Array) {
  try { return decryptObject(name, bytes); }
  catch (error) { if (error instanceof InvalidCiphertextError) throw new CorruptObjectError(); throw error; }
}
function localDir() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("Store Blob privato non configurato");
  return process.env.LOCAL_STORAGE_DIR || join(process.cwd(), ".deepdrop");
}
function path(id: string, kind: "meta" | "file" | "session") {
  if (!(kind === 'session' ? ID_RE : SHARE_ID_RE).test(id)) throw new Error("ID non valido");
  return `deepdrop/${kind}/${id}${kind === "file" ? "" : ".json"}`;
}
async function write(
  name: string,
  data: Uint8Array | string,
  overwrite = false,
) {
  const encrypted = encryptObject(name, typeof data === 'string' ? Buffer.from(data) : data);
  const dir = localDir();
  if (dir) {
    // Solo sviluppo: non includere dati locali nel bundle delle Functions.
    const target = join(/* turbopackIgnore: true */ dir, name);
    await mkdir(/* turbopackIgnore: true */ join(target, ".."), { recursive: true });
    const temporary = `${target}.${newId()}.tmp`;
    await writeFile(/* turbopackIgnore: true */ temporary, encrypted, { mode: 0o600 });
    try {
      if (overwrite) await rename(/* turbopackIgnore: true */ temporary, target);
      else await link(/* turbopackIgnore: true */ temporary, target);
    } finally {
      await unlink(/* turbopackIgnore: true */ temporary).catch(() => {});
    }
    return;
  }
  await put(name, encrypted, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    contentType: "application/octet-stream",
  });
}
async function read(name: string): Promise<Uint8Array | null> {
  const dir = localDir();
  if (dir) {
    try {
      return decrypt(name, await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, name)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  const result = await get(name, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return decrypt(name, new Uint8Array(await new Response(result.stream).arrayBuffer()));
}
async function remove(name: string) {
  const dir = localDir();
  if (dir) {
    try {
      await unlink(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return;
  }
  await del(name);
}
export async function getShare(id: string, includePending = false): Promise<Share | null> {
  if (!validShareId(id)) return null;
  const data = await read(path(id, "meta"));
  if (!data) return null;
  let share: Share;
  try { share = JSON.parse(Buffer.from(data).toString()) as Share; }
  catch { throw new CorruptObjectError(); }
  if (
    !share || typeof share !== 'object' ||
    share.id !== id ||
    !Number.isSafeInteger(share.expiresAt) || share.expiresAt < 0 ||
    !Number.isSafeInteger(share.createdAt) || share.createdAt <= 0 ||
    !Number.isSafeInteger(share.size) || share.size < 1 || share.size > MAX_FILE ||
    typeof share.filename !== 'string' || !share.filename.length || share.filename.length > 360 ||
    typeof share.passwordHash !== "string" || (share.passwordHash !== '' && !isPasswordHash(share.passwordHash)) ||
    typeof share.version !== "string" || !ID_RE.test(share.version) ||
    (share.chunkCount !== undefined && (
      share.chunkCount !== Math.ceil(share.size / CHUNK_SIZE) ||
      !Number.isSafeInteger(share.uploadExpiresAt) || share.uploadExpiresAt! <= 0
    ))
  )
    throw new CorruptObjectError();
  if (share.chunkCount !== undefined) {
    const complete = await read(completionPath(id));
    share.pending = !complete;
    if (complete && Buffer.from(complete).toString() !== share.version) throw new CorruptObjectError();
    if (share.pending && !includePending) return null;
  }
  return share;
}
export async function createShare(share: Share, bytes: Uint8Array) {
  await write(path(share.id, "file"), bytes);
  try {
    await write(path(share.id, "meta"), JSON.stringify(share));
  } catch (e) {
    await remove(path(share.id, "file")).catch(() => {});
    throw e;
  }
}
function chunkPath(id: string, index: number) {
  if (!validShareId(id) || !Number.isSafeInteger(index) || index < 0 || index >= Math.ceil(MAX_FILE / CHUNK_SIZE))
    throw new HttpError(400, 'Dati non validi.');
  return `deepdrop/chunk/${id}/${index}`;
}
function completionPath(id: string) {
  if (!validShareId(id)) throw new HttpError(400, 'Link non valido.');
  return `deepdrop/complete/${id}`;
}
function partSize(share: Share, index: number) {
  return Math.min(CHUNK_SIZE, share.size - index * CHUNK_SIZE);
}
export async function beginUpload(share: Share) {
  if (!Number.isSafeInteger(share.size) || share.size < 1 || share.size > MAX_FILE)
    throw new HttpError(400, 'Il limite è 250 MB per file.');
  await write(path(share.id, 'meta'), JSON.stringify({
    ...share, chunkCount: Math.ceil(share.size / CHUNK_SIZE),
    uploadExpiresAt: Date.now() + UPLOAD_TTL,
  }));
}
async function pendingUpload(id: string) {
  const share = await getShare(id, true);
  if (!share || !share.pending || share.expiresAt <= Date.now() || share.uploadExpiresAt! <= Date.now())
    throw new HttpError(409, 'Caricamento non disponibile. Riprova.');
  return share;
}
// Immutable objects make retries safe and prevent a late request from changing a published file.
async function writeOnce(name: string, bytes: Uint8Array) {
  try { await write(name, bytes); }
  catch (error) {
    const existing = await read(name);
    if (!existing || !Buffer.from(existing).equals(Buffer.from(bytes))) throw error;
  }
}
export async function uploadPart(id: string, index: number, bytes: Uint8Array) {
  const share = await pendingUpload(id);
  if (!Number.isSafeInteger(index) || index < 0 || index >= share.chunkCount! || bytes.length !== partSize(share, index))
    throw new HttpError(400, 'Dimensione della parte non valida.');
  await writeOnce(chunkPath(id, index), bytes);
}
export async function completeUpload(id: string) {
  const existing = await getShare(id);
  if (existing && existing.expiresAt > Date.now()) return existing;
  const share = await pendingUpload(id);
  for (let i = 0; i < share.chunkCount!; i++) {
    const bytes = await read(chunkPath(id, i));
    if (!bytes || bytes.length !== partSize(share, i))
      throw new HttpError(409, 'Caricamento incompleto. Riprova.');
  }
  await pendingUpload(id);
  await writeOnce(completionPath(id), Buffer.from(share.version));
  const ready = await getShare(id);
  if (!ready || ready.expiresAt <= Date.now()) throw new HttpError(409, 'Caricamento non disponibile. Riprova.');
  return ready;
}
export async function downloadStream(share: Share) {
  const readPart = async (index: number) => {
    const current = await getShare(share.id);
    if (!current || current.expiresAt <= Date.now() || current.version !== share.version)
      throw new HttpError(404, 'Questo link non è più disponibile.');
    const bytes = await read(chunkPath(share.id, index));
    if (!bytes || bytes.length !== partSize(share, index)) throw new CorruptObjectError();
    return new Uint8Array(bytes);
  };
  // Authenticate the first part before sending HTTP headers. Each later part is
  // authenticated in full before any of its plaintext is emitted (bounded memory).
  let first: Uint8Array | null = await readPart(0);
  let index = 0;
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const bytes = first ?? await readPart(index);
        first = null;
        if (cancelled) return;
        controller.enqueue(bytes);
        if (++index === share.chunkCount) controller.close();
      } catch (error) { if (!cancelled) controller.error(error); }
    },
    cancel() { cancelled = true; first = null; },
  }, { highWaterMark: 0 });
}
export async function deleteShare(id: string) {
  // Tombstone persistente: un errore di rimozione viene ripreso dalla pulizia.
  // Non ripristinare mai un manifesto attivo dopo una revoca.
  let share: Share | null;
  try { share = await getShare(id, true); }
  catch (error) {
    if (!(error instanceof CorruptObjectError)) throw error;
    share = null; // Already inaccessible: allow the administrator to remove it.
  }
  if (share)
    await write(
      path(id, "meta"),
      JSON.stringify({ ...share, expiresAt: 0 }),
      true,
    );
  // Wait for requests already in flight before sweeping an abandoned upload.
  if (share?.pending && share.uploadExpiresAt! + 300_000 > Date.now()) return false;
  if (share?.chunkCount) {
    for (let i = 0; i < share.chunkCount; i++) await remove(chunkPath(id, i));
    await remove(completionPath(id));
  }
  await remove(path(id, "file"));
  await remove(path(id, "meta"));
  return true;
}
export async function download(id: string) {
  return read(path(id, "file"));
}
async function listIds(kind: 'meta' | 'session'): Promise<string[]> {
  const dir = localDir();
  let ids: string[] = [];
  if (dir) {
    try {
      ids = (await readdir(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, `deepdrop/${kind}`)))
        .filter((n) => n.endsWith(".json"))
        .map((n) => n.slice(0, -5));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  } else {
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: `deepdrop/${kind}/`,
        cursor,
        limit: 1000,
      });
      ids.push(
        ...page.blobs.map((b) =>
          b.pathname
            .split("/")
            .pop()!
            .replace(/\.json$/, ""),
        ),
      );
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
  return ids.filter(id => (kind === 'meta' ? SHARE_ID_RE : ID_RE).test(id));
}
export async function listShares(includePending = false): Promise<Share[]> {
  const ids = await listIds('meta');
  const shares: Share[] = [];
  // Limita il parallelismo e rileggi metadati correnti, non i dati di list/head.
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.allSettled(ids.slice(i, i + 10).map(id => getShare(id, includePending)));
    for (const result of batch) {
      if (result.status === 'fulfilled') { if (result.value) shares.push(result.value); }
      else if (result.reason instanceof CorruptObjectError) console.warn('[DeepDrop] Oggetto corrotto isolato: verificare lo store.');
      else throw result.reason;
    }
  }
  return shares.sort((a, b) => b.createdAt - a.createdAt);
}
export async function cleanup() {
  let count = 0;
  let failed = false;
  for (const share of await listShares(true)) {
    if (share.expiresAt <= Date.now() || (share.pending && share.uploadExpiresAt! + 300_000 <= Date.now())) {
      try { if (await deleteShare(share.id)) count++; }
      catch { failed = true; }
    }
  }
  for (const id of await listIds('session')) {
    try {
      const session = await getAdminSession(id);
      if (session && session.expiresAt <= Date.now()) await deleteAdminSession(id);
    } catch { failed = true; }
  }
  // Finish independent work, but report failure so operators know to retry.
  if (failed) throw new Error('Pulizia incompleta: verificare lo store e riprovare');
  return count;
}

export type AdminSession = { id: string; expiresAt: number; version: string };
export async function createAdminSession(session: AdminSession) {
  await write(path(session.id, 'session'), JSON.stringify(session));
}
export async function getAdminSession(id: string): Promise<AdminSession | null> {
  if (!ID_RE.test(id)) return null;
  const data = await read(path(id, 'session'));
  if (!data) return null;
  let record: AdminSession;
  try { record = JSON.parse(Buffer.from(data).toString()) as AdminSession; }
  catch { throw new CorruptObjectError(); }
  if (!record || record.id !== id || !Number.isSafeInteger(record.expiresAt) || typeof record.version !== 'string') throw new CorruptObjectError();
  return record;
}
export async function deleteAdminSession(id: string) {
  await remove(path(id, 'session'));
}
