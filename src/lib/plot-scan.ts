import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";
import type { FileLocation } from "@/generated/prisma/client";

const OUTSTANDING_CHARGE_STATUSES = ["PENDING", "BILLED", "OVERDUE"] as const;
const OUTSTANDING_PAYMENT_STATUSES = ["PENDING", "SUBMITTED", "OVERDUE", "UNPAID", "PARTIAL"] as const;

const plotScanInclude = {
  ownerships: { orderBy: { startDate: "desc" as const } },
  mortgages: { orderBy: { createdAt: "desc" as const } },
  openFiles: { orderBy: { openingDate: "desc" as const } },
  plotCharges: {
    where: { status: { in: [...OUTSTANDING_CHARGE_STATUSES] } },
    orderBy: [{ year: "desc" as const }, { month: "desc" as const }],
  },
  payments: {
    where: { status: { in: [...OUTSTANDING_PAYMENT_STATUSES] } },
    orderBy: { createdAt: "desc" as const },
  },
  physicalFile: { include: { currentLocation: true } },
};

export function formatLockerPath(loc: FileLocation | null | undefined): string {
  if (!loc) return "—";
  const parts = [loc.building, loc.room, loc.almirah, loc.locker];
  if (loc.shelf) parts.push(`Shelf ${loc.shelf}`);
  if (loc.position) parts.push(`Pos ${loc.position}`);
  if (loc.label) parts.push(`(${loc.label})`);
  return parts.join(" › ");
}

export function maskCnic(cnic: string, role: Role): string {
  const fullAccess: Role[] = [
    "SUPER_ADMIN",
    "PRESIDENT",
    "SECRETARY",
    "GM",
    "TRANSFER_OFFICER",
    "ASSOCIATE_TRANSFER_OFFICER",
    "RECORD_MANAGER",
    "FINANCE",
  ];
  if (fullAccess.includes(role)) return cnic;

  const parts = cnic.split("-");
  if (parts.length === 3) return `${parts[0]}-*****-${parts[2]}`;
  if (cnic.length > 8) return `${cnic.slice(0, 4)}****${cnic.slice(-4)}`;
  return "****";
}

function parseBarcodePlot(code: string): { sector: string; block: string; plotNumber: string } | null {
  const match = code.match(/^PF-(.+)-([^-]+)-(.+)$/i);
  if (!match) return null;
  return { sector: match[1], block: match[2], plotNumber: match[3] };
}

export async function lookupPlotByScanCode(code: string) {
  const normalized = decodeURIComponent(code).trim();
  if (!normalized) return null;

  const physicalFile = await prisma.physicalFile.findFirst({
    where: {
      OR: [{ barcode: normalized }, { fileNumber: normalized }],
    },
    include: {
      plot: { include: plotScanInclude },
      currentLocation: true,
    },
  });

  if (physicalFile) {
    return { physicalFile, plot: physicalFile.plot, lookupCode: normalized };
  }

  const barcodePlot = parseBarcodePlot(normalized);
  if (barcodePlot) {
    const plot = await prisma.plot.findFirst({
      where: {
        sector: barcodePlot.sector,
        block: barcodePlot.block,
        plotNumber: barcodePlot.plotNumber,
      },
      include: plotScanInclude,
    });
    if (plot) {
      return { physicalFile: plot.physicalFile, plot, lookupCode: normalized };
    }
  }

  const plotByNumber = await prisma.plot.findFirst({
    where: { plotNumber: normalized },
    include: plotScanInclude,
    orderBy: { createdAt: "desc" },
  });

  if (plotByNumber) {
    return { physicalFile: plotByNumber.physicalFile, plot: plotByNumber, lookupCode: normalized };
  }

  return null;
}

export function summarizeOutstanding(plot: {
  plotCharges: Array<{ amount: { toString(): string }; status: string; year: number; month: number | null }>;
  payments: Array<{ amount: { toString(): string }; status: string; feeType: string; receiptNumber: string }>;
}) {
  const chargeTotal = plot.plotCharges.reduce((sum, c) => sum + Number(c.amount), 0);
  const paymentTotal = plot.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    chargeTotal,
    paymentTotal,
    grandTotal: chargeTotal + paymentTotal,
  };
}

export function possessionLabel(status: string): string {
  switch (status) {
    case "ISSUED":
      return "Possession Issued";
    case "APPROVED":
      return "Possession Approved";
    case "PENDING":
      return "Possession Pending";
    case "APPLIED":
      return "Possession Applied";
    case "REJECTED":
      return "Possession Rejected";
    case "NOT_APPLIED":
    default:
      return "Non-Possession / Not Applied";
  }
}

export function isNonPossession(possessionStatus: string, developmentStatus: string): boolean {
  return possessionStatus !== "ISSUED" || developmentStatus === "UNDEVELOPED" || developmentStatus === "VACANT";
}
