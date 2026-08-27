import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getTotalBulkStockRemaining,
  listBulkMotherTankers,
  listBulkPurchasesWithRemaining,
  listDistributionTankers,
  listRecentTankerFills,
} from "@/lib/tankers";
import { createBulkPurchase, createTankerFill } from "../stock-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STOCK_TABS = [
  { id: "purchases", label: "Bulk purchases" },
  { id: "fills", label: "Fill small tankers" },
] as const;

function stockTabHref(tab: string) {
  return tab === "purchases" ? "/tankers/stock" : `/tankers/stock?tab=${tab}`;
}

export default async function TankerStockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "fills" ? "fills" : "purchases";
  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const [totalRemaining, purchases, distributionTankers, motherTankers, recentFills] =
    await Promise.all([
      getTotalBulkStockRemaining(),
      listBulkPurchasesWithRemaining(),
      listDistributionTankers(),
      listBulkMotherTankers(),
      listRecentTankerFills(15),
    ]);

  const purchasesWithStock = purchases.filter((p) => p.remainingLiters > 0);
  const totalPurchased = purchases.reduce((sum, p) => sum + p.volumeLiters, 0);
  const totalFilled = purchases.reduce((sum, p) => sum + p.filledLiters, 0);

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description="Bulk water intake from mother tankers and distribution into fleet tankers."
      />

      <TankerNav active="stock" />

      {sp.error ? <FormErrorBanner message={sp.error} /> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Remaining bulk stock"
          value={`${totalRemaining.toLocaleString()} L`}
          tone={totalRemaining > 0 ? "success" : "warn"}
          hint="Across all bulk purchases"
        />
        <StatCard label="Total purchased" value={`${totalPurchased.toLocaleString()} L`} />
        <StatCard label="Distributed to fleet" value={`${totalFilled.toLocaleString()} L`} tone="default" />
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {STOCK_TABS.map((t) => (
          <Link
            key={t.id}
            href={stockTabHref(t.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-teal-800 bg-teal-50 text-teal-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "purchases" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Bulk purchases</h2>
              <p className="text-sm text-slate-500">
                Society purchases of large tanker loads — remaining volume is computed from fill history.
              </p>
            </div>

            {purchases.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">No bulk purchases recorded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Source / vendor</th>
                    <th>Volume</th>
                    <th>Remaining</th>
                    <th>Cost</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium">{p.purchaseNumber}</div>
                        <div className="text-xs text-slate-500">{formatDate(p.purchaseDate)}</div>
                        {p.motherTanker ? (
                          <div className="text-xs text-slate-500">Mother: {p.motherTanker.tankerCode}</div>
                        ) : null}
                      </td>
                      <td>{p.sourceVendor}</td>
                      <td>{p.volumeLiters.toLocaleString()} L</td>
                      <td>
                        <span
                          className={cn(
                            "font-medium",
                            p.remainingLiters > 0 ? "text-emerald-700" : "text-slate-400"
                          )}
                        >
                          {p.remainingLiters.toLocaleString()} L
                        </span>
                        {p.filledLiters > 0 ? (
                          <div className="text-xs text-slate-500">
                            {p.filledLiters.toLocaleString()} L distributed
                          </div>
                        ) : null}
                      </td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>
                        <Badge status={p.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {canCreate ? (
            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display mb-1 text-lg font-semibold">Record bulk purchase</h2>
              <p className="mb-4 text-sm text-slate-500">
                Log intake when society receives a large tanker load from an external vendor.
              </p>
              <form action={createBulkPurchase} className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Purchase date *</span>
                  <input
                    name="purchaseDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Source / vendor *</span>
                  <input
                    name="sourceVendor"
                    required
                    placeholder="e.g. CDA Water Supply"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Volume received (liters) *</span>
                  <input
                    name="volumeLiters"
                    type="number"
                    required
                    min={1}
                    step={1}
                    placeholder="e.g. 50000"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Amount / cost (PKR) *</span>
                  <input
                    name="amount"
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    placeholder="e.g. 25000"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Payment status</span>
                  <select
                    name="paymentStatus"
                    defaultValue="PENDING"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </label>
                {motherTankers.length > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Mother tanker (optional)</span>
                    <select
                      name="motherTankerId"
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Not linked</option>
                      {motherTankers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.tankerCode} ({t.capacityLiters.toLocaleString()} L)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Remarks</span>
                  <textarea
                    name="remarks"
                    rows={2}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <Button type="submit" className="w-full">
                  Save bulk purchase
                </Button>
              </form>
            </aside>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Recent fills</h2>
              <p className="text-sm text-slate-500">
                Water transferred from bulk stock into distribution tankers.
              </p>
            </div>

            {recentFills.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">No fills recorded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>From purchase</th>
                    <th>To tanker</th>
                    <th>Volume</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFills.map((f) => (
                    <tr key={f.id}>
                      <td>{formatDate(f.filledAt)}</td>
                      <td>
                        <div className="font-medium">{f.purchase.purchaseNumber}</div>
                        <div className="text-xs text-slate-500">{f.purchase.sourceVendor}</div>
                      </td>
                      <td>
                        <div className="font-medium">{f.toTanker.tankerCode}</div>
                        <div className="text-xs text-slate-500">{f.toTanker.capacityLiters.toLocaleString()} L cap.</div>
                      </td>
                      <td className="font-medium">{f.volumeLiters.toLocaleString()} L</td>
                      <td>{f.filledBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {canCreate ? (
            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display mb-1 text-lg font-semibold">Fill small tanker</h2>
              <p className="mb-4 text-sm text-slate-500">
                Distribute water from a bulk purchase into a fleet distribution tanker.
              </p>

              {purchasesWithStock.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No bulk purchases with remaining water.{" "}
                  <Link href="/tankers/stock" className="font-medium underline">
                    Record a purchase first
                  </Link>
                  .
                </p>
              ) : distributionTankers.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No active distribution tankers in the fleet.
                </p>
              ) : (
                <form action={createTankerFill} className="space-y-4">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Bulk purchase *</span>
                    <select
                      name="purchaseId"
                      required
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Select purchase…</option>
                      {purchasesWithStock.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.purchaseNumber} — {p.remainingLiters.toLocaleString()} L left ({p.sourceVendor})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Distribution tanker *</span>
                    <select
                      name="toTankerId"
                      required
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Select tanker…</option>
                      {distributionTankers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.tankerCode} ({t.capacityLiters.toLocaleString()} L)
                          {t.driver ? ` — ${t.driver.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Volume (liters) *</span>
                    <input
                      name="volumeLiters"
                      type="number"
                      required
                      min={1}
                      step={1}
                      placeholder="e.g. 5000"
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Remarks</span>
                    <textarea
                      name="remarks"
                      rows={2}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <Button type="submit" className="w-full">
                    Record fill
                  </Button>
                </form>
              )}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
