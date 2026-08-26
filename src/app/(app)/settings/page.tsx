import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createFeeConfiguration } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { createPropertySizeOption, togglePropertySizeOption } from "./size-actions";
import { plotTypeLabel } from "@/lib/plots";
import { formatPropertySize } from "@/lib/property-sizes";
import { ALL_PLOT_TYPES } from "@/lib/plots";
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
  const canManageSizes =
    session?.user &&
    (hasPermission(session.user.role, "manage_settings") ||
      hasPermission(session.user.role, "configure_fees"));

  const [feeConfigs, sequences, systemSettings, sizeOptions] = await Promise.all([
    prisma.feeConfiguration.findMany({
      orderBy: [{ feeType: "asc" }, { effectiveFrom: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.numberSequence.findMany({ orderBy: { key: "asc" } }),
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.propertySizeOption.findMany({
      orderBy: [{ propertyType: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Fee configurations, organization roles, number sequences, and system parameters."
        actions={
          <Link href="/settings/roles" className="text-sm text-teal-800 hover:underline">
            Organization roles
          </Link>
        }
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Property Size Catalog</h2>
            <p className="mt-1 text-sm text-slate-600">
              Standard plot, flat, and shop sizes used when registering properties and on NOC applications.
            </p>
          </div>
          {canManageSizes ? (
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <form action={createPropertySizeOption} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div>
                  <Label htmlFor="propertyType">Type</Label>
                  <select
                    id="propertyType"
                    name="propertyType"
                    required
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    {ALL_PLOT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {plotTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" name="label" required className="mt-1" placeholder="20 Marla / 500 Sq Yd" />
                </div>
                <div>
                  <Label htmlFor="sizeValue">Size value</Label>
                  <Input id="sizeValue" name="sizeValue" type="number" min={1} step="0.01" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    name="unit"
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="SQ_YD">Sq Yd</option>
                    <option value="SQ_FT">Sq Ft</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="sizeMarla">Marla (opt.)</Label>
                  <Input id="sizeMarla" name="sizeMarla" type="number" step="0.01" className="mt-1" />
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-6">
                  <Button type="submit">Add size option</Button>
                </div>
              </form>
            </div>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Label</th>
                <th>Size</th>
                <th>Sort</th>
                <th>Status</th>
                {canManageSizes ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {sizeOptions.length === 0 ? (
                <tr>
                  <td colSpan={canManageSizes ? 6 : 5} className="text-slate-500">
                    No size options — run seed or add above.
                  </td>
                </tr>
              ) : (
                sizeOptions.map((o) => (
                  <tr key={o.id}>
                    <td>{plotTypeLabel(o.propertyType)}</td>
                    <td className="font-medium">{o.label}</td>
                    <td>{formatPropertySize(o)}</td>
                    <td>{o.sortOrder}</td>
                    <td>
                      <Badge status={o.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {canManageSizes ? (
                      <td>
                        <form action={togglePropertySizeOption}>
                          <input type="hidden" name="id" value={o.id} />
                          <Button type="submit" variant="outline" className="h-8 text-xs">
                            {o.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

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
