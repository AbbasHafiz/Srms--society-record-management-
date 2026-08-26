import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createFeeConfiguration } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { FeeType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const FEE_TYPES: FeeType[] = [
  "OPEN_FILE",
  "TRANSFER",
  "ANNUAL_PLOT_CHARGE",
  "NOC",
  "NEC",
  "POSSESSION",
  "WATER_TANKER",
  "OTHER",
];

async function createFeeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "configure_fees")) {
    throw new Error("You do not have permission to configure fees");
  }

  const feeType = formData.get("feeType") as FeeType;
  const name = (formData.get("name") as string)?.trim();
  const amount = Number(formData.get("amount"));
  const periodMonths = formData.get("periodMonths")
    ? Number(formData.get("periodMonths"))
    : undefined;
  const effectiveFrom = new Date(formData.get("effectiveFrom") as string);
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!feeType || !name || !amount || Number.isNaN(effectiveFrom.getTime())) {
    throw new Error("Invalid fee configuration");
  }

  await createFeeConfiguration({
    feeType,
    name,
    amount,
    periodMonths,
    effectiveFrom,
    createdById: session.user.id,
    remarks,
  });

  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const session = await auth();
  const canConfigure = session?.user && hasPermission(session.user.role, "configure_fees");

  const [feeConfigs, sequences, systemSettings] = await Promise.all([
    prisma.feeConfiguration.findMany({
      orderBy: [{ feeType: "asc" }, { effectiveFrom: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.numberSequence.findMany({ orderBy: { key: "asc" } }),
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Fee configurations, number sequences, and system parameters."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {canConfigure ? (
          <Card>
            <CardHeader>
              <CardTitle>Add Fee Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createFeeAction} className="space-y-4">
                <div>
                  <Label htmlFor="feeType">Fee Type</Label>
                  <select
                    id="feeType"
                    name="feeType"
                    required
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    {FEE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {labelize(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required className="mt-1" placeholder="Open File Fee (3 months)" />
                </div>
                <div>
                  <Label htmlFor="amount">Amount (PKR)</Label>
                  <Input id="amount" name="amount" type="number" min={0} step={1} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="periodMonths">Period (months, optional)</Label>
                  <Input id="periodMonths" name="periodMonths" type="number" min={1} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="effectiveFrom">Effective From</Label>
                  <Input
                    id="effectiveFrom"
                    name="effectiveFrom"
                    type="date"
                    required
                    className="mt-1"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div>
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Input id="remarks" name="remarks" className="mt-1" />
                </div>
                <Button type="submit" className="w-full">
                  Create Fee Configuration
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className={canConfigure ? "lg:col-span-2" : "lg:col-span-3"}>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Fee Configurations</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Amount</th>
                  <th>Period</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {feeConfigs.map((f) => (
                  <tr key={f.id}>
                    <td>{labelize(f.feeType)}</td>
                    <td className="font-medium">{f.name}</td>
                    <td>{formatCurrency(f.amount)}</td>
                    <td>{f.periodMonths ? `${f.periodMonths} mo` : "—"}</td>
                    <td>
                      {formatDate(f.effectiveFrom)}
                      {f.effectiveUntil ? ` → ${formatDate(f.effectiveUntil)}` : ""}
                    </td>
                    <td>
                      <Badge status={f.status} />
                    </td>
                    <td>{f.createdBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Number Sequences</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Prefix</th>
                <th>Next Value</th>
                <th>Pad Length</th>
              </tr>
            </thead>
            <tbody>
              {sequences.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-slate-500">
                    No sequences configured yet.
                  </td>
                </tr>
              ) : (
                sequences.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.key}</td>
                    <td>{s.prefix}</td>
                    <td>{s.nextValue}</td>
                    <td>{s.padLength}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">System Settings</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {systemSettings.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-slate-500">
                    No system settings configured.
                  </td>
                </tr>
              ) : (
                systemSettings.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.key}</td>
                    <td>{s.value}</td>
                    <td>{s.label ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
