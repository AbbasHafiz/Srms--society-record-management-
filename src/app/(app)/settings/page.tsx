import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createFeeConfiguration } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { createPropertySizeOption, togglePropertySizeOption } from "./size-actions";
import { updateSlaSettings } from "./sla-actions";
import { SLA_DEFAULTS } from "@/lib/sla";
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
import { updateTankerPriceConfig } from "@/app/(app)/tankers/actions";
import { getActiveTankerPrice, TANKER_TYPE_LABELS } from "@/lib/tankers";
import { updateFbrTaxRates } from "./tax-actions";
import { FBR_TAX_RATE_DEFAULTS, FBR_TAX_RATE_KEYS } from "@/lib/fbr-tax-shared";
import { getFbrTaxRates } from "@/lib/fbr-tax";
import { canRecordPlotDues } from "@/lib/plot-dues";
import { createPlotDuesHeadAction, updatePlotStatusSettingsAction } from "@/app/(app)/plot-status/actions";
import {
  DUES_SLIP_DUE_DAYS_DEFAULT,
  DUES_SLIP_TAX_OFFICER_FEE_DEFAULT,
} from "@/lib/plot-dues-shared";

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
  const canManageSla =
    session?.user &&
    (hasPermission(session.user.role, "manage_settings") ||
      hasPermission(session.user.role, "configure_fees"));
  const canManageDues = session?.user && canRecordPlotDues(session.user.role);

  const [feeConfigs, sequences, systemSettings, sizeOptions, cleanWaterPrice, constructionWaterPrice, fbrRates, duesHeads] =
    await Promise.all([
    prisma.feeConfiguration.findMany({
      orderBy: [{ feeType: "asc" }, { effectiveFrom: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.numberSequence.findMany({ orderBy: { key: "asc" } }),
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.propertySizeOption.findMany({
      orderBy: [{ propertyType: "asc" }, { sortOrder: "asc" }],
    }),
    getActiveTankerPrice("CLEAN_WATER"),
    getActiveTankerPrice("CONSTRUCTION_WATER"),
    getFbrTaxRates(),
    prisma.plotDuesHead.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const slaSettingsMap = Object.fromEntries(systemSettings.map((s) => [s.key, s.value]));

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
            <h2 className="font-display text-lg font-semibold">FBR 236C / 236K tax rates</h2>
            <p className="mt-1 text-sm text-slate-600">
              Percent of the plot DC value. Filer (active taxpayer) is lower; non-filer is higher, up to
              10.5%. 236C is the seller&apos;s tax; 236K is the purchaser&apos;s tax when they transfer into
              their name. Changing rates does not rewrite assessments already snapped on a transfer or
              open file.
            </p>
          </div>
          {canConfigure ? (
            <form
              action={updateFbrTaxRates}
              className="grid gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {(
                [
                  { key: FBR_TAX_RATE_KEYS.cFiler, value: fbrRates.cFiler },
                  { key: FBR_TAX_RATE_KEYS.cNonFiler, value: fbrRates.cNonFiler },
                  { key: FBR_TAX_RATE_KEYS.kFiler, value: fbrRates.kFiler },
                  { key: FBR_TAX_RATE_KEYS.kNonFiler, value: fbrRates.kNonFiler },
                ] as const
              ).map(({ key, value }) => (
                <div key={key}>
                  <Label htmlFor={key}>{FBR_TAX_RATE_DEFAULTS[key].label}</Label>
                  <Input
                    id={key}
                    name={key}
                    type="number"
                    min={0.01}
                    max={10.5}
                    step="0.1"
                    required
                    className="mt-1"
                    defaultValue={value}
                  />
                </div>
              ))}
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <Button type="submit">Save FBR tax rates</Button>
              </div>
            </form>
          ) : (
            <p className="px-5 py-3 text-sm text-slate-600">You do not have permission to change tax rates.</p>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Filer</th>
                <th>Non-filer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>236C seller</td>
                <td className="font-mono">{fbrRates.cFiler}%</td>
                <td className="font-mono">{fbrRates.cNonFiler}%</td>
              </tr>
              <tr>
                <td>236K purchaser</td>
                <td className="font-mono">{fbrRates.kFiler}%</td>
                <td className="font-mono">{fbrRates.kNonFiler}%</td>
              </tr>
            </tbody>
          </table>
        </section>

        {canConfigure ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Water Tanker Pricing</h2>
              <p className="mt-1 text-sm text-slate-600">
                Set per-type delivery fees. New bookings snapshot the active price — existing bookings keep their recorded charges.
              </p>
            </div>
            <div className="grid gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 lg:grid-cols-2">
              {(
                [
                  { type: "CLEAN_WATER" as const, config: cleanWaterPrice },
                  { type: "CONSTRUCTION_WATER" as const, config: constructionWaterPrice },
                ] as const
              ).map(({ type, config }) => (
                <form key={type} action={updateTankerPriceConfig} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="font-medium text-slate-900">{TANKER_TYPE_LABELS[type]}</h3>
                  <p className="text-sm text-slate-600">
                    Current: {config ? formatCurrency(config.amount) : "Not configured"}
                    {config ? ` · effective ${formatDate(config.effectiveFrom)}` : ""}
                  </p>
                  <input type="hidden" name="tankerType" value={type} />
                  <div>
                    <Label htmlFor={`${type}-amount`}>New amount (PKR)</Label>
                    <Input
                      id={`${type}-amount`}
                      name="amount"
                      type="number"
                      min={1}
                      required
                      className="mt-1"
                      defaultValue={config ? Number(config.amount) : undefined}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${type}-effectiveFrom`}>Effective from</Label>
                    <Input
                      id={`${type}-effectiveFrom`}
                      name="effectiveFrom"
                      type="date"
                      required
                      className="mt-1"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${type}-remarks`}>Remarks (optional)</Label>
                    <Input id={`${type}-remarks`} name="remarks" className="mt-1" />
                  </div>
                  <Button type="submit" variant="outline">
                    Update {TANKER_TYPE_LABELS[type]} price
                  </Button>
                </form>
              ))}
            </div>
            <div className="px-5 py-3 text-sm">
              <Link href="/tankers/slots" className="text-teal-800 hover:underline">
                Manage delivery time slots →
              </Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href="/tankers/fleet" className="text-teal-800 hover:underline">
                Manage tanker fleet →
              </Link>
            </div>
          </section>
        ) : null}

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

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Service Timelines (SLA)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Configurable turnaround targets for transfers, possession, death cases, and NOC/NEC issuance.
            </p>
          </div>
          {canManageSla ? (
            <form action={updateSlaSettings} className="grid gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(SLA_DEFAULTS).map(([key, meta]) => (
                <div key={key}>
                  <Label htmlFor={key}>{meta.label}</Label>
                  <Input
                    id={key}
                    name={key}
                    type="number"
                    min={1}
                    required
                    className="mt-1"
                    defaultValue={slaSettingsMap[key] ?? meta.value}
                  />
                </div>
              ))}
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button type="submit">Save SLA settings</Button>
              </div>
            </form>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SLA_DEFAULTS).map(([key, meta]) => (
                <tr key={key}>
                  <td>{meta.label}</td>
                  <td className="font-mono">{slaSettingsMap[key] ?? meta.value}</td>
                </tr>
              ))}
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

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Plot dues ledger heads</h2>
            <p className="mt-1 text-sm text-slate-600">
              Configurable line items for the plot status / dues slip. Deposited and outstanding rows stay append-only.
            </p>
          </div>
          {canManageDues ? (
            <form action={updatePlotStatusSettingsAction} className="grid gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="society_ntn">Society NTN</Label>
                <Input
                  id="society_ntn"
                  name="society_ntn"
                  className="mt-1"
                  defaultValue={slaSettingsMap.society_ntn ?? ""}
                  placeholder="3557812-2"
                />
              </div>
              <div>
                <Label htmlFor="dues_slip_due_days">Due days from issue</Label>
                <Input
                  id="dues_slip_due_days"
                  name="dues_slip_due_days"
                  type="number"
                  min={1}
                  className="mt-1"
                  defaultValue={slaSettingsMap.dues_slip_due_days ?? DUES_SLIP_DUE_DAYS_DEFAULT}
                />
              </div>
              <div>
                <Label htmlFor="dues_slip_taxation_officer_fee">Taxation officer fee (PKR)</Label>
                <Input
                  id="dues_slip_taxation_officer_fee"
                  name="dues_slip_taxation_officer_fee"
                  type="number"
                  min={0}
                  className="mt-1"
                  defaultValue={slaSettingsMap.dues_slip_taxation_officer_fee ?? DUES_SLIP_TAX_OFFICER_FEE_DEFAULT}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit">Save dues slip settings</Button>
              </div>
            </form>
          ) : null}
          {canManageDues ? (
            <form action={createPlotDuesHeadAction} className="grid gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
              <div>
                <Label htmlFor="duesHeadCode">Head code</Label>
                <Input id="duesHeadCode" name="code" required className="mt-1 font-mono" placeholder="CORNER" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="duesHeadName">Name</Label>
                <Input id="duesHeadName" name="name" required className="mt-1" placeholder="Corner Charges" />
              </div>
              <div>
                <Label htmlFor="duesHeadSort">Sort</Label>
                <Input id="duesHeadSort" name="sortOrder" type="number" className="mt-1" defaultValue={200} />
              </div>
              <div className="flex items-end">
                <Button type="submit">Add head</Button>
              </div>
            </form>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Sort</th>
                <th>Upto date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {duesHeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    No dues heads yet — they are created on first plot-status lookup, or add one above.
                  </td>
                </tr>
              ) : (
                duesHeads.map((h) => (
                  <tr key={h.id}>
                    <td className="font-mono text-sm">{h.code}</td>
                    <td className="font-medium">{h.name}</td>
                    <td>{h.sortOrder}</td>
                    <td>{h.showUptoDate ? "Yes" : "—"}</td>
                    <td>
                      <Badge status={h.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
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
