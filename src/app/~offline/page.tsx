import Link from "next/link";

export const dynamic = "force-static";

export default function OfflineFallbackPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Offline</p>
      <h1 className="font-display text-2xl text-slate-900">This page is not on this device yet</h1>
      <p className="text-sm leading-6 text-slate-600">
        Society Records can open screens you already visited. Open the office system once while online
        (or on the society LAN), then those lists stay available if the internet drops.
      </p>
      <p className="text-sm leading-6 text-slate-600">
        Transfers cannot be completed offline. Finance notes you save on this device will post when the
        line is back.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white"
        >
          Try dashboard
        </Link>
        <Link
          href="/offline/pending"
          className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-800"
        >
          Offline queue
        </Link>
      </div>
    </main>
  );
}
