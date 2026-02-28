import { get, set, del, keys, createStore } from 'idb-keyval';
import { getUploadUrl } from './api';
import { compressImage } from './compression';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface QueueItem {
  id: string;
  eventId: string;
  blob: Blob;
  fileName: string;
  fileType: string;
  metadata: Record<string, unknown>;
  status: UploadStatus;
  addedAt: number;
  /** mediaId returned by the API after the presigned URL is obtained */
  mediaId?: string;
  errorMessage?: string;
  retries: number;
}

// ---------------------------------------------------------------------------
// IDB store — scoped to upload queue so it does not collide with other stores
// ---------------------------------------------------------------------------

const idbStore = createStore('eventalbum-upload-queue', 'items');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function queueKey(id: string): string {
  return id;
}

async function getAllItems(): Promise<QueueItem[]> {
  const allKeys = await keys<string>(idbStore);
  const items = await Promise.all(allKeys.map((k) => get<QueueItem>(k, idbStore)));
  return (items.filter(Boolean) as QueueItem[]).sort((a, b) => a.addedAt - b.addedAt);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds a file to the IndexedDB-backed upload queue.
 * The file is compressed before storage so the blob is already upload-ready.
 */
export async function addToQueue(
  file: File,
  eventId: string,
  metadata: Record<string, unknown> = {},
): Promise<QueueItem> {
  const compressed = await compressImage(file);
  const id = `${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const item: QueueItem = {
    id,
    eventId,
    blob: compressed,
    fileName: compressed.name,
    fileType: compressed.type,
    metadata,
    status: 'queued',
    addedAt: Date.now(),
    retries: 0,
  };

  await set(queueKey(id), item, idbStore);
  return item;
}

/**
 * Returns all pending (non-done) items for a given event.
 */
export async function getQueueItems(eventId: string): Promise<QueueItem[]> {
  const all = await getAllItems();
  return all.filter((item) => item.eventId === eventId && item.status !== 'done');
}

/**
 * Removes ALL items for a given event from the queue (regardless of status).
 */
export async function clearQueue(eventId: string): Promise<void> {
  const all = await getAllItems();
  const targets = all.filter((item) => item.eventId === eventId);
  await Promise.all(targets.map((item) => del(queueKey(item.id), idbStore)));
}

// ---------------------------------------------------------------------------
// Upload processor
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;

async function uploadItem(item: QueueItem): Promise<void> {
  // Mark as uploading
  await set(queueKey(item.id), { ...item, status: 'uploading' } satisfies QueueItem, idbStore);

  try {
    // 1. Obtain a presigned S3 PUT URL from the backend
    const { uploadUrl, mediaId } = await getUploadUrl(item.eventId, {
      fileType: item.fileType,
      fileSize: item.blob.size,
    });

    // 2. PUT the blob directly to S3 — no Authorization header (presigned URL handles auth)
    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': item.fileType },
      body: item.blob,
    });

    if (!s3Response.ok) {
      throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
    }

    // 3. Persist success
    await set(
      queueKey(item.id),
      { ...item, status: 'done', mediaId } satisfies QueueItem,
      idbStore,
    );
  } catch (err) {
    const retries = item.retries + 1;
    const nextStatus: UploadStatus = retries >= MAX_RETRIES ? 'failed' : 'queued';
    await set(
      queueKey(item.id),
      {
        ...item,
        status: nextStatus,
        retries,
        errorMessage: err instanceof Error ? err.message : String(err),
      } satisfies QueueItem,
      idbStore,
    );
    throw err;
  }
}

/**
 * Processes all queued (and stale uploading) items for an event,
 * running up to MAX_CONCURRENT uploads in parallel.
 * Resolves when every item has reached a terminal state (done or failed).
 */
export async function processQueue(eventId: string): Promise<void> {
  const pending = (await getAllItems()).filter(
    (item) =>
      item.eventId === eventId &&
      (item.status === 'queued' || item.status === 'uploading'),
  );

  if (pending.length === 0) return;

  const queue = [...pending];

  // Returns a worker that repeatedly pulls from the shared queue
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await uploadItem(item).catch(() => {
        // Individual failures are recorded on the item; the worker continues
      });
    }
  }

  // Launch up to MAX_CONCURRENT workers
  const workerCount = Math.min(MAX_CONCURRENT, pending.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
