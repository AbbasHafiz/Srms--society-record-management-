import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessModule, hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createFinanceTxnAction } from "../actions";
import { PAYMENT_METHODS } from "@/lib/finance-constants";
import { labelize } from "@/lib/utils";
import { OfflineFinanceForm } from "@/components/offline/offline-finance-form";

export const dynamic = "force-dynamic";

export default async function NewFinanceTxnPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_finance");

  if (!session?.user || !canAccessModule(session.user.role, "finance") || !canManage) {
    return (
      <div>
        <PageHeader title="Record Entry" description="You do not have permission to create finance entries." />
        <Link href="/finance" className="text-sm text-teal-800 hover:underline">
          Back to finance
        </Link>
      </div>
    );
  }

  const defaultType = sp.type === "EXPENSE" ? "EXPENSE" : sp.type === "REVENUE" ? "REVENUE" : undefined;

  const [categories, plots, employees] = await Promise.all([
    prisma.financeCategory.findMany({
      where: { isActive: true, ...(defaultType ? { type: defaultType } : {}) },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.plot.findMany({
      select: { id: true, sector: true, block: true, plotNumber: true },
      orderBy: [{ sector: "asc" }, { plotNumber: "asc" }],
      take: 200,
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, employeeCode: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Record Revenue or Expense"
        description="Create a ledger entry. Save as draft or post immediately — posted amounts cannot be edited."
        actions={
          <Link href="/finance" className="text-sm text-teal-800 hover:underline">
            Back to ledger
          </Link>
        }
      />

      <OfflineFinanceForm
        action={createFinanceTxnAction}
        className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="categoryId">Category *</Label>
            <select
              id="categoryId"
              name="categoryId"
              required
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select category
              </option>
              {(["REVENUE", "EXPENSE"] as const).map((type) => (
                <optgroup key={type} label={labelize(type)}>
                  {categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="amount">Amount (PKR) *</Label>
            <Input id="amount" name="amount" type="number" min="1" step="1" required className="mt-1" />
          </div>

          <div>
            <Label htmlFor="txnDate">Transaction date *</Label>
            <Input id="txnDate" name="txnDate" type="date" defaultValue={today} required className="mt-1" />
          </div>

          <div>
            <Label htmlFor="paymentMethod">Payment method</Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue="CASH"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {labelize(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="reference">Reference (PO / cheque / receipt no.)</Label>
            <Input id="reference" name="reference" className="mt-1" placeholder="e.g. PO-88991" />
          </div>

          <div>
            <Label htmlFor="plotId">Plot (optional)</Label>
            <select
              id="plotId"
              name="plotId"
              defaultValue=""
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">— None —</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sector}/{p.block}-{p.plotNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="employeeId">Employee (optional)</Label>
            <select
              id="employeeId"
              name="employeeId"
              defaultValue=""
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">— None —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Description / remarks</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Brief notes for the ledger entry"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="postNow" name="postNow" type="checkbox" className="rounded border-slate-300" />
            <Label htmlFor="postNow" className="font-normal">
              Post immediately (otherwise saved as draft)
            </Label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit">Save entry</Button>
          <Link href="/finance">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </OfflineFinanceForm>
    </div>
  );
}
