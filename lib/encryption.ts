import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('DD01');
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function storageKey(): Buffer {
  const value = process.env.FILE_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('FILE_ENCRYPTION_KEY deve essere una chiave casuale di 32 byte in esadecimale');
  }
  return Buffer.from(value, 'hex');
}

export function shareAuthenticationTag(random: Uint8Array): Buffer {
  const key = createHmac('sha256', storageKey()).update('deepdrop:share-id:v1').digest();
  return createHmac('sha256', key).update(random).digest().subarray(0, 16);
}

// Authenticated encryption binds each object to its exact logical storage path.
// Prevents disclosure and cross-path swapping, not rollback to older ciphertext at the same path.
export function encryptObject(path: string, plaintext: Uint8Array): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', storageKey(), nonce);
  cipher.setAAD(Buffer.from(`deepdrop:v1:${path}`));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
}

export class InvalidCiphertextError extends Error {}

export function decryptObject(path: string, data: Uint8Array): Buffer {
  const key = storageKey();
  const bytes = Buffer.from(data);
  if (bytes.length < MAGIC.length + NONCE_BYTES + TAG_BYTES || !bytes.subarray(0, 4).equals(MAGIC)) {
    throw new InvalidCiphertextError('Oggetto non cifrato o formato non valido');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(4, 16));
  decipher.setAAD(Buffer.from(`deepdrop:v1:${path}`));
  decipher.setAuthTag(bytes.subarray(16, 32));
  try { return Buffer.concat([decipher.update(bytes.subarray(32)), decipher.final()]); }
  catch { throw new InvalidCiphertextError("Autenticazione oggetto fallita"); }
}
