import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, labelize } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import {
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
} from "./actions";
import type { NotificationType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const TYPES: NotificationType[] = [
  "SLA_OVERDUE",
  "OPEN_FILE_EXPIRY",
  "TANKER_SCHEDULE",
  "PENDING_TRANSFER",
  "MORTGAGE_WARNING",
  "ANNUAL_CHARGE_OVERDUE",
  "GENERAL",
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const unreadOnly = sp.unread === "1";
  const type = sp.type?.trim() as NotificationType | undefined;
  const session = await auth();

  const [notifications, unreadCount, urgentCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        ...(unreadOnly ? { isRead: false } : {}),
        ...(type && TYPES.includes(type) ? { type } : {}),
      },
      include: {
        plot: {
          select: {
            id: true,
            sector: true,
            block: true,
            plotNumber: true,
            ownerships: {
              where: { status: "ACTIVE" },
              take: 1,
              select: { ownerName: true, contact: true },
            },
          },
        },
      },
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.count({ where: { isRead: false, priority: { in: ["HIGH", "URGENT"] } } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Operational alerts — SLA overdue, open file expiry, tanker schedules, pending transfers, and mortgage warnings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/notifications/whatsapp"
              className="text-sm text-teal-800 hover:underline"
            >
              WhatsApp outbox
            </Link>
            {unreadCount > 0 ? (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="outline" size="sm">
                  Mark all read ({unreadCount})
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Unread" value={unreadCount} tone={unreadCount ? "warn" : "default"} />
        <StatCard label="Urgent / High" value={urgentCount} tone={urgentCount ? "danger" : "default"} />
        <StatCard label="Showing" value={notifications.length} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="type"
          defaultValue={type ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{labelize(t)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="unread" value="1" defaultChecked={unreadOnly} />
          Unread only
        </label>
        <Button type="submit">Filter</Button>
      </form>

      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <article
              key={n.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                n.isRead ? "border-slate-200" : "border-teal-200 bg-teal-50/30"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{labelize(n.type)}</Badge>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        n.priority === "URGENT" || n.priority === "HIGH"
                          ? "bg-rose-100 text-rose-800"
                          : n.priority === "NORMAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {labelize(n.priority)}
                    </span>
                    {!n.isRead ? (
                      <span className="text-xs font-medium text-teal-700">New</span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 font-display text-base font-semibold text-slate-900">{n.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.plot ? (
                      <span>
                        Plot: {n.plot.sector}/{n.plot.block}-{n.plot.plotNumber}
                      </span>
                    ) : null}
                    {n.href ? (
                      <Link href={n.href} className="font-medium text-teal-800 hover:underline">
                        View details →
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {session?.user && n.plot?.ownerships[0]?.contact ? (
                    <WhatsAppNotifyAction
                      userRole={session.user.role}
                      relatedModule="notifications"
                      relatedRecordId={n.id}
                      plotId={n.plotId ?? undefined}
                      defaultTemplateKey="custom_message"
                      templateVars={{
                        plotLabel: plotLabel(n.plot),
                        message: n.message,
                      }}
                      presets={[
                        {
                          key: "owner",
                          label: "Plot owner",
                          name: n.plot.ownerships[0].ownerName,
                          phone: n.plot.ownerships[0].contact!,
                          type: "OWNER",
                        },
                      ]}
                      allowedModes={["preset", "custom"]}
                      label="WhatsApp"
                    />
                  ) : null}
                  {n.isRead ? (
                    <form action={markNotificationUnread}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button type="submit" size="sm" variant="outline">Mark unread</Button>
                    </form>
                  ) : (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button type="submit" size="sm">Mark read</Button>
                    </form>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
