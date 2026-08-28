import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print/print-button";
import { markSalaryPaymentPaid, recordSalaryPayment } from "@/app/(app)/employees/actions";

type SalaryPaymentRow = {
  id: string;
  periodYear: number;
  periodMonth: number;
  amount: { toString(): string };
  status: string;
  paidAt: Date | null;
  remarks: string | null;
};

type SalarySectionProps = {
  employeeId: string;
  currentSalary: { toString(): string } | null;
  payments: SalaryPaymentRow[];
  canManage: boolean;
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function SalarySection({ employeeId, currentSalary, payments, canManage }: SalarySectionProps) {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Salary</h2>
        <p className="mt-1 text-sm text-slate-600">
          Current monthly rate:{" "}
          <span className="font-medium text-slate-900">
            {currentSalary ? formatCurrency(currentSalary) : "Not set"}
          </span>
        </p>
      </div>

      {canManage ? (
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <h3 className="text-sm font-medium text-slate-800">Record payment</h3>
          <form action={recordSalaryPayment} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="employeeId" value={employeeId} />
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Year</span>
              <input
                name="periodYear"
                type="number"
                min={2020}
                max={2100}
                defaultValue={defaultYear}
                required
                className="h-10 w-full rounded-md border border-slate-300 px-3"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Month</span>
              <select
                name="periodMonth"
                defaultValue={defaultMonth}
                required
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Amount (PKR)</span>
              <input
                name="amount"
                type="number"
                min={0}
                step={1}
                defaultValue={currentSalary?.toString() ?? ""}
                required
                className="h-10 w-full rounded-md border border-slate-300 px-3"
              />
            </label>
            <label className="text-sm lg:col-span-2">
              <span className="mb-1 block text-slate-600">Remarks</span>
              <input name="remarks" className="h-10 w-full rounded-md border border-slate-300 px-3" />
            </label>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="markPaid" defaultChecked className="rounded border-slate-300" />
                Mark as paid
              </label>
              <Button type="submit" className="h-10">
                Record
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Paid at</th>
            <th>Remarks</th>
            <th>Print</th>
            {canManage ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 7 : 6} className="text-slate-500">
                No salary payments recorded yet.
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id}>
                <td>
                  {MONTHS.find((m) => m.value === p.periodMonth)?.label ?? p.periodMonth} {p.periodYear}
                </td>
                <td className="font-medium">{formatCurrency(p.amount)}</td>
                <td>
                  <Badge status={p.status} />
                </td>
                <td>{p.paidAt ? formatDate(p.paidAt) : "—"}</td>
                <td>{p.remarks ?? "—"}</td>
                <td>
                  <PrintButton
                    href={`/employees/${employeeId}/salary/${p.id}/print`}
                    label="Print slip"
                    size="sm"
                  />
                </td>
                {canManage ? (
                  <td>
                    {p.status === "PENDING" ? (
                      <form action={markSalaryPaymentPaid}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <Button type="submit" variant="outline" className="h-8 text-xs">
                          Mark paid
                        </Button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
