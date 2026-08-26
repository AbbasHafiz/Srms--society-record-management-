import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const moduleFilter = sp.module?.trim();
  const actionFilter = sp.action?.trim();

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(actionFilter ? { action: { contains: actionFilter, mode: "insensitive" } } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      plot: { select: { sector: true, block: true, plotNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable record of system changes. History is never overwritten."
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          name="module"
          placeholder="Module (e.g. transfers)"
          defaultValue={moduleFilter}
          className="flex h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <input
          name="action"
          placeholder="Action (e.g. PAYMENT_VERIFIED)"
          defaultValue={actionFilter}
          className="flex h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState title="No audit entries" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record</th>
                <th>Plot</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-sm">{formatDateTime(log.createdAt)}</td>
                  <td>
                    {log.user ? (
                      <span>
                        {log.user.name}
                        <div className="text-xs text-slate-500">{log.user.email}</div>
                      </span>
                    ) : (
                      "System"
                    )}
                  </td>
                  <td className="font-mono text-xs">{log.action}</td>
                  <td>{log.module}</td>
                  <td className="font-mono text-xs">{log.recordId ?? "—"}</td>
                  <td>
                    {log.plot ? (
                      <Link href={`/plots/${log.plotId}`} className="text-teal-900 hover:underline">
                        {log.plot.sector}/{log.plot.block}-{log.plot.plotNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-xs truncate text-sm text-slate-600">{log.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
