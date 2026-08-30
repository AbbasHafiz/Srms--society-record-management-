import {
  listOfflineQueue,
  markOfflineItemFailed,
  removeOfflineItem,
  type OfflineQueueItem,
} from "@/lib/offline-queue";

async function syncOne(item: OfflineQueueItem): Promise<void> {
  if (item.kind !== "finance") {
    throw new Error("This queued item cannot be synced automatically.");
  }
  const res = await fetch("/api/offline/sync/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item.payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    if (res.status === 401) {
      throw new Error("Connect to sign in again before syncing the queue.");
    }
    throw new Error(data.error || `Sync failed (${res.status})`);
  }
  await removeOfflineItem(item.id);
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number; error?: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, error: "Still offline." };
  }
  const items = await listOfflineQueue();
  let synced = 0;
  let failed = 0;
  let error: string | undefined;
  for (const item of items) {
    try {
      await syncOne(item);
      synced += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Sync failed";
      error = message;
      await markOfflineItemFailed(item.id, message);
    }
  }
  return { synced, failed, error };
}
