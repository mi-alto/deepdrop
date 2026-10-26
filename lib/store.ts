import { put, get, del, list } from "@vercel/blob";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  unlink,
  rename,
} from "node:fs/promises";
import { join } from "node:path";
import { ID_RE, newId } from "./security";
export type Share = {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  expiresAt: number;
  passwordHash: string;
  version: string;
};
function localDir() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("Store Blob privato non configurato");
  return process.env.LOCAL_STORAGE_DIR || join(process.cwd(), ".deepdrop");
}
function path(id: string, kind: "meta" | "file") {
  if (!ID_RE.test(id)) throw new Error("ID non valido");
  return `deepdrop/${kind}/${id}${kind === "meta" ? ".json" : ""}`;
}
async function write(
  name: string,
  data: Uint8Array | string,
  overwrite = false,
) {
  const dir = localDir();
  if (dir) {
    // Solo sviluppo: non includere dati locali nel bundle delle Functions.
    const target = join(/* turbopackIgnore: true */ dir, name);
    await mkdir(/* turbopackIgnore: true */ join(target, ".."), { recursive: true });
    const temporary = `${target}.${newId()}.tmp`;
    await writeFile(/* turbopackIgnore: true */ temporary, data, { mode: 0o600 });
    await rename(/* turbopackIgnore: true */ temporary, target);
    return;
  }
  await put(name, typeof data === "string" ? data : Buffer.from(data), {
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
      return await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  const result = await get(name, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
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
export async function getShare(id: string): Promise<Share | null> {
  if (!ID_RE.test(id)) return null;
  const data = await read(path(id, "meta"));
  if (!data) return null;
  const share = JSON.parse(Buffer.from(data).toString()) as Share;
  if (
    share.id !== id ||
    !Number.isFinite(share.expiresAt) ||
    !Number.isFinite(share.createdAt) ||
    typeof share.passwordHash !== "string" ||
    typeof share.version !== "string"
  )
    throw new Error("Metadati non validi");
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
export async function deleteShare(id: string) {
  // Tombstone persistente: un errore di rimozione viene ripreso dalla pulizia.
  // Non ripristinare mai un manifesto attivo dopo una revoca.
  const share = await getShare(id);
  if (share)
    await write(
      path(id, "meta"),
      JSON.stringify({ ...share, expiresAt: 0 }),
      true,
    );
  await remove(path(id, "file"));
  await remove(path(id, "meta"));
}
export async function download(id: string) {
  return read(path(id, "file"));
}
export async function listShares(): Promise<Share[]> {
  const dir = localDir();
  let ids: string[] = [];
  if (dir) {
    try {
      ids = (await readdir(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ dir, "deepdrop/meta")))
        .filter((n) => n.endsWith(".json"))
        .map((n) => n.slice(0, -5));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  } else {
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: "deepdrop/meta/",
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
  const shares: Share[] = [];
  // Limita il parallelismo e rileggi metadati correnti, non i dati di list/head.
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map(getShare));
    shares.push(...batch.filter((s): s is Share => s !== null));
  }
  return shares.sort((a, b) => b.createdAt - a.createdAt);
}
export async function cleanup() {
  let count = 0;
  for (const share of await listShares())
    if (share.expiresAt <= Date.now()) {
      await deleteShare(share.id);
      count++;
    }
  return count;
}
