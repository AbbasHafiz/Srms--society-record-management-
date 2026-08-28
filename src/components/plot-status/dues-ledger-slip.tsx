import { formatSlipAmount, formatSlipLongDate, formatUptoDate, plotSizeLine } from "@/lib/plot-dues-shared";
import type { PlotDuesLedger } from "@/lib/plot-dues";
import { PRINT_COMPUTER_GENERATED } from "@/lib/print-shared";

export function DuesLedgerSlip({ ledger, societyShortName }: { ledger: PlotDuesLedger; societyShortName?: string }) {
  const shortName = societyShortName || ledger.societyName.split(/\s+/).map((w) => w[0]).join("").slice(0, 8).toUpperCase();
  const ntnLabel = `${shortName} NTN`;
  const membership = ledger.owner?.membershipNumber || "—";
  const possessionNo = ledger.possessionFormNo || "Nil";
  const asOfFallback = ledger.lines.find((l) => l.asOfDate)?.asOfDate ?? ledger.issueDate;

  return (
    <article className="dues-ledger-slip mx-auto max-w-[210mm] bg-white p-6 text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <style>{`
        .dues-ledger-slip {
          font-family: var(--font-display), "Times New Roman", Times, serif;
          font-size: 12.5px;
          color: #111;
        }
        .dues-ledger-slip table {
          width: 100%;
          border-collapse: collapse;
        }
        .dues-ledger-slip th,
        .dues-ledger-slip td {
          border: 1px solid #111;
          padding: 5px 8px;
          vertical-align: middle;
        }
        .dues-ledger-slip thead th {
          background: #6b7280;
          color: #fff;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-align: center;
          text-transform: uppercase;
        }
        .dues-ledger-slip td.amt {
          text-align: right;
          font-variant-numeric: tabular-nums;
          width: 7.5rem;
          white-space: nowrap;
        }
        .dues-ledger-slip td.total-label {
          font-weight: 700;
        }
        @media print {
          .dues-ledger-slip {
            font-size: 12px;
          }
        }
      `}</style>

      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p>
            <span className="font-semibold">Membership No:</span> {membership}
          </p>
          <p>
            <span className="font-semibold">Plot Size:</span> {plotSizeLine(ledger.plot)}
          </p>
          <p>
            <span className="font-semibold">Possession Form No:</span> {possessionNo}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold underline decoration-1 underline-offset-4">
            {ntnLabel}: {ledger.societyNtn || "—"}
          </p>
          {ledger.owner ? (
            <p className="mt-2 text-xs text-slate-600">{ledger.owner.ownerName}</p>
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-2 print:grid-cols-2">
        <table>
          <thead>
            <tr>
              <th colSpan={2}>Deposited</th>
            </tr>
          </thead>
          <tbody>
            {ledger.lines.map((line) => (
              <tr key={`d-${line.headId}`}>
                <td>{lineLabel(line, false)}</td>
                <td className="amt">{formatSlipAmount(line.deposited)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th colSpan={2}>Outstandings - Revised</th>
            </tr>
          </thead>
          <tbody>
            {ledger.lines.map((line) => (
              <tr key={`o-${line.headId}`}>
                <td>{lineLabel(line, true, asOfFallback)}</td>
                <td className="amt">{formatSlipAmount(line.outstanding)}</td>
              </tr>
            ))}
            <tr>
              <td className="total-label">
                {ledger.societyName}
                {ledger.societyName.toLowerCase().includes("islamabad") ? "" : ", Islamabad"}
              </td>
              <td className="amt total-label">{formatSlipAmount(ledger.societySubtotal)}</td>
            </tr>
            {ledger.taxationOfficerAmount > 0 ? (
              <tr>
                <td>Taxation Officer</td>
                <td className="amt">{formatSlipAmount(ledger.taxationOfficerAmount)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="mt-10 grid grid-cols-3 items-end gap-4">
        <div>
          <p className="font-semibold underline decoration-1 underline-offset-4">Due Date</p>
          <p className="mt-2">{formatSlipLongDate(ledger.dueDate)}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-500 text-center text-[10px] uppercase tracking-wide text-slate-500">
            Society stamp
          </div>
          <img
            src={ledger.verificationQrDataUrl}
            alt="Verification QR"
            width={88}
            height={88}
            className="border border-slate-300 bg-white p-1"
          />
          <p className="max-w-[11rem] text-center text-[9px] leading-tight text-slate-500">
            Scan to verify plot status
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold underline decoration-1 underline-offset-4">Manager Finance</p>
          <p className="mt-2">{formatSlipLongDate(ledger.issueDate)}</p>
        </div>
      </footer>

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-xs">
        <div>
          <div className="mb-8 border-b border-slate-700" />
          <p className="font-semibold">Taxation Officer</p>
        </div>
        <div>
          <div className="mb-8 border-b border-slate-700" />
          <p className="font-semibold">Manager Finance</p>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-slate-500">{PRINT_COMPUTER_GENERATED}</p>
    </article>
  );
}

function lineLabel(
  line: { name: string; showUptoDate: boolean; asOfDate: Date | null; outstanding: number },
  outstanding: boolean,
  fallbackDate?: Date | null
): string {
  if (!outstanding || !line.showUptoDate) return line.name;
  const date = line.asOfDate || fallbackDate;
  if (!date) return line.name;
  return `${line.name} upto ${formatUptoDate(date)}`;
}
