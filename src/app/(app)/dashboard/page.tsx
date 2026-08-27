import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { formatCurrency } from "@/lib/utils";
import { refreshSlaNotifications } from "@/lib/notifications-sla";
import { LIVE_OPEN_FILE_STATUSES } from "@/lib/open-files";
import { startOfMonth, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (session?.user?.role === "TANKER_OPERATOR") {
    redirect("/tankers");
  }

  await refreshSlaNotifications();
  const today = startOfDay(new Date());
  const now = new Date();
  const monthStart = startOfMonth(new Date());
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);

  const [
    plots,
    activeOwners,
    openFiles,
    pendingTransfers,
    transfersThisMonth,
    pendingNocs,
    pendingNecs,
    activeMortgages,
    outstandingCharges,
    todayCollections,
    filesMoving,
    openFilesExpiring,
    employees,
    presentToday,
    absentToday,
    todayTankersByType,
    tankerCollection,
    overdueTransfers,
    overduePossession,
    overdueNocs,
    overdueNecs,
    unreadNotifications,
    urgentNotifications,
  ] = await Promise.all([
    prisma.plot.count(),
    prisma.ownership.count({ where: { status: "ACTIVE" } }),
    prisma.openFile.count({ where: { status: { in: LIVE_OPEN_FILE_STATUSES } } }),
    prisma.transfer.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } },
    }),
    prisma.transfer.count({
      where: { status: "COMPLETED", completedAt: { gte: monthStart } },
    }),
    prisma.noc.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.nec.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.mortgage.count({ where: { status: "ACTIVE" } }),
    prisma.plotCharge.aggregate({
      where: { status: { in: ["PENDING", "OVERDUE", "BILLED"] } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: { in: ["VERIFIED", "PAID"] },
        OR: [{ paymentDate: { gte: today } }, { verifiedAt: { gte: today } }],
      },
      _sum: { amount: true },
    }),
    prisma.physicalFile.count({ where: { status: { in: ["MOVING", "CHECKED_OUT"] } } }),
    prisma.openFile.count({
      where: { status: { in: LIVE_OPEN_FILE_STATUSES }, expiryDate: { lte: in30 } },
    }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
    prisma.tankerDelivery.groupBy({
      by: ["tankerType"],
      where: { distributionDate: today },
      _count: { _all: true },
    }),
    prisma.tankerDelivery.aggregate({
      where: { distributionDate: today, paymentStatus: { in: ["PAID", "VERIFIED"] } },
      _sum: { charges: true },
    }),
    prisma.transfer.count({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] },
        slaDueAt: { lt: now },
      },
    }),
    prisma.possession.count({
      where: {
        approvalStatus: { notIn: ["ISSUED", "REJECTED"] },
        slaDueAt: { lt: now },
      },
    }),
    prisma.noc.count({
      where: {
        status: { notIn: ["ISSUED", "CANCELLED", "REJECTED", "EXPIRED"] },
        slaDueAt: { lt: now },
      },
    }),
    prisma.nec.count({
      where: {
        status: { notIn: ["ISSUED", "CANCELLED", "REJECTED", "EXPIRED"] },
        slaDueAt: { lt: now },
      },
    }),
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.count({
      where: { isRead: false, priority: { in: ["HIGH", "URGENT"] } },
    }),
  ]);

  const todayClean =
    todayTankersByType.find((row) => row.tankerType === "CLEAN_WATER")?._count._all ?? 0;
  const todayConstruction =
    todayTankersByType.find((row) => row.tankerType === "CONSTRUCTION_WATER")?._count._all ?? 0;
  const todayTankers = todayClean + todayConstruction;

  const recentNotifications = await prisma.notification.findMany({
    where: { isRead: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentTransfers = await prisma.transfer.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: { plot: true },
  });

  const expiringFiles = await prisma.openFile.findMany({
    where: { status: { in: LIVE_OPEN_FILE_STATUSES }, expiryDate: { lte: in30 } },
    include: { plot: true },
    orderBy: { expiryDate: "asc" },
    take: 5,
  });

  return (
    <div>
      <PageHeader
        title="Society Management Dashboard"
        description="Live operational view of plots, transfers, files, staff, and collections."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Plots" value={plots.toLocaleString()} />
        <StatCard label="Active Owners" value={activeOwners.toLocaleString()} />
        <StatCard label="Open Files" value={openFiles} tone="warn" />
        <StatCard label="Pending Transfers" value={pendingTransfers} tone="warn" />
        <StatCard label="Overdue Transfer SLAs" value={overdueTransfers} tone="danger" />
        <StatCard label="Transfers This Month" value={transfersThisMonth} tone="success" />
        <StatCard label="Pending NOCs" value={pendingNocs} />
        <StatCard label="Overdue NOC SLAs" value={overdueNocs} tone={overdueNocs ? "danger" : "default"} />
        <StatCard label="Pending NECs" value={pendingNecs} />
        <StatCard label="Overdue NEC SLAs" value={overdueNecs} tone={overdueNecs ? "danger" : "default"} />
        <StatCard label="Overdue Possession SLAs" value={overduePossession} tone={overduePossession ? "danger" : "default"} />
        <StatCard label="Active Bank Mortgages" value={activeMortgages} tone="danger" />
        <StatCard
          label="Outstanding Plot Charges"
          value={formatCurrency(outstandingCharges._sum.amount ?? 0)}
          tone="warn"
        />
        <StatCard
          label="Today's Collections"
          value={formatCurrency(todayCollections._sum.amount ?? 0)}
          tone="success"
        />
        <StatCard label="Files Currently Moving" value={filesMoving} />
        <StatCard label="Open Files Expiring <30d" value={openFilesExpiring} tone="danger" />
        <StatCard label="Employees" value={employees} />
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent" value={absentToday} tone={absentToday ? "warn" : "default"} />
        <StatCard
          label="Today's Tankers"
          value={todayTankers}
          hint={`Clean ${todayClean} · Construction ${todayConstruction}`}
        />
        <StatCard
          label="Today's Tanker Collection"
          value={formatCurrency(tankerCollection._sum.charges ?? 0)}
        />
        <StatCard
          label="Unread Notifications"
          value={unreadNotifications}
          tone={unreadNotifications ? "warn" : "default"}
        />
        <StatCard
          label="Urgent Alerts"
          value={urgentNotifications}
          tone={urgentNotifications ? "danger" : "default"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {recentNotifications.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-1">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Unread Alerts</h2>
              <Link href="/notifications" className="text-sm text-teal-800 hover:underline">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {recentNotifications.map((n) => (
                <li key={n.id} className="py-3">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.message}</p>
                  {n.href ? (
                    <Link href={n.href} className="mt-1 inline-block text-xs text-teal-800 hover:underline">
                      Open →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${recentNotifications.length > 0 ? "" : "lg:col-span-1"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Recent Transfers</h2>
            <Link href="/transfers" className="text-sm text-teal-800 hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Plot</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/transfers/${t.id}`} className="font-medium text-teal-900 hover:underline">
                        {t.transferNumber}
                      </Link>
                    </td>
                    <td>
                      {t.plot.sector}/{t.plot.block}-{t.plot.plotNumber}
                    </td>
                    <td>{t.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Open Files Expiring Soon</h2>
            <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Open File</th>
                  <th>Plot</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {expiringFiles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-slate-500">
                      No open files expiring within 30 days.
                    </td>
                  </tr>
                ) : (
                  expiringFiles.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/open-files/${f.id}`} className="font-medium text-teal-900 hover:underline">
                          {f.openFileNumber}
                        </Link>
                      </td>
                      <td>
                        {f.plot.sector}/{f.plot.block}-{f.plot.plotNumber}
                      </td>
                      <td>{f.expiryDate.toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
