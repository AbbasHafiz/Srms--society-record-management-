import { prisma } from "@/lib/db";
import { getAppBaseUrl, generateQrDataUrl } from "@/lib/qr";
import { getSystemSetting } from "@/lib/system-settings";
import { getSocietyLetterhead } from "@/lib/print";
import type { PlotDuesEntryKind, Role } from "@/generated/prisma/client";
import {
  DEFAULT_PLOT_DUES_HEADS,
  DUES_SLIP_DUE_DAYS_DEFAULT,
  DUES_SLIP_DUE_DAYS_KEY,
  DUES_SLIP_TAX_OFFICER_FEE_DEFAULT,
  DUES_SLIP_TAX_OFFICER_FEE_KEY,
  OUTSTANDING_CHARGE_STATUSES,
  OUTSTANDING_PAYMENT_STATUSES,
  PAID_CHARGE_STATUSES,
  PAID_PAYMENT_STATUSES,
  SOCIETY_NTN_KEY,
  digitsOnly,
  looksLikeUrl,
  normalizeLookupValue,
  parsePlotStatusSearch,
  parseStatusQrPayload,
  plotSizeLine,
  type ParsedPlotStatusQuery,
} from "@/lib/plot-dues-shared";
import { lookupPlotByScanCode } from "@/lib/plot-scan";

export {
  parsePlotStatusSearch,
  parseStatusQrPayload,
  plotSizeLine,
  looksLikeUrl,
} from "@/lib/plot-dues-shared";
export type { ParsedPlotStatusQuery };

const PAID_PAY = [...PAID_PAYMENT_STATUSES];
const OPEN_PAY = [...OUTSTANDING_PAYMENT_STATUSES];
const PAID_CHG = [...PAID_CHARGE_STATUSES];
const OPEN_CHG = [...OUTSTANDING_CHARGE_STATUSES];

export async function ensureDefaultPlotDuesHeads() {
  for (const head of DEFAULT_PLOT_DUES_HEADS) {
    await prisma.plotDuesHead.upsert({
      where: { code: head.code },
      create: {
        code: head.code,
        name: head.name,
        sortOrder: head.sortOrder,
        showUptoDate: head.showUptoDate ?? false,
        showInDeposited: head.showInDeposited ?? true,
        showInOutstanding: head.showInOutstanding ?? true,
        isExtraFee: head.isExtraFee ?? false,
      },
      update: {
        name: head.name,
        sortOrder: head.sortOrder,
        showUptoDate: head.showUptoDate ?? false,
        showInDeposited: head.showInDeposited ?? true,
        showInOutstanding: head.showInOutstanding ?? true,
        isExtraFee: head.isExtraFee ?? false,
      },
    });
  }
}

export async function getSocietyNtn(): Promise<string | null> {
  const ntn = await getSystemSetting(SOCIETY_NTN_KEY);
  return ntn?.trim() || null;
}

async function getDueDays(): Promise<number> {
  const raw = await getSystemSetting(DUES_SLIP_DUE_DAYS_KEY);
  const n = raw ? Number(raw) : DUES_SLIP_DUE_DAYS_DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : DUES_SLIP_DUE_DAYS_DEFAULT;
}

async function getDefaultTaxationOfficerFee(): Promise<number> {
  const raw = await getSystemSetting(DUES_SLIP_TAX_OFFICER_FEE_KEY);
  const n = raw ? Number(raw) : DUES_SLIP_TAX_OFFICER_FEE_DEFAULT;
  return Number.isFinite(n) && n >= 0 ? n : DUES_SLIP_TAX_OFFICER_FEE_DEFAULT;
}

function sumAmounts(rows: Array<{ amount: { toString(): string } | number }>): number {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

export type PlotDuesLookupError = "not_found" | "invalid_qr";

export type PlotDuesLookupResult =
  | { ok: false; error: PlotDuesLookupError; message: string }
  | { ok: true; plotId: string };

export async function resolvePlotDuesLookup(input: {
  membership?: string | null;
  cnic?: string | null;
  q?: string | null;
  code?: string | null;
}): Promise<PlotDuesLookupResult> {
  const parsed = parsePlotStatusSearch(input);
  if (parsed.kind === "empty") {
    return { ok: false, error: "not_found", message: "Enter a membership number, CNIC, or QR code." };
  }
  if (parsed.kind === "invalid_qr") {
    return { ok: false, error: "invalid_qr", message: parsed.message };
  }

  const membership = parsed.membership?.trim();
  const cnic = parsed.cnic?.trim();
  const code = parsed.code?.trim();

  if (membership) {
    const ownership = await prisma.ownership.findFirst({
      where: { membershipNumber: { equals: membership, mode: "insensitive" } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      select: { plotId: true },
    });
    if (ownership) return { ok: true, plotId: ownership.plotId };
  }

  if (cnic) {
    const digits = digitsOnly(cnic);
    const ownerships = await prisma.ownership.findMany({
      where: {
        OR: [
          { cnic: { equals: cnic, mode: "insensitive" } },
          ...(digits.length >= 5
            ? [
                { cnic: { startsWith: `${digits.slice(0, 5)}-` } },
                { cnic: { startsWith: digits.slice(0, 5) } },
              ]
            : []),
        ],
      },
      select: { plotId: true, cnic: true },
      take: 40,
    });
    const match = ownerships.find(
      (o) => o.cnic.toLowerCase() === cnic.toLowerCase() || (digits.length >= 11 && digitsOnly(o.cnic) === digits)
    );
    if (match) return { ok: true, plotId: match.plotId };
  }

  if (code) {
    if (/^[a-z0-9]{20,}$/i.test(code)) {
      const byId = await prisma.plot.findUnique({ where: { id: code }, select: { id: true } });
      if (byId) return { ok: true, plotId: byId.id };
    }

    const scanned = await lookupPlotByScanCode(code);
    if (scanned?.plot?.id) return { ok: true, plotId: scanned.plot.id };

    const byMembership = await prisma.ownership.findFirst({
      where: { membershipNumber: { equals: code, mode: "insensitive" } },
      select: { plotId: true },
    });
    if (byMembership) return { ok: true, plotId: byMembership.plotId };
  }

  if (membership || cnic || code) {
    return { ok: false, error: "not_found", message: "No plot found for that membership, CNIC, or file code." };
  }

  return { ok: false, error: "not_found", message: "Plot not found." };
}

export type PlotDuesLine = {
  headId: string;
  code: string;
  name: string;
  sortOrder: number;
  showUptoDate: boolean;
  deposited: number;
  outstanding: number;
  asOfDate: Date | null;
};

export type PlotDuesLedger = {
  plot: {
    id: string;
    plotNumber: string;
    sector: string;
    block: string | null;
    street: string | null;
    sizeMarla: { toString(): string };
    sizeSqYd: { toString(): string } | null;
  };
  owner: {
    id: string;
    ownerName: string;
    membershipNumber: string;
    cnic: string;
    contact: string | null;
  } | null;
  possessionFormNo: string | null;
  physicalFileBarcode: string | null;
  lines: PlotDuesLine[];
  societySubtotal: number;
  taxationOfficerAmount: number;
  dueDate: Date;
  issueDate: Date;
  societyName: string;
  societyNtn: string | null;
  verificationUrl: string;
  verificationQrDataUrl: string;
};

export async function getPlotDuesLedger(plotId: string): Promise<PlotDuesLedger | null> {
  await ensureDefaultPlotDuesHeads();

  const [plot, heads, letterhead, ntn, dueDays, defaultTaxFee] = await Promise.all([
    prisma.plot.findUnique({
      where: { id: plotId },
      include: {
        ownerships: { orderBy: { startDate: "desc" } },
        possessions: { orderBy: { applicationDate: "desc" } },
        physicalFile: { select: { barcode: true, fileNumber: true } },
        payments: { include: { feeConfig: { select: { name: true, feeType: true } } } },
        plotCharges: true,
        duesEntries: { include: { head: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.plotDuesHead.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    getSocietyLetterhead(),
    getSocietyNtn(),
    getDueDays(),
    getDefaultTaxationOfficerFee(),
  ]);

  if (!plot) return null;

  const activeOwner = plot.ownerships.find((o) => o.status === "ACTIVE") ?? plot.ownerships[0] ?? null;
  const issuedPossession = plot.possessions.find(
    (p) => p.approvalStatus === "ISSUED" || p.letterNumber
  );
  const possessionFormNo = issuedPossession?.letterNumber || issuedPossession?.applicationNumber || null;

  const mapped = mapExistingDues(plot, heads);

  const lines: PlotDuesLine[] = heads
    .filter((h) => !h.isExtraFee)
    .map((head) => {
      const depositedRows = plot.duesEntries.filter((e) => e.headId === head.id && e.kind === "DEPOSITED");
      const outstandingRows = plot.duesEntries.filter((e) => e.headId === head.id && e.kind === "OUTSTANDING");
      const mappedHead = mapped[head.code] ?? { deposited: 0, outstanding: 0, asOfDate: null as Date | null };

      const deposited = depositedRows.length > 0 ? sumAmounts(depositedRows) : mappedHead.deposited;
      const outstanding = outstandingRows.length > 0 ? sumAmounts(outstandingRows) : mappedHead.outstanding;
      const asOfDate =
        outstandingRows.map((e) => e.asOfDate).filter(Boolean).sort((a, b) => +new Date(b!) - +new Date(a!))[0] ??
        mappedHead.asOfDate;

      return {
        headId: head.id,
        code: head.code,
        name: head.name,
        sortOrder: head.sortOrder,
        showUptoDate: head.showUptoDate,
        deposited,
        outstanding,
        asOfDate: asOfDate ? new Date(asOfDate) : null,
      };
    });

  const taxHead = heads.find((h) => h.code === "TAXATION_OFFICER" || h.isExtraFee);
  const taxRows = taxHead
    ? plot.duesEntries.filter((e) => e.headId === taxHead.id && e.kind === "OUTSTANDING")
    : [];
  const taxationOfficerAmount = taxRows.length > 0 ? sumAmounts(taxRows) : defaultTaxFee;

  const societySubtotal = lines.reduce((sum, line) => sum + line.outstanding, 0);

  const issueDate = new Date();
  const dueFromEntries = plot.duesEntries
    .filter((e) => e.kind === "OUTSTANDING" && e.dueDate)
    .map((e) => new Date(e.dueDate!))
    .sort((a, b) => +b - +a)[0];
  const dueDate =
    dueFromEntries ??
    new Date(issueDate.getTime() + dueDays * 24 * 60 * 60 * 1000);

  const verifyCode =
    plot.physicalFile?.barcode ||
    activeOwner?.membershipNumber ||
    plot.id;
  const verificationUrl = `${getAppBaseUrl()}/plot-status?q=${encodeURIComponent(verifyCode)}`;
  const verificationQrDataUrl = await generateQrDataUrl(verificationUrl, 140);

  return {
    plot: {
      id: plot.id,
      plotNumber: plot.plotNumber,
      sector: plot.sector,
      block: plot.block,
      street: plot.street,
      sizeMarla: plot.sizeMarla,
      sizeSqYd: plot.sizeSqYd,
    },
    owner: activeOwner
      ? {
          id: activeOwner.id,
          ownerName: activeOwner.ownerName,
          membershipNumber: activeOwner.membershipNumber,
          cnic: activeOwner.cnic,
          contact: activeOwner.contact,
        }
      : null,
    possessionFormNo,
    physicalFileBarcode: plot.physicalFile?.barcode ?? null,
    lines,
    societySubtotal,
    taxationOfficerAmount,
    dueDate,
    issueDate,
    societyName: letterhead.name,
    societyNtn: ntn,
    verificationUrl,
    verificationQrDataUrl,
  };
}

function mapExistingDues(
  plot: {
    payments: Array<{
      amount: { toString(): string };
      status: string;
      feeType: string;
      feeConfig?: { name: string | null } | null;
    }>;
    plotCharges: Array<{ amount: { toString(): string }; status: string; dueDate: Date | null }>;
    possessions: Array<{ possessionFee: { toString(): string } | null; paymentStatus: string }>;
  },
  heads: Array<{ code: string }>
): Record<string, { deposited: number; outstanding: number; asOfDate: Date | null }> {
  const out: Record<string, { deposited: number; outstanding: number; asOfDate: Date | null }> = {};
  for (const head of heads) {
    out[head.code] = { deposited: 0, outstanding: 0, asOfDate: null };
  }

  const annualPaid = plot.plotCharges.filter((c) => PAID_CHG.includes(c.status as (typeof PAID_CHG)[number]));
  const annualOpen = plot.plotCharges.filter((c) => OPEN_CHG.includes(c.status as (typeof OPEN_CHG)[number]));
  if (out.ANNUAL_CHARGES) {
    out.ANNUAL_CHARGES.deposited += sumAmounts(annualPaid);
    out.ANNUAL_CHARGES.outstanding += sumAmounts(annualOpen);
    const latestDue = annualOpen.map((c) => c.dueDate).filter(Boolean).sort((a, b) => +new Date(b!) - +new Date(a!))[0];
    if (latestDue) out.ANNUAL_CHARGES.asOfDate = new Date(latestDue);
  }

  const possessionPayments = plot.payments.filter((p) => p.feeType === "POSSESSION");
  if (out.POSSESSION) {
    out.POSSESSION.deposited += sumAmounts(
      possessionPayments.filter((p) => PAID_PAY.includes(p.status as (typeof PAID_PAY)[number]))
    );
    out.POSSESSION.outstanding += sumAmounts(
      possessionPayments.filter((p) => OPEN_PAY.includes(p.status as (typeof OPEN_PAY)[number]))
    );
    for (const poss of plot.possessions) {
      const fee = poss.possessionFee != null ? Number(poss.possessionFee) : 0;
      if (!fee) continue;
      if (PAID_PAY.includes(poss.paymentStatus as (typeof PAID_PAY)[number])) {
        if (possessionPayments.length === 0) out.POSSESSION.deposited += fee;
      } else if (OPEN_PAY.includes(poss.paymentStatus as (typeof OPEN_PAY)[number])) {
        if (possessionPayments.length === 0) out.POSSESSION.outstanding += fee;
      }
    }
  }

  const otherPayments = plot.payments.filter((p) => p.feeType === "OTHER");
  for (const p of otherPayments) {
    const name = (p.feeConfig?.name || "").toLowerCase();
    const target =
      name.includes("service")
        ? "SERVICE_CHARGES"
        : name.includes("masjid")
          ? "MASJID_FUND"
          : name.includes("grid")
            ? "GRID_SHARING"
            : name.includes("boundary")
              ? "BOUNDARY_WALL"
              : name.includes("feeder")
                ? "INDEPENDENT_FEEDER"
                : name.includes("corner")
                  ? "CORNER"
                  : name.includes("development") && name.includes("pre")
                    ? "PRE_DEVELOPMENT"
                    : name.includes("development")
                      ? "DEVELOPMENT"
                      : name.includes("land")
                        ? "COST_OF_LAND"
                        : name.includes("sales tax") || name.includes("gst")
                          ? "SALES_TAX"
                          : name.includes("form fee")
                            ? "POSSESSION_FORM_FEE"
                            : name.includes(" ro") || name.startsWith("ro ")
                              ? "RO_CHARGES"
                              : null;
    if (!target || !out[target]) continue;
    if (PAID_PAY.includes(p.status as (typeof PAID_PAY)[number])) out[target].deposited += Number(p.amount);
    if (OPEN_PAY.includes(p.status as (typeof OPEN_PAY)[number])) out[target].outstanding += Number(p.amount);
  }

  return out;
}

export async function recordPlotDuesEntry(input: {
  plotId: string;
  headId: string;
  kind: PlotDuesEntryKind;
  amount: number;
  asOfDate?: Date | null;
  dueDate?: Date | null;
  remarks?: string | null;
  createdById?: string | null;
}) {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  const plot = await prisma.plot.findUnique({
    where: { id: input.plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");
  const head = await prisma.plotDuesHead.findUnique({ where: { id: input.headId } });
  if (!head || !head.isActive) throw new Error("Unknown dues head");

  return prisma.plotDuesEntry.create({
    data: {
      plotId: input.plotId,
      ownershipId: plot.ownerships[0]?.id ?? null,
      headId: input.headId,
      kind: input.kind,
      amount: input.amount,
      asOfDate: input.asOfDate ?? undefined,
      dueDate: input.dueDate ?? undefined,
      remarks: input.remarks ?? undefined,
      createdById: input.createdById ?? undefined,
    },
  });
}

export function canViewPlotDues(role: Role): boolean {
  return [
    "SUPER_ADMIN",
    "ADMIN",
    "PRESIDENT",
    "SECRETARY",
    "GM",
    "RECORD_MANAGER",
    "FINANCE",
    "TRANSFER_OFFICER",
    "ASSOCIATE_TRANSFER_OFFICER",
    "VIEWER",
  ].includes(role);
}

export function canRecordPlotDues(role: Role): boolean {
  return ["SUPER_ADMIN", "ADMIN", "SECRETARY", "GM", "RECORD_MANAGER", "FINANCE"].includes(role);
}

export function normalizeLookupInput(value: string): string {
  return normalizeLookupValue(value);
}
