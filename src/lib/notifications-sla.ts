import { format, startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import type { NotificationPriority, NotificationType } from "@/generated/prisma/client";
import { plotLabel } from "@/lib/plots";

type UpsertInput = {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  href?: string | null;
  plotId?: string | null;
  recordId: string;
};

async function upsertDailyNotification(input: UpsertInput) {
  const dayStart = startOfDay(new Date());
  const dayKey = format(dayStart, "yyyy-MM-dd");

  const existing = await prisma.notification.findFirst({
    where: {
      type: input.type,
      recordId: input.recordId,
      createdAt: { gte: dayStart },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.isRead) return existing;
    return prisma.notification.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        message: input.message,
        href: input.href ?? undefined,
        plotId: input.plotId ?? undefined,
        priority: input.priority,
      },
    });
  }

  return prisma.notification.create({
    data: {
      type: input.type,
      priority: input.priority,
      title: input.title,
      message: input.message,
      href: input.href ?? undefined,
      plotId: input.plotId ?? undefined,
      recordId: `${input.recordId}:${dayKey}`,
    },
  });
}

export async function refreshSlaNotifications() {
  const now = new Date();
  const today = startOfDay(now);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);

  const [
    overdueTransfers,
    overdueAllotment,
    overduePossession,
    overdueNocs,
    overdueNecs,
    expiringOpenFiles,
    overdueCharges,
    activeMortgages,
    todayTankers,
    pendingTransfers,
  ] = await Promise.all([
    prisma.transfer.findMany({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] },
        slaDueAt: { lt: now },
      },
      include: { plot: true },
      take: 50,
    }),
    prisma.transfer.findMany({
      where: {
        status: "COMPLETED",
        allotmentLetterPrintedAt: null,
        allotmentLetterDueAt: { lt: now },
      },
      include: { plot: true },
      take: 50,
    }),
    prisma.possession.findMany({
      where: {
        approvalStatus: { notIn: ["ISSUED", "REJECTED", "CANCELLED"] },
        slaDueAt: { lt: now },
      },
      include: { plot: true },
      take: 50,
    }),
    prisma.noc.findMany({
      where: {
        status: { notIn: ["ISSUED", "CANCELLED", "REJECTED", "EXPIRED"] },
        slaDueAt: { lt: now },
      },
      include: { plot: true },
      take: 50,
    }),
    prisma.nec.findMany({
      where: {
        status: { notIn: ["ISSUED", "CANCELLED", "REJECTED", "EXPIRED"] },
        slaDueAt: { lt: now },
      },
      include: { plot: true },
      take: 50,
    }),
    prisma.openFile.findMany({
      where: { status: "ACTIVE", expiryDate: { lte: in30 } },
      include: { plot: true },
      orderBy: { expiryDate: "asc" },
      take: 50,
    }),
    prisma.plotCharge.findMany({
      where: { status: { in: ["OVERDUE", "BILLED", "PENDING"] }, dueDate: { lt: now } },
      include: { plot: true },
      take: 50,
    }),
    prisma.mortgage.findMany({
      where: { status: "ACTIVE" },
      include: { plot: true },
      take: 20,
    }),
    prisma.tankerDelivery.findMany({
      where: { distributionDate: today },
      include: { plot: true },
      take: 20,
    }),
    prisma.transfer.count({
      where: { status: { in: ["PAYMENT_PENDING", "PAYMENT_VERIFICATION"] } },
    }),
  ]);

  let createdOrUpdated = 0;

  for (const t of overdueTransfers) {
    await upsertDailyNotification({
      type: "SLA_OVERDUE",
      priority: "URGENT",
      title: "Transfer SLA overdue",
      message: `Transfer ${t.transferNumber} for plot ${plotLabel(t.plot)} has passed its SLA due date.`,
      href: `/transfers/${t.id}`,
      plotId: t.plotId,
      recordId: `transfer-sla:${t.id}`,
    });
    createdOrUpdated++;
  }

  for (const t of overdueAllotment) {
    await upsertDailyNotification({
      type: "SLA_OVERDUE",
      priority: "HIGH",
      title: "Allotment letter overdue",
      message: `Completed transfer ${t.transferNumber} — allotment letter printing is overdue for plot ${plotLabel(t.plot)}.`,
      href: `/transfers/${t.id}`,
      plotId: t.plotId,
      recordId: `allotment-sla:${t.id}`,
    });
    createdOrUpdated++;
  }

  for (const p of overduePossession) {
    await upsertDailyNotification({
      type: "SLA_OVERDUE",
      priority: "HIGH",
      title: "Possession SLA overdue",
      message: `Possession application ${p.applicationNumber} for plot ${plotLabel(p.plot)} is past SLA.`,
      href: `/possession/${p.id}`,
      plotId: p.plotId,
      recordId: `possession-sla:${p.id}`,
    });
    createdOrUpdated++;
  }

  for (const n of overdueNocs) {
    await upsertDailyNotification({
      type: "SLA_OVERDUE",
      priority: "HIGH",
      title: "NOC SLA overdue",
      message: `NOC application ${n.applicationNumber} for plot ${plotLabel(n.plot)} is past SLA.`,
      href: `/noc/${n.id}`,
      plotId: n.plotId,
      recordId: `noc-sla:${n.id}`,
    });
    createdOrUpdated++;
  }

  for (const n of overdueNecs) {
    await upsertDailyNotification({
      type: "SLA_OVERDUE",
      priority: "HIGH",
      title: "NEC SLA overdue",
      message: `NEC application ${n.applicationNumber} for plot ${plotLabel(n.plot)} is past SLA.`,
      href: `/nec/${n.id}`,
      plotId: n.plotId,
      recordId: `nec-sla:${n.id}`,
    });
    createdOrUpdated++;
  }

  for (const f of expiringOpenFiles) {
    await upsertDailyNotification({
      type: "OPEN_FILE_EXPIRY",
      priority: "HIGH",
      title: "Open file expiring soon",
      message: `Open file ${f.openFileNumber} for plot ${plotLabel(f.plot)} expires on ${f.expiryDate.toLocaleDateString("en-GB")}.`,
      href: `/open-files/${f.id}`,
      plotId: f.plotId,
      recordId: `open-file:${f.id}`,
    });
    createdOrUpdated++;
  }

  for (const c of overdueCharges) {
    await upsertDailyNotification({
      type: "ANNUAL_CHARGE_OVERDUE",
      priority: "NORMAL",
      title: "Plot charge overdue",
      message: `Plot ${plotLabel(c.plot)} has overdue charges for ${c.year}${c.month ? `/${c.month}` : ""}.`,
      href: `/annual-charges?plotId=${c.plotId}`,
      plotId: c.plotId,
      recordId: `charge:${c.id}`,
    });
    createdOrUpdated++;
  }

  for (const m of activeMortgages) {
    await upsertDailyNotification({
      type: "MORTGAGE_WARNING",
      priority: "NORMAL",
      title: "Active mortgage reminder",
      message: `Plot ${plotLabel(m.plot)} has an active mortgage with ${m.bankName}. Transfers require bank clearance.`,
      href: `/mortgages/${m.id}`,
      plotId: m.plotId,
      recordId: `mortgage:${m.id}`,
    });
    createdOrUpdated++;
  }

  if (todayTankers.length > 0) {
    await upsertDailyNotification({
      type: "TANKER_SCHEDULE",
      priority: "NORMAL",
      title: "Tanker deliveries today",
      message: `${todayTankers.length} water tanker booking(s) scheduled for today. Review dispatch and collections.`,
      href: "/tankers",
      recordId: `tanker-schedule:${format(today, "yyyy-MM-dd")}`,
    });
    createdOrUpdated++;
  }

  if (pendingTransfers > 0) {
    await upsertDailyNotification({
      type: "PENDING_TRANSFER",
      priority: "NORMAL",
      title: "Pending transfer payments",
      message: `${pendingTransfers} transfer(s) awaiting payment verification.`,
      href: "/transfers?status=PAYMENT_PENDING",
      recordId: "pending-transfers",
    });
    createdOrUpdated++;
  }

  return { createdOrUpdated };
}
