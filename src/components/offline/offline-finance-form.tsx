"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { enqueueOfflineItem } from "@/lib/offline-queue";

export function OfflineFinanceForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={action}
      className={className}
      onSubmit={async (event) => {
        if (navigator.onLine) return;
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const payload: Record<string, string> = {};
        for (const [key, value] of data.entries()) {
          if (typeof value === "string") payload[key] = value;
        }
        const amount = payload.amount || "0";
        await enqueueOfflineItem({
          kind: "finance",
          label: `Finance Rs. ${amount}${payload.reference ? ` · ${payload.reference}` : ""}`,
          payload,
        });
        window.dispatchEvent(new Event("srms-offline-queue"));
        setMessage("Saved on this device — will post when online.");
        router.push("/offline/pending");
      }}
    >
      {message ? (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
      ) : (
        <p className="mb-3 text-xs text-slate-500">
          If the internet drops, this entry is stored on this device. It is not on the society ledger
          until you are online again. Transfers still cannot complete offline.
        </p>
      )}
      {children}
    </form>
  );
}
