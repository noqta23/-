import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export const OWNER_ID = (process.env.OWNER_ID || '7744265362').trim();

export function nowBaghdad(): Date {
  const now = new Date();
  // UTC+3
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
}

export function nowBaghdadStr(fmt: 'full' | 'short' | 'date' | 'minute' = 'full'): string {
  const d = nowBaghdad();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  if (fmt === 'date') return `${yyyy}-${mm}-${dd}`;
  if (fmt === 'short' || fmt === 'minute') return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function normalizeArabic(text: string): string {
  if (!text) return '';
  let s = String(text);
  // Strip tashkeel and tatweel
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g, '');
  s = s.replace(/[إأآٱ]/g, 'ا');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  return s.toLowerCase();
}

export function formatSize(sizeBytes: number): string {
  let s = Number(sizeBytes) || 0;
  for (const unit of ['B', 'KB', 'MB', 'GB']) {
    if (s < 1024) {
      return unit === 'B' ? `${Math.round(s)} ${unit}` : `${s.toFixed(1)} ${unit}`;
    }
    s /= 1024;
  }
  return `${s.toFixed(1)} TB`;
}

export function getFileType(filename: string): string {
  const ext = (filename.includes('.') ? filename.split('.').pop() || '' : '').toLowerCase();
  const types: Record<string, string[]> = {
    pdf: ['pdf'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
    document: ['doc', 'docx', 'txt', 'rtf', 'odt'],
    spreadsheet: ['xls', 'xlsx', 'csv'],
    presentation: ['ppt', 'pptx'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    code: ['py', 'js', 'html', 'css', 'json', 'xml', 'sql'],
  };
  for (const [ftype, exts] of Object.entries(types)) {
    if (exts.includes(ext)) return ftype;
  }
  return 'other';
}

// Database state
let pool: pg.Pool | null = null;
let dbEnabled = false;
let dbInitAttempted = false;

const LOCAL_CACHE_PATH = path.join(process.cwd(), '.nukhaa-local-store.json');
// collection -> docId -> data
const memStore: Record<string, Record<string, any>> = {};

function loadLocalStore() {
  try {
    if (fs.existsSync(LOCAL_CACHE_PATH)) {
      const raw = fs.readFileSync(LOCAL_CACHE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [col, docs] of Object.entries(parsed)) {
          if (docs && typeof docs === 'object') {
            memStore[col] = { ...(docs as Record<string, any>) };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[DB] Could not load local store cache:', err);
  }
}

function saveLocalStore() {
  try {
    fs.writeFileSync(LOCAL_CACHE_PATH, JSON.stringify(memStore, null, 2), 'utf-8');
  } catch (err) {
    // ignore write errors
  }
}

loadLocalStore();

let initDbPromise: Promise<boolean> | null = null;

export async function initDb(): Promise<boolean> {
  if (initDbPromise) return initDbPromise;
  initDbPromise = (async () => {
    dbInitAttempted = true;
    const rawUrl = (process.env.SUPABASE_DB_URL || '').trim();
    if (!rawUrl) {
      console.log('[DB] SUPABASE_DB_URL not set; using local persistent document store.');
      dbEnabled = true;
      return true;
    }

    try {
      pool = new Pool({
        connectionString: rawUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 3500,
      });
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS documents (
            collection TEXT NOT NULL,
            doc_id     TEXT NOT NULL,
            data       JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (collection, doc_id)
          );
          CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents (collection);
        `);
        const res = await client.query('SELECT collection, doc_id, data FROM documents');
        for (const row of res.rows) {
          if (!memStore[row.collection]) memStore[row.collection] = {};
          const pgData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          const localData = memStore[row.collection][row.doc_id];
          memStore[row.collection][row.doc_id] = localData ? { ...pgData, ...localData } : pgData;
        }
        saveLocalStore();
        dbEnabled = true;
        console.log(`[DB] Connected to Supabase Postgres (${res.rows.length} documents preloaded).`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn('[DB] Supabase connection failed, falling back to local document store:', err);
      pool = null;
      dbEnabled = true;
    }
    return dbEnabled;
  })();
  return initDbPromise;
}

export function dbIsEnabled(): boolean {
  return true;
}

export async function dbPing(): Promise<boolean> {
  if (pool) {
    try {
      const res = await pool.query('SELECT 1');
      return res.rowCount !== null && res.rowCount > 0;
    } catch {
      return false;
    }
  }
  return true;
}

export function dbInvalidateCache(collection?: string, docId?: string): void {
  // Since memStore is kept in sync with writes, no-op or reload on next async sync if needed
}

export function dbLoadDoc(collection: string, docId: string): Record<string, any> | null {
  const col = memStore[collection];
  if (!col || !(docId in col)) return null;
  const val = col[docId];
  return val ? JSON.parse(JSON.stringify(val)) : null;
}

export function dbSaveDoc(collection: string, docId: string, data: Record<string, any>): boolean {
  if (!memStore[collection]) memStore[collection] = {};
  const copy = JSON.parse(JSON.stringify(data));
  memStore[collection][docId] = copy;
  saveLocalStore();

  if (pool) {
    pool
      .query(
        `INSERT INTO documents (collection, doc_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (collection, doc_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [collection, String(docId), JSON.stringify(copy)]
      )
      .catch((err) => console.warn(`[DB] Async save error (${collection}/${docId}):`, err));
  }
  return true;
}

export function dbSetDoc(collection: string, docId: string, data: Record<string, any>, merge = false): boolean {
  if (merge) {
    const existing = dbLoadDoc(collection, docId) || {};
    const merged = { ...existing, ...data };
    return dbSaveDoc(collection, docId, merged);
  }
  return dbSaveDoc(collection, docId, data);
}

export function dbDeleteDoc(collection: string, docId: string): boolean {
  if (memStore[collection]) {
    delete memStore[collection][docId];
    saveLocalStore();
  }
  if (pool) {
    pool
      .query('DELETE FROM documents WHERE collection = $1 AND doc_id = $2', [collection, String(docId)])
      .catch((err) => console.warn(`[DB] Async delete error (${collection}/${docId}):`, err));
  }
  return true;
}

export function dbLoadCollection(collection: string): Record<string, Record<string, any>> {
  const col = memStore[collection] || {};
  return JSON.parse(JSON.stringify(col));
}
