import type { PublishingDraft } from '../../src/publishing/draft';
import type { Attempt, MediaDescriptor, MediaRole } from './protocol';

export interface DraftRecord {
  id: string;
  revision: number;
  updated: number;
  draft: PublishingDraft;
  files: MediaDescriptor[];
  importKey?: string;
  importedAt?: number;
  lastAttempt?: Attempt;
}
const queues = 'drafts';
const media = 'media';
const preferences = 'preferences';
let openDatabase: Promise<IDBDatabase> | undefined;
function notifyQueue() {
  const channel = new BroadcastChannel('zhiflow-publisher');
  channel.postMessage('updated');
  channel.close();
}

function db() {
  if (!openDatabase) {
    openDatabase = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('zhiflow-publishing', 1);
      req.onupgradeneeded = () => {
        const drafts = req.result.createObjectStore(queues, { keyPath: 'id' });
        drafts.createIndex('importKey', 'importKey', { unique: true });
        req.result.createObjectStore(media);
        req.result.createObjectStore(preferences);
      };
      req.onerror = () => { openDatabase = undefined; reject(req.error); };
      req.onsuccess = () => {
        req.result.onversionchange = () => { req.result.close(); openDatabase = undefined; };
        resolve(req.result);
      };
    });
  }
  return openDatabase;
}

function get<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => Promise<T>) {
  const tx = (await db()).transaction(stores, mode);
  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('本地保存未完成'));
  });
  try {
    const [result] = await Promise.all([run(tx), finished]);
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    throw error;
  }
}

async function requireDraft(tx: IDBTransaction, id: string): Promise<DraftRecord> {
  const record: DraftRecord | undefined = await get(tx.objectStore(queues).get(id));
  if (!record) throw new Error('这份草稿已移除，请刷新列表。');
  return record;
}
export function listDrafts(): Promise<DraftRecord[]> {
  return transaction([queues], 'readonly', async (tx) => {
    const all: DraftRecord[] = await get(tx.objectStore(queues).getAll());
    return all.sort((a,b) => b.updated - a.updated);
  });
}
export function readDraft(id: string) {
  return transaction([queues], 'readonly', (tx) => requireDraft(tx, id));
}
export function importedDraft(key: string): Promise<DraftRecord | undefined> {
  return transaction([queues], 'readonly', tx => get(tx.objectStore(queues).index('importKey').get(key)));
}
export async function createDraft(draft: PublishingDraft, importKey?: string) {
  const record = await transaction([queues,preferences], 'readwrite', async (tx) => {
    const store = tx.objectStore(queues);
    if (importKey) {
      const existing: DraftRecord | undefined = await get(store.index('importKey').get(importKey));
      if (existing) return existing;
    }
    const record: DraftRecord = { id: crypto.randomUUID(), updated: Date.now(), revision: 1, draft, files: [], importKey, importedAt: importKey ? Date.now() : undefined };
    await get(store.add(record));
    if (importKey) await get(tx.objectStore(preferences).put(record.id,'selected'));
    return record;
  });
  if (importKey) notifyQueue();
  return record;
}
function checkRevision(record: DraftRecord, revision: number) {
  if (record.revision !== revision) throw new Error('草稿已在其他窗口更新，请重新读取后再保存。');
}
async function persist(tx: IDBTransaction, record: DraftRecord) {
  record.revision++;
  record.updated = Date.now();
  await get(tx.objectStore(queues).put(record));
  return record;
}
export function updateDraft(id: string, revision: number, draft: PublishingDraft) {
  return transaction([queues, media], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, id);
    checkRevision(record, revision);
    if (record.files.filter(file => file.role === 'image').length + draft.images.length > 30) {
      throw new Error('每份草稿的正文图片和链接合计最多 30 张。');
    }
    record.files = record.files.filter(file => {
      if (file.role === 'image' || !draft[file.role]) return true;
      tx.objectStore(media).delete(file.id);
      return false;
    });
    record.draft = draft;
    return persist(tx, record);
  });
}
export function deleteDraft(id: string, revision: number) {
  return transaction([queues,media], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, id);
    checkRevision(record, revision);
    for (const file of record.files) tx.objectStore(media).delete(file.id);
    await get(tx.objectStore(queues).delete(id));
  });
}
export function markAttempt(attempt: Attempt) {
  return transaction([queues], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, attempt.draftId);
    record.lastAttempt = attempt;
    await get(tx.objectStore(queues).put(record));
  });
}
export function readPreferences<T>(key: string): Promise<T | undefined> {
  return transaction([preferences], 'readonly', (tx) => get(tx.objectStore(preferences).get(key)));
}
export function writePreferences(key: string, value: unknown) {
  return transaction([preferences], 'readwrite', (tx) => get(tx.objectStore(preferences).put(value, key)));
}
function putFile(tx: IDBTransaction, record: DraftRecord, role: MediaRole, file: File) {
  const limit = (role === 'video' ? 512 : 32) * 1024 ** 2;
  if (!file.size || file.size > limit) throw new Error('单个图片限 32 MiB，单个视频限 512 MiB。');
  const group = role === 'video' ? 'video/' : 'image/';
  if (!file.type.startsWith(group)) throw new Error('请选择与素材类型匹配的文件。');
  if (role === 'image' && record.files.filter((entry) => entry.role === role).length + record.draft.images.length >= 30) {
    throw new Error('每份草稿最多包含 30 张正文图片。');
  }
  if (role !== 'image') {
    for (const old of record.files.filter((entry) => entry.role === role)) tx.objectStore(media).delete(old.id);
    record.files = record.files.filter((entry) => entry.role !== role);
    delete record.draft[role];
  }
  const id = crypto.randomUUID();
  tx.objectStore(media).put(file, id);
  record.files.push({ id, role, name: file.name, type: file.type, size: file.size });
}
export function addFiles(id: string, revision: number, role: MediaRole, files: File[]) {
  return transaction([queues,media], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, id);
    checkRevision(record, revision);
    for (const file of files) putFile(tx, record, role, file);
    return persist(tx, record);
  });
}
export async function attachImportedFile(id: string, sourceUrl: string, file: File): Promise<void> {
  await transaction([queues,media], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, id);
    const roles: MediaRole[] = [];
    if (record.draft.images.includes(sourceUrl)) roles.push('image');
    if (record.draft.cover === sourceUrl) roles.push('cover');
    if (record.draft.video === sourceUrl) roles.push('video');
    if (!roles.length) throw new Error('这份草稿未引用此素材。');
    record.draft.images = record.draft.images.filter((url) => url !== sourceUrl);
    for (const role of roles) putFile(tx, record, role, file);
    await persist(tx, record);
  });
  notifyQueue();
}
export function removeFile(id: string, revision: number, fileId: string) {
  return transaction([queues,media], 'readwrite', async (tx) => {
    const record = await requireDraft(tx, id);
    checkRevision(record, revision);
    if (!record.files.some((f) => f.id === fileId)) throw new Error('未找到素材。');
    record.files = record.files.filter((f) => f.id !== fileId);
    tx.objectStore(media).delete(fileId);
    return persist(tx, record);
  });
}
export function readFile(fileId: string): Promise<Blob | undefined> {
  return transaction([media], 'readonly', (tx) => get(tx.objectStore(media).get(fileId)));
}
