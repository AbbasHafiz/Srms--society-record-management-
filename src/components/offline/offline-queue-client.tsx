"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listOfflineQueue, removeOfflineItem, type OfflineQueueItem } from "@/lib/offline-queue";
import { syncOfflineQueue } from "@/lib/offline-sync";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PK");
  } catch {
    return iso;
  }
}

export function OfflineQueueClient() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  async function reload() {
    setItems(await listOfflineQueue());
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void reload();
    const onChange = () => void reload();
    const onOnline = () => {
      setOnline(true);
      void reload();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("srms-offline-queue", onChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("srms-offline-queue", onChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function syncNow() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await syncOfflineQueue();
      await reload();
      window.dispatchEvent(new Event("srms-offline-queue"));
      if (result.synced && !result.failed) {
        setMessage(`${result.synced} posted to the ledger.`);
      } else if (result.failed) {
        setMessage(result.error || "Some items could not sync.");
      } else {
        setMessage(result.error || "Nothing to sync.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
        {message ? <p className="mb-3 text-teal-800">{message}</p> : null}
        Nothing waiting on this device. Finance entries saved while offline will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void syncNow()} disabled={busy || !online}>
          {busy ? "Syncing…" : "Sync now"}
        </Button>
        {!online ? (
          <p className="self-center text-xs text-amber-800">Connect to the society server to post these.</p>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">
                {item.kind} · {formatWhen(item.createdAt)}
                {item.status === "failed" ? ` · ${item.error}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await removeOfflineItem(item.id);
                window.dispatchEvent(new Event("srms-offline-queue"));
                await reload();
              }}
            >
              Discard
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
