import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRegisterOpenFile } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { OpenFileDealerFields } from "@/components/open-files/open-file-dealer-fields";
import { OpenFileCreateFields } from "@/components/open-files/open-file-create-fields";
import { createOpenFile } from "../actions";
import { formatCurrency } from "@/lib/utils";
import { LIVE_OPEN_FILE_STATUSES, UNPAID_PLOT_CHARGE_STATUSES } from "@/lib/open-files";
import { OPEN_FILE_STORY } from "@/lib/open-files-shared";
import { isSalePoa } from "@/lib/poa-shared";
import { getFbrTaxRates } from "@/lib/fbr-tax";
import { Seller236COpenFileFields } from "@/components/tax/seller-236c-open-file-fields";

export const dynamic = "force-dynamic";

export default async function NewOpenFilePage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canRegisterOpenFile(session.user.role)) {
    redirect("/open-files");
  }

  const sp = await searchParams;
  const q = sp.q?.trim();

  const [plots, fee, activeDealerCount, fbrRates] = await Promise.all([
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
        plotCharges: {
          where: { status: { in: UNPAID_PLOT_CHARGE_STATUSES } },
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
        powerOfAttorneys: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            poaNumber: true,
            kind: true,
            purpose: true,
            attorneyName: true,
            attorneyCnic: true,
            principalCnic: true,
          },
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
    getFbrTaxRates(),
  ]);

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;
  const owner = selectedPlot?.ownerships[0];
  const existingOpen = selectedPlot?.openFiles[0];
  const salePoas = (selectedPlot?.powerOfAttorneys ?? []).filter(
    (p) =>
      isSalePoa(p) &&
      (!owner || p.principalCnic.replace(/\D/g, "") === owner.cnic.replace(/\D/g, ""))
  );

  return (
    <div>
      <PageHeader
        title="Open a file (open transfer)"
        description={OPEN_FILE_STORY}
        actions={
          <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
            ← Open files
          </Link>
        }
      />

      <QueryErrorBanner error={sp.error} />

      <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
        Seller sells the plot to an investor or dealer (XYZ), receives payment, hands over the allotment
        letter and other documents, and clears pending society dues. A registered dealer issues letterhead
        stating the file should be made <strong>open transfer</strong>. Purchaser (end-buyer) details stay
        empty until a later buyer proves identity, pays the transfer fee, and the file is closed in that
        buyer&apos;s name. Legal membership stays with the seller until close. XYZ is recorded as the
        open-file holder.
      </div>

      {activeDealerCount === 0 ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No active registered dealers on file.{" "}
          <Link href="/offices/new" className="font-medium text-teal-900 underline">
            Register a dealer office
          </Link>{" "}
          before opening a file — letterhead must come from an active registered dealer.
        </div>
      ) : null}

      {!fee ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          No active open-file fee is configured. Ask finance / secretary to set the OPEN_FILE fee
          schedule before registering.
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-600">
          Society open-file fee (from current schedule):{" "}
          <strong>{formatCurrency(fee.amount)}</strong>
          {fee.periodMonths ? ` for ${fee.periodMonths} months` : ""} · paid as pay order to the society.
          This is not the private consideration XYZ paid the seller.
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
          . Close it in an end-buyer&apos;s name or withdraw it before opening another. Ownership is
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">1. Seller</p>
            <p>
              Plot{" "}
              <strong>
                {selectedPlot.sector}/{selectedPlot.block}-{selectedPlot.plotNumber}
              </strong>
            </p>
            <p className="mt-1 text-slate-700">
              Current legal member (stays on record until the file is closed):{" "}
              <strong>{owner.ownerName}</strong> · CNIC {owner.cnic} · {owner.membershipNumber}
            </p>
            <p className="mt-1 text-xs text-slate-500">{OPEN_FILE_STORY}</p>
          </div>

          <OpenFileCreateFields
            plotId={selectedPlot.id}
            salePoas={salePoas}
            isSuperAdmin={session.user.role === "SUPER_ADMIN"}
            charges={selectedPlot.plotCharges.map((c) => ({
              id: c.id,
              year: c.year,
              month: c.month,
              amount: String(c.amount),
            }))}
          />

          <Seller236COpenFileFields
            dcValueDefault={selectedPlot.dcValue ? String(selectedPlot.dcValue) : ""}
            filerRate={fbrRates.cFiler}
            nonFilerRate={fbrRates.cNonFiler}
            sellerName={owner.ownerName}
          />

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Registered dealer letterhead (open transfer)
            </p>
            <OpenFileDealerFields />
          </div>

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
              Scan of the registered dealer&apos;s letterhead stating this file should be made open
              transfer. PDF or image — not a checkbox.
            </p>
          </label>

          <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-800">
              Society open-file fee as pay order (P.O.)
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Paid to the society to open the file. Separate from the private consideration XYZ paid the
              seller. This becomes an immutable payment row for finance to verify.
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
              Status will be Open. Membership remains {owner.ownerName}. XYZ is the open-file holder.
              End purchaser stays empty until a buyer is recorded and the sale transfer completes.
            </p>
          </div>
        </form>
      ) : sp.plotId && !selectedPlot ? (
        <p className="text-sm text-rose-700">Plot not found. Search again from the open files list.</p>
      ) : sp.plotId && selectedPlot && !owner ? (
        <p className="text-sm text-rose-700">This plot has no current owner, so it cannot be opened as a transfer file.</p>
      ) : null}
    </div>
  );
}
