import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageMess } from "@/lib/rbac";
import { MEAL_TYPE_OPTIONS } from "@/lib/mess";
import { createMessMeal } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMessPage() {
  const session = await auth();
  const canManage = session?.user && canManageMess(session.user.role);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Add meal record" description="You do not have permission to manage mess records." />
        <Link href="/mess" className="text-sm text-teal-800 hover:underline">
          Back to mess
        </Link>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Add meal record"
        description="Log staff mess meals with headcount and cost."
        actions={
          <Link href="/mess" className="text-sm text-teal-800 hover:underline">
            Back to mess
          </Link>
        }
      />

      <form action={createMessMeal} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Date *</span>
          <Input type="date" name="mealDate" defaultValue={today} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Meal type *</span>
          <select name="mealType" defaultValue="LUNCH" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            {MEAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Headcount / beneficiaries *</span>
          <Input type="number" name="headcount" min="1" step="1" defaultValue="25" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Cost (PKR) *</span>
          <Input type="number" name="amount" min="0" step="0.01" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Vendor (optional)</span>
          <Input name="vendor" placeholder="e.g. Mess contractor / caterer" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Remarks</span>
          <Input name="remarks" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="postToFinance" className="rounded border-slate-300" />
          <span>Post expense to finance ledger (EXP_MESS)</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Payment method (if posting to ledger)</span>
          <select name="paymentMethod" defaultValue="CASH" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <Button type="submit">Save meal record</Button>
      </form>
    </div>
  );
}
