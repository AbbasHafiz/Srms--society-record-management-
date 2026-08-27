import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { OpenFileDealerFields } from "@/components/open-files/open-file-dealer-fields";
import { createOpenFile } from "../actions";
import { formatCurrency } from "@/lib/utils";
import { LIVE_OPEN_FILE_STATUSES } from "@/lib/open-files";

export const dynamic = "force-dynamic";

export default async function NewOpenFilePage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/open-files");
  }

  const sp = await searchParams;
  const q = sp.q?.trim();

  const [plots, fee, activeDealerCount] = await Promise.all([
    prisma.plot.findMany({
      where: q
        ? {
            OR: [
              { plotNumber: { contains: q, mode: "insensitive" } },
              { sector: { contains: q, mode: "insensitive" } },
              {
                ownerships: {
                  some: {
                    status: "ACTIVE",
                    OR: [
                      { ownerName: { contains: q, mode: "insensitive" } },
                      { membershipNumber: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : sp.plotId
          ? { id: sp.plotId }
          : undefined,
      include: {
        ownerships: { where: { status: "ACTIVE" }, take: 1 },
        openFiles: {
          where: { status: { in: LIVE_OPEN_FILE_STATUSES } },
          take: 1,
          select: { id: true, openFileNumber: true },
        },
      },
      take: 20,
      orderBy: { plotNumber: "asc" },
    }),
    prisma.feeConfiguration.findFirst({
      where: { feeType: "OPEN_FILE", status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.registeredOffice.count({ where: { status: "ACTIVE" } }),
  ]);

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;
  const owner = selectedPlot?.ownerships[0];
  const existingOpen = selectedPlot?.openFiles[0];

  return (
    <div>
      <PageHeader
        title="Register dealer open file"
        description="Seller wants to sell; a registered dealer issues letterhead and pays the open-file fee to the society as a pay order. This records an open transfer — it does not change ownership."
        actions={
          <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
            ← Open files
          </Link>
        }
      />

      <QueryErrorBanner error={sp.error} />

      {activeDealerCount === 0 ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No active registered dealers on file.{" "}
          <Link href="/offices/new" className="font-medium text-teal-900 underline">
            Register a dealer office
          </Link>{" "}
          before opening a file.
        </div>
      ) : null}

      {!fee ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          No active open-file fee is configured. Ask finance / secretary to set the OPEN_FILE fee
          schedule before registering.
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-600">
          Open-file fee (from current schedule):{" "}
          <strong>{formatCurrency(fee.amount)}</strong>
          {fee.periodMonths ? ` for ${fee.periodMonths} months` : ""} · paid as pay order to the society.
        </p>
      )}

      {!sp.plotId ? (
        <form className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input name="q" placeholder="Search plot, sector, seller…" defaultValue={q} className="max-w-md" />
          <Button type="submit">Search plots</Button>
        </form>
      ) : (
        <p className="mb-4">
          <Link href="/open-files/new" className="text-sm text-teal-800 hover:underline">
            ← Choose a different plot
          </Link>
        </p>
      )}

      {!sp.plotId && q && plots.length === 0 ? (
        <p className="text-sm text-slate-600">No plots match “{q}”. Try plot number, sector, or seller name.</p>
      ) : null}

      {!sp.plotId && !q ? (
        <p className="text-sm text-slate-600">Search and select the plot still in the seller&apos;s name.</p>
      ) : null}

      {!sp.plotId && plots.length > 0 ? (
        <ul className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {plots.map((p) => {
            const o = p.ownerships[0];
            const live = p.openFiles[0];
            return (
              <li key={p.id}>
                <Link
                  href={`/open-files/new?plotId=${p.id}`}
                  className="block rounded-md px-3 py-2 hover:bg-slate-50"
                >
                  <span className="font-medium text-teal-900">
                    {p.sector}/{p.block}-{p.plotNumber}
                  </span>
                  {o ? (
                    <span className="ml-2 text-sm text-slate-600">
                      Seller {o.ownerName} · {o.membershipNumber}
                    </span>
                  ) : (
                    <span className="ml-2 text-sm text-rose-700">No current owner</span>
                  )}
                  {live ? (
                    <span className="ml-2 text-xs text-amber-800">Already open ({live.openFileNumber})</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedPlot && owner && existingOpen ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          This plot already has open file{" "}
          <Link href={`/open-files/${existingOpen.id}`} className="font-medium underline">
            {existingOpen.openFileNumber}
          </Link>
          . Close it in a purchaser&apos;s name or withdraw it before opening another. Ownership is
          still with {owner.ownerName}.
        </div>
      ) : null}

      {selectedPlot && owner && !existingOpen ? (
        <form
          action={createOpenFile}
          className="grid max-w-3xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <input type="hidden" name="plotId" value={selectedPlot.id} />
          <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-3 text-sm">
            <p>
              Plot{" "}
              <strong>
                {selectedPlot.sector}/{selectedPlot.block}-{selectedPlot.plotNumber}
              </strong>
            </p>
            <p className="mt-1 text-slate-700">
              Current seller (membership stays in this name until a purchaser buys):{" "}
              <strong>{owner.ownerName}</strong> · CNIC {owner.cnic} · {owner.membershipNumber}
            </p>
          </div>

          <OpenFileDealerFields />

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Dealer letterhead scan <span className="text-rose-700">*</span>
            </span>
            <Input
              name="letterhead"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            />
            <p className="mt-1 text-xs text-slate-500">
              Scan of the registered dealer&apos;s letterhead / undertaking to market this plot. PDF or
              image.
            </p>
          </label>

          <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-800">
              Open-file fee as pay order (P.O.) to the society
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Cash-in-hand is not the society path. Record the pay order that accompanies the
              letterhead. This becomes an immutable payment row for finance to verify.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">P.O. number</span>
                <Input name="poNumber" required placeholder="e.g. PO-458921" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Issuing bank</span>
                <Input name="poBank" required placeholder="e.g. HBL, UBL, Meezan" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">P.O. date</span>
                <Input name="poDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Amount (from fee schedule)</span>
                <Input value={fee ? String(Number(fee.amount)) : ""} readOnly className="bg-slate-50" />
              </label>
            </div>
          </div>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">TRD number (optional)</span>
            <Input name="trdNumber" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Opening date</span>
            <Input name="openingDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Remarks / notes</span>
            <textarea
              name="remarks"
              rows={2}
              placeholder="e.g. Special terms, dealer desk number…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={!fee || activeDealerCount === 0}>
              Record open transfer
            </Button>
            <p className="mt-2 text-xs text-slate-500">
              Status will be Open. Membership remains {owner.ownerName} until a purchaser is recorded
              and the sale transfer completes.
            </p>
          </div>
        </form>
      ) : sp.plotId && !selectedPlot ? (
        <p className="text-sm text-rose-700">Plot not found. Search again from the open files list.</p>
      ) : sp.plotId && selectedPlot && !owner ? (
        <p className="text-sm text-rose-700">This plot has no current owner, so it cannot be listed through a dealer.</p>
      ) : null}
    </div>
  );
}
