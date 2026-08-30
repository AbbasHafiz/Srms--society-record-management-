"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pendingOfflineCount } from "@/lib/offline-queue";
import { syncOfflineQueue } from "@/lib/offline-sync";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshCount() {
    try {
      setPending(await pendingOfflineCount());
    } catch {
      setPending(0);
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCount();
    const onOnline = () => {
      setOnline(true);
      void (async () => {
        const result = await syncOfflineQueue();
        await refreshCount();
        if (result.synced) {
          setNotice(`${result.synced} queued finance ${result.synced === 1 ? "entry" : "entries"} posted.`);
        } else if (result.error) {
          setNotice(result.error);
        }
      })();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("srms-offline-queue", refreshCount);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("srms-offline-queue", refreshCount);
    };
  }, []);

  if (online && pending === 0 && !notice) return null;

  return (
    <div
      className="no-print border-b px-4 py-2 text-sm md:px-8"
      style={{
        background: online ? "#ecfdf5" : "#fff7ed",
        borderColor: online ? "#99f6e4" : "#fed7aa",
        color: online ? "#115e59" : "#9a3412",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>
          {!online
            ? "You are offline. Lists you already opened stay on this device. Transfers cannot be completed until the line is back. Finance entries you save here stay in the queue."
            : notice ||
              (pending
                ? `${pending} item${pending === 1 ? "" : "s"} saved on this device — will post when the server accepts them.`
                : null)}
        </p>
        <Link href="/offline/pending" className="shrink-0 font-medium underline underline-offset-2">
          Offline queue
        </Link>
      </div>
    </div>
  );
}
