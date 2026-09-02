/* =========================================================================
   لایه‌ی ذخیره‌سازی محلی (Offline-First) — پورت مستقیم از store.js اصلی.
   دو مسئولیت: کش کامل DB برای بوت آفلاین، و صف عملیات‌نشده (outbox) برای
   sync خودکار وقتی اتصال برگرده. هر دو روی IndexedDB (نه localStorage)
   چون باید بین بستن تب/کشتن اپ دووم بیارن.
   ========================================================================= */

const DB_NAME = "apex_offline_db";
const DB_VERSION = 1;
const STORE_CACHE = "db_cache";
const STORE_OUTBOX = "outbox";

export type OpKind = "create" | "update" | "delete";
export type Entity = "planItem" | "question" | "exam" | "alarm" | "analysisNote";

export interface OutboxOp {
  opId: number;
  userId: string;
  kind: OpKind;
  entity: Entity;
  tempId?: string;
  realId?: string;
  payload?: unknown;
  createdAt: number;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB در دسترس نیست"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const os = db.createObjectStore(STORE_OUTBOX, { keyPath: "opId", autoIncrement: true });
        os.createIndex("by_userId", "userId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("باز کردن IndexedDB شکست خورد"));
  });
  return _dbPromise;
}

async function tx(storeName: string, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function saveDbCache(userId: string | null, dbObj: unknown) {
  if (!userId) return;
  try {
    const store = await tx(STORE_CACHE, "readwrite");
    await new Promise<void>((res, rej) => {
      const r = store.put({ userId, db: dbObj, savedAt: Date.now() });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    console.warn("[Store] ذخیره‌ی کش محلی ناموفق بود:", e);
  }
}

async function loadDbCache(userId: string | null): Promise<any | null> {
  if (!userId) return null;
  try {
    const store = await tx(STORE_CACHE, "readonly");
    return await new Promise((res, rej) => {
      const r = store.get(userId);
      r.onsuccess = () => res(r.result ? r.result.db : null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) {
    console.warn("[Store] خواندن کش محلی ناموفق بود:", e);
    return null;
  }
}

async function clearDbCache(userId: string | null) {
  if (!userId) return;
  try {
    const store = await tx(STORE_CACHE, "readwrite");
    await new Promise<void>((res, rej) => {
      const r = store.delete(userId);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  } catch {
    /* بی‌اهمیت */
  }
}

async function enqueueOp(userId: string, op: Omit<OutboxOp, "opId" | "userId" | "createdAt">) {
  const store = await tx(STORE_OUTBOX, "readwrite");
  return new Promise<number>((res, rej) => {
    const r = store.add({ ...op, userId, createdAt: Date.now() });
    r.onsuccess = () => res(r.result as number);
    r.onerror = () => rej(r.error);
  });
}

async function listOps(userId: string): Promise<OutboxOp[]> {
  const store = await tx(STORE_OUTBOX, "readonly");
  return new Promise((res, rej) => {
    const idx = store.index("by_userId");
    const r = idx.getAll(userId);
    r.onsuccess = () => res(((r.result as OutboxOp[]) || []).sort((a, b) => a.opId - b.opId));
    r.onerror = () => rej(r.error);
  });
}

async function removeOp(opId: number) {
  const store = await tx(STORE_OUTBOX, "readwrite");
  return new Promise<void>((res, rej) => {
    const r = store.delete(opId);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

async function updateOp(opId: number, patch: Partial<OutboxOp>) {
  const store = await tx(STORE_OUTBOX, "readwrite");
  return new Promise((res, rej) => {
    const getR = store.get(opId);
    getR.onsuccess = () => {
      const existing = getR.result;
      if (!existing) {
        res(null);
        return;
      }
      const merged = { ...existing, ...patch };
      const putR = store.put(merged);
      putR.onsuccess = () => res(merged);
      putR.onerror = () => rej(putR.error);
    };
    getR.onerror = () => rej(getR.error);
  });
}

async function countPending(userId: string) {
  const ops = await listOps(userId);
  return ops.length;
}

async function clearOutbox(userId: string) {
  const ops = await listOps(userId);
  const store = await tx(STORE_OUTBOX, "readwrite");
  await Promise.all(
    ops.map(
      (op) =>
        new Promise<void>((res, rej) => {
          const r = store.delete(op.opId);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        })
    )
  );
}

export const Store = {
  saveDbCache,
  loadDbCache,
  clearDbCache,
  enqueueOp,
  listOps,
  removeOp,
  updateOp,
  countPending,
  clearOutbox,
};
