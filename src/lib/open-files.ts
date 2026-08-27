import { prisma } from "@/lib/db";
import type { ChargePeriodStatus, OpenFileStatus, Prisma } from "@/generated/prisma/client";

/** Files currently on the market (seller still owns the plot). */
export const LIVE_OPEN_FILE_STATUSES: OpenFileStatus[] = ["ACTIVE", "OPEN"];

/** List filter "Open" — still a dealer listing, including expired windows. */
export const OPEN_LIST_STATUSES: OpenFileStatus[] = ["ACTIVE", "OPEN", "EXPIRED"];

export const UNPAID_PLOT_CHARGE_STATUSES: ChargePeriodStatus[] = ["PENDING", "BILLED", "OVERDUE"];

export function isLiveOpenFileStatus(status: string): boolean {
  return LIVE_OPEN_FILE_STATUSES.includes(status as OpenFileStatus);
}

export function openFileStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed in purchaser's name";
    case "CANCELLED":
      return "Cancelled / withdrawn";
    case "EXPIRED":
      return "Expired";
    default:
      return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function isRegisteredDealerActive(office: {
  status: string;
  expiryDate?: Date | string | null;
}): boolean {
  if (office.status !== "ACTIVE") return false;
  if (!office.expiryDate) return true;
  const expiry = office.expiryDate instanceof Date ? office.expiryDate : new Date(office.expiryDate);
  if (Number.isNaN(expiry.getTime())) return true;
  return expiry.getTime() >= Date.now();
}

export async function getOutstandingPlotCharges(plotId: string) {
  return prisma.plotCharge.findMany({
    where: { plotId, status: { in: UNPAID_PLOT_CHARGE_STATUSES } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
}

export async function syncPlotHasOpenFile(
  plotId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const live = await db.openFile.count({
    where: { plotId, status: { in: LIVE_OPEN_FILE_STATUSES } },
  });
  await db.plot.update({
    where: { id: plotId },
    data: { hasOpenFile: live > 0 },
  });
}

export async function closeOpenFilesForTransfer(
  tx: Prisma.TransactionClient,
  input: {
    plotId: string;
    transferId: string;
    purchaserName: string | null;
    purchaserCnic: string | null;
    purchaserContact: string | null;
    purchaserAddress: string | null;
    closedDate: Date;
  }
) {
  await tx.openFile.updateMany({
    where: {
      plotId: input.plotId,
      OR: [{ transferId: input.transferId }, { status: { in: LIVE_OPEN_FILE_STATUSES } }],
    },
    data: {
      status: "CLOSED",
      closedDate: input.closedDate,
      transferId: input.transferId,
      purchaserName: input.purchaserName,
      purchaserCnic: input.purchaserCnic,
      purchaserContact: input.purchaserContact,
      purchaserAddress: input.purchaserAddress,
    },
  });
  await tx.plot.update({
    where: { id: input.plotId },
    data: { hasOpenFile: false },
  });
}
