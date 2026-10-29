// Shared by the browser and server. Each request stays below Vercel's 4.5 MB limit.
export const CHUNK_SIZE = 3 * 1024 * 1024;
export const MAX_FILE = 250 * 1024 * 1024;
export const UPLOAD_TTL = 60 * 60 * 1000;
