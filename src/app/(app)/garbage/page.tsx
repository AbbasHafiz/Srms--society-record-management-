import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/employees/designation-badge";
import { createGarbageCollection, updateGarbageCollectionStatus } from "./actions";
import { listGarbageCollectors } from "@/lib/tankers";
import { formatCurrency } from "@/lib/utils";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function GarbagePage() {
  const today = startOfDay(new Date());
  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const [collections, collectors, pending, completed] = await Promise.all([
    prisma.garbageCollection.findMany({
      where: { collectionDate: today },
      include: { collector: { include: { orgRole: true } } },
      orderBy: [{ status: "asc" }, { area: "asc" }],
    }),
    listGarbageCollectors(),
    prisma.garbageCollection.count({ where: { collectionDate: today, status: "PENDING" } }),
    prisma.garbageCollection.count({ where: { collectionDate: today, status: "COMPLETED" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Garbage Collection"
        description={`Daily collection rounds for ${today.toLocaleDateString("en-GB")}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard label="Pending rounds" value={pending} tone={pending ? "warn" : "default"} />
        <StatCard label="Completed" value={completed} tone="success" />
      </div>

      {canCreate ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Log collection round</h2>
          <form action={createGarbageCollection} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Date</span>
              <input
                type="date"
                name="collectionDate"
                defaultValue={today.toISOString().slice(0, 10)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Area *</span>
              <input name="area" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" placeholder="Sector / block" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Street</span>
              <input name="street" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">House no.</span>
              <input name="houseNo" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Collector *</span>
              <select name="collectorId" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Select collector…</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.employeeCode})</option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-3">
              <span className="mb-1 block font-medium text-slate-700">Remarks</span>
              <input name="remarks" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <div>
              <Button type="submit">Add round</Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Today&apos;s rounds</h2>
        </div>
        {collections.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No garbage collection rounds logged today.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Location</th>
                <th>Collector</th>
                <th>Charges</th>
                <th>Status</th>
                {canCreate ? <th>Mark</th> : null}
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.area}</td>
                  <td>{[c.street, c.houseNo].filter(Boolean).join(", ") || "—"}</td>
                  <td>
                    <div className="font-medium">{c.collector.name}</div>
                    <RoleBadge orgRole={c.collector.orgRole} designation={c.collector.designation} />
                  </td>
                  <td>{c.charges != null ? formatCurrency(c.charges) : "—"}</td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                  {canCreate ? (
                    <td>
                      {c.status === "PENDING" ? (
                        <form action={updateGarbageCollectionStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="status" value="COMPLETED" />
                          <Button type="submit" size="sm" variant="outline">
                            Complete
                          </Button>
                        </form>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-4 text-sm text-slate-500">
        Collectors are staff with Sweeper or Garbage Collector role.{" "}
        <Link href="/employees" className="text-teal-800 hover:underline">Manage staff</Link>
      </p>
    </div>
  );
}
