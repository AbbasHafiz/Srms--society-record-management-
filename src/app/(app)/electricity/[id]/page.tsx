import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  canManageElectricity,
  canViewElectricity,
  getElectricityBill,
  periodLabel,
} from "@/lib/electricity";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { fileDownloadHref } from "@/lib/uploads";
import {
  cancelElectricityBill,
  markElectricityBillPaidAction,
  updateElectricityBill,
  uploadElectricityBillScan,
} from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function ElectricityBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !canViewElectricity(session.user.role)) {
    return (
      <div>
        <PageHeader title="Electricity bill" description="You do not have access." />
      </div>
    );
  }

  const bill = await getElectricityBill(id);
  if (!bill) notFound();

  const canManage = canManageElectricity(session.user.role);
  const editable = canManage && bill.status !== "PAID" && bill.status !== "CANCELLED";
  const canMarkPaid = canManage && bill.status !== "PAID" && bill.status !== "CANCELLED";
  const canCancel = canManage && bill.status !== "PAID" && bill.status !== "CANCELLED";

  return (
    <div>
      <Link href="/electricity" className="text-sm text-teal-800 hover:underline">
        ← Electricity bills
      </Link>

      <PageHeader
        title={periodLabel(bill.periodMonth, bill.periodYear)}
        description={bill.vendor ? `${bill.vendor} electricity bill` : "Society electricity bill"}
        actions={<Badge status={bill.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Bill details</h2>
          <div className="mt-3">
            <Row label="Amount" value={formatCurrency(bill.amount)} />
            <Row label="Units" value={bill.units != null ? Number(bill.units).toLocaleString() : "—"} />
            <Row label="Due date" value={formatDate(bill.dueDate)} />
            <Row label="Paid on" value={bill.paidAt ? formatDate(bill.paidAt) : "—"} />
            <Row label="Meter no." value={bill.meterNo ?? "—"} />
            <Row label="Account no." value={bill.accountNo ?? "—"} />
            <Row label="Vendor" value={bill.vendor ?? "—"} />
            <Row label="Remarks" value={bill.remarks ?? "—"} />
            <Row label="Recorded by" value={bill.createdBy?.name ?? "—"} />
            {bill.financeTransaction ? (
              <Row
                label="Finance ledger"
                value={
                  <Link href="/finance" className="text-teal-800 hover:underline">
                    {bill.financeTransaction.txnNumber}
                  </Link>
                }
              />
            ) : null}
          </div>

          {bill.scanFilePath ? (
            <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Bill scan</p>
              <a
                href={fileDownloadHref(bill.scanFilePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-teal-800 hover:underline"
              >
                View scan
              </a>
            </div>
          ) : null}

          {canManage && !bill.scanFilePath ? (
            <form action={uploadElectricityBillScan} className="mt-4 space-y-2 border-t pt-4">
              <input type="hidden" name="id" value={bill.id} />
              <Label className="text-xs text-slate-500">Upload bill scan</Label>
              <Input name="scan" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />
              <Button type="submit" size="sm" variant="outline">
                Upload scan
              </Button>
            </form>
          ) : null}
        </section>

        <div className="space-y-6">
          {editable ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Edit bill</h2>
              <form action={updateElectricityBill} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={bill.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <Label>Month</Label>
                    <select
                      name="periodMonth"
                      defaultValue={bill.periodMonth}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <Label>Year</Label>
                    <Input name="periodYear" type="number" defaultValue={bill.periodYear} className="mt-1" />
                  </label>
                  <label className="text-sm">
                    <Label>Vendor</Label>
                    <Input name="vendor" defaultValue={bill.vendor ?? ""} className="mt-1" />
                  </label>
                  <label className="text-sm">
                    <Label>Due date</Label>
                    <Input
                      name="dueDate"
                      type="date"
                      defaultValue={bill.dueDate.toISOString().slice(0, 10)}
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm">
                    <Label>Meter no.</Label>
                    <Input name="meterNo" defaultValue={bill.meterNo ?? ""} className="mt-1" />
                  </label>
                  <label className="text-sm">
                    <Label>Account no.</Label>
                    <Input name="accountNo" defaultValue={bill.accountNo ?? ""} className="mt-1" />
                  </label>
                  <label className="text-sm">
                    <Label>Units</Label>
                    <Input
                      name="units"
                      type="number"
                      step="0.01"
                      defaultValue={bill.units != null ? Number(bill.units) : ""}
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm">
                    <Label>Amount</Label>
                    <Input name="amount" type="number" defaultValue={Number(bill.amount)} className="mt-1" />
                  </label>
                </div>
                <label className="block text-sm">
                  <Label>Remarks</Label>
                  <Input name="remarks" defaultValue={bill.remarks ?? ""} className="mt-1" />
                </label>
                <label className="block text-sm">
                  <Label>Replace scan (optional)</Label>
                  <Input name="scan" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" className="mt-1" />
                </label>
                <Button type="submit">Save changes</Button>
              </form>
            </section>
          ) : null}

          {canMarkPaid ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Mark paid</h2>
              <form action={markElectricityBillPaidAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={bill.id} />
                <label className="block text-sm">
                  <Label>Paid date</Label>
                  <Input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="postToFinance" defaultChecked />
                  Post to finance ledger (Utilities)
                </label>
                <label className="block text-sm">
                  <Label>Payment method</Label>
                  <select name="paymentMethod" defaultValue="BANK_TRANSFER" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="PO">PO</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <Button type="submit">Mark paid</Button>
              </form>
            </section>
          ) : null}

          {canCancel ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Cancel bill</h2>
              <p className="mt-1 text-sm text-slate-600">
                Paid bills are never deleted — they remain in history. Only pending or overdue bills can be cancelled.
              </p>
              <form action={cancelElectricityBill} className="mt-4">
                <input type="hidden" name="id" value={bill.id} />
                <Button type="submit" variant="outline" className="text-rose-800">
                  Cancel bill
                </Button>
              </form>
            </section>
          ) : null}

          {bill.status === "PAID" ? (
            <p className="text-sm text-slate-500">
              This paid bill is locked for editing. Status: {labelize(bill.status)}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
