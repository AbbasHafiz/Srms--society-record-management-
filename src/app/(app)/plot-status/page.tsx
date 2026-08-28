import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRecordPlotDues, canViewPlotDues, getPlotDuesLedger, resolvePlotDuesLookup } from "@/lib/plot-dues";
import { formatCurrency, formatDate } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { PageHeader, EmptyState, WarningBanner } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print/print-button";
import { PlotStatusLookupForm } from "@/components/plot-status/lookup-form";
import { DuesLedgerSlip } from "@/components/plot-status/dues-ledger-slip";
import { addPlotDuesEntryAction } from "./actions";
import { formatSlipAmount } from "@/lib/plot-dues-shared";

export const dynamic = "force-dynamic";

export default async function PlotStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ membership?: string; cnic?: string; q?: string; code?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canViewPlotDues(session.user.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const membership = sp.membership?.trim() || "";
  const cnic = sp.cnic?.trim() || "";
  const q = (sp.q || sp.code || "").trim();
  const hasQuery = Boolean(membership || cnic || q);
  const canRecord = canRecordPlotDues(session.user.role);

  const lookup = hasQuery
    ? await resolvePlotDuesLookup({ membership, cnic, q })
    : null;

  const ledger =
    lookup?.ok === true ? await getPlotDuesLedger(lookup.plotId) : null;
  const heads =
    lookup?.ok === true
      ? await prisma.plotDuesHead.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];

  return (
    <div>
      <PageHeader
        title="Plot status / dues slip"
        description="Look up a plot by membership number, CNIC, or physical-file QR and print the dues ledger."
      />

      <PlotStatusLookupForm membership={membership} cnic={cnic} q={q} />

      {sp.error ? (
        <div className="mt-4">
          <WarningBanner>{sp.error}</WarningBanner>
        </div>
      ) : null}

      {hasQuery && lookup && !lookup.ok && lookup.error === "invalid_qr" ? (
        <div className="mt-6">
          <WarningBanner>{lookup.message}</WarningBanner>
        </div>
      ) : null}

      {hasQuery && lookup && !lookup.ok && lookup.error === "not_found" ? (
        <div className="mt-6">
          <EmptyState title="Plot not found" description={lookup.message} />
        </div>
      ) : null}

      {ledger ? (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Current owner</p>
              <p className="font-display text-lg font-semibold text-slate-900">
                {ledger.owner?.ownerName || "No active membership"}
              </p>
              <p className="text-sm text-slate-600">
                {plotLabel(ledger.plot)} · Membership {ledger.owner?.membershipNumber || "—"}
                {ledger.owner?.cnic ? ` · CNIC ${ledger.owner.cnic}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={ledger.societySubtotal > 0 ? "OVERDUE" : "PAID"}>
                {ledger.societySubtotal > 0
                  ? `Outstanding ${formatCurrency(ledger.societySubtotal)}`
                  : "No society outstanding"}
              </Badge>
              <PrintButton href={`/plot-status/print/${ledger.plot.id}`} />
              <Link href={`/plots/${ledger.plot.id}`} className="text-sm text-teal-800 hover:underline">
                Open plot →
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <DuesLedgerSlip ledger={ledger} />
          </div>

          {canRecord ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-slate-900">Record a dues line</h2>
              <p className="mt-1 text-sm text-slate-600">
                Append-only. Existing deposited / outstanding rows are never overwritten.
              </p>
              <form action={addPlotDuesEntryAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <input type="hidden" name="plotId" value={ledger.plot.id} />
                <div className="lg:col-span-2">
                  <Label htmlFor="headId">Head</Label>
                  <select
                    id="headId"
                    name="headId"
                    required
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    {heads.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="kind">Column</Label>
                  <select
                    id="kind"
                    name="kind"
                    required
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="DEPOSITED">Deposited</option>
                    <option value="OUTSTANDING">Outstanding</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="amount">Amount (PKR)</Label>
                  <Input id="amount" name="amount" type="number" min={0} step="1" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="asOfDate">Upto date</Label>
                  <Input id="asOfDate" name="asOfDate" type="date" className="mt-1" />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Input id="remarks" name="remarks" className="mt-1" />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Add line</Button>
                </div>
              </form>
              <p className="mt-3 text-xs text-slate-500">
                Screen preview uses {formatSlipAmount(ledger.societySubtotal)} society outstanding as of{" "}
                {formatDate(ledger.issueDate)}.
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
