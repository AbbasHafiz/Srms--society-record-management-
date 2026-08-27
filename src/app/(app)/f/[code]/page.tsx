import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { WarningBanner } from "@/components/ui/page";
import { QrCodeDisplay } from "@/components/qr-code-display";
import {
  formatLockerPath,
  isNonPossession,
  lookupPlotByScanCode,
  maskCnic,
  possessionLabel,
  summarizeOutstanding,
} from "@/lib/plot-scan";
import { formatCurrency, formatDate, daysUntil, labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FileScanPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();
  const role = session?.user?.role ?? "VIEWER";

  const result = await lookupPlotByScanCode(code);
  if (!result) notFound();

  const { plot, physicalFile } = result;
  const activeOwner = plot.ownerships.find((o) => o.status === "ACTIVE");
  const activeMortgage = plot.mortgages.find((m) => m.status === "ACTIVE");
  const activeOpenFile = plot.openFiles.find((f) => f.status === "ACTIVE" || f.status === "OPEN");
  const outstanding = summarizeOutstanding(plot);
  const nonPossession = isNonPossession(plot.possessionStatus, plot.developmentStatus);

  const openFileDays = activeOpenFile ? daysUntil(activeOpenFile.expiryDate) : null;
  const openFileExpiringSoon = openFileDays !== null && openFileDays <= 30;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/physical-files" className="text-sm text-teal-800 hover:underline">
          ← Physical files
        </Link>
        <Link href={`/plots/${plot.id}`} className="text-sm text-teal-800 hover:underline">
          Full plot profile →
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 px-5 py-6 text-white sm:px-6">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-200/80">File Scan</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {plot.sector}/{plot.block}-{plot.plotNumber}
          </h1>
          <p className="mt-2 text-sm text-teal-100/90">
            {plot.street || "—"} · {Number(plot.sizeMarla)} marla · {labelize(plot.plotType)}
          </p>
          {physicalFile ? (
            <p className="mt-2 font-mono text-xs text-teal-200/90">
              {physicalFile.fileNumber} · {physicalFile.barcode}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-b border-slate-100 px-4 py-3 sm:px-6">
          {activeMortgage ? (
            <WarningBanner>
              Active Bank Mortgage — {activeMortgage.bankName}
              {activeMortgage.loanReference ? ` (${activeMortgage.loanReference})` : ""}. Transfer blocked
              until bank clearance.
            </WarningBanner>
          ) : null}
          {activeOpenFile && openFileExpiringSoon ? (
            <WarningBanner>
              Open File {activeOpenFile.openFileNumber} expires in {openFileDays} days (
              {formatDate(activeOpenFile.expiryDate)})
            </WarningBanner>
          ) : null}
          {outstanding.grandTotal > 0 ? (
            <WarningBanner>
              Outstanding dues: {formatCurrency(outstanding.grandTotal)} pending verification or payment.
            </WarningBanner>
          ) : null}
          {nonPossession ? (
            <WarningBanner>
              {plot.developmentStatus === "UNDEVELOPED" || plot.developmentStatus === "VACANT"
                ? `Plot is ${labelize(plot.developmentStatus)} — ${possessionLabel(plot.possessionStatus)}. Owner and dues records still apply.`
                : possessionLabel(plot.possessionStatus)}
            </WarningBanner>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
          <Badge status={plot.ownershipStatus} />
          <Badge status={plot.possessionStatus} />
          <Badge status={plot.developmentStatus} />
          {plot.hasActiveMortgage || activeMortgage ? <Badge status="ACTIVE_MORTGAGE">Mortgage</Badge> : null}
          {plot.hasOpenFile || activeOpenFile ? <Badge status="ACTIVE">Open File</Badge> : null}
          <Badge status={plot.annualChargesStatus}>Annual Charges</Badge>
          {physicalFile ? <Badge status={physicalFile.status} /> : null}
        </div>

        <div className="grid gap-6 p-4 sm:p-6">
          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900">Current Owner</h2>
            {activeOwner ? (
              <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Row label="Name" value={activeOwner.ownerName} />
                <Row label="Membership" value={activeOwner.membershipNumber} />
                <Row label="Allotment" value={activeOwner.allotmentNumber} />
                <Row label="CNIC" value={maskCnic(activeOwner.cnic, role)} mono />
                <Row label="Since" value={formatDate(activeOwner.startDate)} />
                <Row label="Status" value={<Badge status={activeOwner.status} />} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No active owner on record.</p>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900">Development & Possession</h2>
            <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Row label="Development" value={labelize(plot.developmentStatus)} />
              <Row label="Possession" value={possessionLabel(plot.possessionStatus)} />
              <Row
                label="Effective status"
                value={
                  nonPossession
                    ? "Non-possession / undeveloped — owner & dues still active"
                    : "Developed with possession issued"
                }
              />
            </dl>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Pending Dues
              <span className="ml-2 text-base font-normal text-slate-500">
                {formatCurrency(outstanding.grandTotal)}
              </span>
            </h2>
            {plot.plotCharges.length === 0 && plot.payments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No outstanding charges or pending payments.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {plot.plotCharges.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Plot charges</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {plot.plotCharges.map((c) => (
                        <li key={c.id} className="flex justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <span>
                            {c.year}
                            {c.month ? `-${String(c.month).padStart(2, "0")}` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge status={c.status} />
                            <span className="font-medium">{formatCurrency(c.amount)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {plot.payments.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Pending payments</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {plot.payments.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <span>
                            {p.receiptNumber} · {labelize(p.feeType)}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge status={p.status} />
                            <span className="font-medium">{formatCurrency(p.amount)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {activeMortgage ? (
            <section>
              <h2 className="font-display text-lg font-semibold text-slate-900">Active Mortgage</h2>
              <dl className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <Row label="Bank" value={activeMortgage.bankName} />
                <Row label="Loan ref" value={activeMortgage.loanReference || "—"} />
                <Row label="Since" value={formatDate(activeMortgage.mortgageDate)} />
              </dl>
            </section>
          ) : null}

          {activeOpenFile ? (
            <section>
              <h2 className="font-display text-lg font-semibold text-slate-900">Open File</h2>
              <dl className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <Row label="Number" value={activeOpenFile.openFileNumber} />
                <Row label="Dealer" value={activeOpenFile.dealerName} />
                <Row
                  label="Expires"
                  value={`${formatDate(activeOpenFile.expiryDate)} (${openFileDays} days)`}
                />
                <Row label="Fee" value={formatCurrency(activeOpenFile.feeAmount)} />
              </dl>
            </section>
          ) : null}

          {physicalFile ? (
            <section>
              <h2 className="font-display text-lg font-semibold text-slate-900">Physical File</h2>
              <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Row label="File no." value={physicalFile.fileNumber} />
                <Row label="Barcode" value={physicalFile.barcode} mono />
                <Row label="Status" value={<Badge status={physicalFile.status} />} />
                <Row label="Condition" value={labelize(physicalFile.condition)} />
                <Row label="Locker path" value={formatLockerPath(physicalFile.currentLocation)} />
              </dl>
              <div className="mt-4 flex justify-center">
                <QrCodeDisplay barcode={physicalFile.barcode} size={160} showUrl={false} />
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">
                <Link href={`/physical-files/${physicalFile.id}`} className="text-teal-800 hover:underline">
                  Open file record →
                </Link>
              </p>
            </section>
          ) : (
            <p className="text-sm text-slate-500">No physical file registered for this plot.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 sm:text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
