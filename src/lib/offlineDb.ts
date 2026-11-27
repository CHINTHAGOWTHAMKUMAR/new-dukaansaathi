import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AIInsightReport, Language, ShopSnapshot, SyncOperation } from '../types';

interface DukaanDBSchema extends DBSchema {
  snapshots: {
    key: string;
    value: ShopSnapshot;
  };
  outbox: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-shop': string };
  };
  insights: {
    key: string;
    value: AIInsightReport;
  };
  prefs: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<DukaanDBSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DukaanDBSchema>('dukaansaathi-offline-v1', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'shop.id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'opId' });
          outboxStore.createIndex('by-shop', 'shopId');
        }
        if (!db.objectStoreNames.contains('insights')) {
          db.createObjectStore('insights', { keyPath: 'shopId' });
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSnapshotLocal(snapshot: ShopSnapshot): Promise<void> {
  const db = await getDb();
  await db.put('snapshots', snapshot);
}

export async function getSnapshotLocal(shopId: string): Promise<ShopSnapshot | undefined> {
  const db = await getDb();
  return db.get('snapshots', shopId);
}

export async function enqueueOutboxOp(op: SyncOperation): Promise<void> {
  const db = await getDb();
  await db.put('outbox', op);
}

export async function getOutboxForShop(shopId: string): Promise<SyncOperation[]> {
  const db = await getDb();
  return db.getAllFromIndex('outbox', 'by-shop', shopId);
}

export async function removeOutboxOps(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  for (const id of opIds) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function saveInsightLocal(report: AIInsightReport): Promise<void> {
  const db = await getDb();
  await db.put('insights', report);
}

export async function getInsightLocal(shopId: string): Promise<AIInsightReport | undefined> {
  const db = await getDb();
  return db.get('insights', shopId);
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    const row = await db.get('prefs', key);
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put('prefs', { key, value });
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export async function getSavedLanguage(): Promise<Language> {
  return getPref<Language>('language', 'en');
}

export async function saveLanguage(lang: Language): Promise<void> {
  return setPref('language', lang);
}
