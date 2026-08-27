import Link from "next/link";
import { auth } from "@/lib/auth";
import { canManageElectricity } from "@/lib/electricity";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createElectricityBill } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewElectricityBillPage() {
  const session = await auth();
  if (!session?.user || !canManageElectricity(session.user.role)) {
    return (
      <div>
        <PageHeader title="Add electricity bill" description="You do not have permission to add bills." />
      </div>
    );
  }

  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  return (
    <div>
      <PageHeader
        title="Add electricity bill"
        description="Record a society electricity bill for a billing period."
        actions={
          <Link href="/electricity">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />

      <form
        action={createElectricityBill}
        className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <Label>Billing month *</Label>
            <select
              name="periodMonth"
              required
              defaultValue={defaultMonth}
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
            <Label>Billing year *</Label>
            <Input name="periodYear" type="number" required defaultValue={defaultYear} className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Vendor</Label>
            <Input name="vendor" placeholder="e.g. IESCO" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Due date *</Label>
            <Input
              name="dueDate"
              type="date"
              required
              defaultValue={now.toISOString().slice(0, 10)}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            <Label>Meter no.</Label>
            <Input name="meterNo" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Account no.</Label>
            <Input name="accountNo" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Units</Label>
            <Input name="units" type="number" step="0.01" min="0" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Amount (PKR) *</Label>
            <Input name="amount" type="number" step="1" min="1" required className="mt-1" />
          </label>
        </div>

        <label className="block text-sm">
          <Label>Remarks</Label>
          <Input name="remarks" className="mt-1" />
        </label>

        <label className="block text-sm">
          <Label>Bill scan (optional)</Label>
          <Input
            name="scan"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            className="mt-1"
          />
        </label>

        <Button type="submit">Save bill</Button>
      </form>
    </div>
  );
}
