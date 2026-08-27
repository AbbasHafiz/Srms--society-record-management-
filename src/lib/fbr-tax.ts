import { prisma } from "@/lib/db";
import { nextTaxAssessmentNumber } from "@/lib/numbering";
import { LIVE_OPEN_FILE_STATUSES } from "@/lib/open-files";
import {
  FBR_TAX_RATE_DEFAULTS,
  FBR_TAX_RATE_KEYS,
  FBR_TAX_RATE_MAX,
  FBR_TAX_RATE_MIN,
  FILER_STATUSES,
  TAX_FORM_FIELDS,
  TAX_PAYMENT_STATUSES,
  computeTaxAmount,
  rateKeyFor,
  taxSectionShort,
} from "@/lib/fbr-tax-shared";
import type {
  FilerStatus,
  Prisma,
  TaxPartyRole,
  TaxPaymentStatus,
  TaxSection,
  TransferTaxAssessment,
} from "@/generated/prisma/client";

export {
  FBR_TAX_RATE_DEFAULTS,
  FBR_TAX_RATE_KEYS,
  FBR_TAX_RATE_MAX,
  FBR_TAX_RATE_MIN,
  computeTaxAmount,
  taxSectionShort,
} from "@/lib/fbr-tax-shared";

type Db = Prisma.TransactionClient | typeof prisma;

export type FbrTaxRates = {
  cFiler: number;
  cNonFiler: number;
  kFiler: number;
  kNonFiler: number;
};

let ratesCache: FbrTaxRates | null = null;

export function parseRatePercent(raw: unknown, label = "Tax rate"): number {
  const value = Number(String(raw ?? "").trim());
  if (!Number.isFinite(value) || value < FBR_TAX_RATE_MIN || value > FBR_TAX_RATE_MAX) {
    throw new Error(`${label} must be between ${FBR_TAX_RATE_MIN}% and ${FBR_TAX_RATE_MAX}%.`);
  }
  return value;
}

export function parseDcValue(raw: unknown): number {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("DC value (PKR) is required. Society must set the Deputy Commissioner valuation.");
  }
  return Math.round(value * 100) / 100;
}

export function parseFilerStatus(raw: unknown): FilerStatus {
  const value = String(raw ?? "").trim() as FilerStatus;
  if (!FILER_STATUSES.includes(value)) {
    throw new Error("Select whether the party is an active taxpayer (filer) or a non-filer.");
  }
  return value;
}

export function parseTaxPaymentStatus(raw: unknown): TaxPaymentStatus {
  const value = String(raw ?? "").trim() as TaxPaymentStatus;
  if (!TAX_PAYMENT_STATUSES.includes(value)) {
    throw new Error("Select whether FBR tax is paid or unpaid.");
  }
  return value;
}

function parseOptionalRef(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return value || null;
}

export function clearFbrTaxRatesCache() {
  ratesCache = null;
}

export async function getFbrTaxRates(): Promise<FbrTaxRates> {
  if (ratesCache) return ratesCache;

  const keys = Object.values(FBR_TAX_RATE_KEYS);
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const read = (key: string): number => {
    const fallback = Number(FBR_TAX_RATE_DEFAULTS[key]?.value ?? "0");
    const parsed = map[key] != null ? Number(map[key]) : NaN;
    if (Number.isFinite(parsed) && parsed >= FBR_TAX_RATE_MIN && parsed <= FBR_TAX_RATE_MAX) {
      return parsed;
    }
    return fallback;
  };

  ratesCache = {
    cFiler: read(FBR_TAX_RATE_KEYS.cFiler),
    cNonFiler: read(FBR_TAX_RATE_KEYS.cNonFiler),
    kFiler: read(FBR_TAX_RATE_KEYS.kFiler),
    kNonFiler: read(FBR_TAX_RATE_KEYS.kNonFiler),
  };
  return ratesCache;
}

export function rateFor(rates: FbrTaxRates, section: TaxSection, filerStatus: FilerStatus): number {
  if (section === "SECTION_236C") {
    return filerStatus === "FILER" ? rates.cFiler : rates.cNonFiler;
  }
  return filerStatus === "FILER" ? rates.kFiler : rates.kNonFiler;
}

export async function resolvePlotDcValue(
  db: Db,
  plotId: string,
  overrideRaw?: unknown
): Promise<{ dcValue: number; fromForm: boolean }> {
  const override = String(overrideRaw ?? "").replace(/,/g, "").trim();
  if (override) {
    return { dcValue: parseDcValue(override), fromForm: true };
  }
  const plot = await db.plot.findUnique({ where: { id: plotId }, select: { dcValue: true } });
  if (!plot?.dcValue) {
    throw new Error(
      "No DC value is set on this plot. Enter the Deputy Commissioner valuation (PKR) before assessing FBR tax."
    );
  }
  return { dcValue: Number(plot.dcValue), fromForm: false };
}

export type CreateTaxAssessmentInput = {
  plotId: string;
  transferId?: string | null;
  openFileId?: string | null;
  taxSection: TaxSection;
  partyRole: TaxPartyRole;
  partyName: string;
  partyCnic?: string | null;
  filerStatus: FilerStatus;
  dcValue: number;
  paymentStatus: TaxPaymentStatus;
  challanNumber?: string | null;
  cprNumber?: string | null;
  remarks?: string | null;
  recordedById?: string | null;
  persistDcValue?: boolean;
  assessmentNumber?: string;
};

export async function createImmutableTaxAssessment(
  db: Db,
  input: CreateTaxAssessmentInput
): Promise<TransferTaxAssessment> {
  if (input.transferId) {
    const existing = await db.transferTaxAssessment.findFirst({
      where: { transferId: input.transferId, taxSection: input.taxSection },
    });
    if (existing) {
      throw new Error(
        `FBR ${taxSectionShort(input.taxSection)} is already recorded on this transfer (${existing.assessmentNumber}). History is not overwritten.`
      );
    }
  }
  if (input.openFileId) {
    const existing = await db.transferTaxAssessment.findFirst({
      where: { openFileId: input.openFileId, taxSection: input.taxSection },
    });
    if (existing) {
      throw new Error(
        `FBR ${taxSectionShort(input.taxSection)} is already recorded on this open file (${existing.assessmentNumber}). History is not overwritten.`
      );
    }
  }

  const rates = await getFbrTaxRates();
  const ratePercent = rateFor(rates, input.taxSection, input.filerStatus);
  const amount = computeTaxAmount(input.dcValue, ratePercent);

  if (input.paymentStatus === "PAID" && !input.challanNumber && !input.cprNumber) {
    throw new Error(
      `FBR ${taxSectionShort(input.taxSection)} is marked paid. Enter the PSID / challan or CPR number.`
    );
  }

  const assessmentNumber = input.assessmentNumber ?? (await nextTaxAssessmentNumber());
  const now = new Date();

  const created = await db.transferTaxAssessment.create({
    data: {
      assessmentNumber,
      taxSection: input.taxSection,
      partyRole: input.partyRole,
      filerStatus: input.filerStatus,
      dcValueSnapshot: input.dcValue,
      ratePercent,
      amount,
      paymentStatus: input.paymentStatus,
      challanNumber: input.challanNumber ?? null,
      cprNumber: input.cprNumber ?? null,
      paidAt: input.paymentStatus === "PAID" ? now : null,
      partyName: input.partyName,
      partyCnic: input.partyCnic ?? null,
      remarks: input.remarks ?? null,
      plotId: input.plotId,
      transferId: input.transferId ?? null,
      openFileId: input.openFileId ?? null,
      recordedById: input.recordedById ?? null,
      paymentRecordedById: input.paymentStatus === "PAID" ? input.recordedById ?? null : null,
    },
  });

  if (input.persistDcValue !== false) {
    await db.plot.update({
      where: { id: input.plotId },
      data: { dcValue: input.dcValue },
    });
  }

  return created;
}

export function parseTaxForm(formData: FormData): {
  filerStatus: FilerStatus;
  paymentStatus: TaxPaymentStatus;
  challanNumber: string | null;
  cprNumber: string | null;
  remarks: string | null;
  dcValueRaw: string;
} {
  return {
    filerStatus: parseFilerStatus(formData.get(TAX_FORM_FIELDS.filerStatus)),
    paymentStatus: parseTaxPaymentStatus(formData.get(TAX_FORM_FIELDS.paymentStatus)),
    challanNumber: parseOptionalRef(formData.get(TAX_FORM_FIELDS.challanNumber)),
    cprNumber: parseOptionalRef(formData.get(TAX_FORM_FIELDS.cprNumber)),
    remarks: parseOptionalRef(formData.get(TAX_FORM_FIELDS.remarks)),
    dcValueRaw: String(formData.get(TAX_FORM_FIELDS.dcValue) ?? ""),
  };
}

/** Link an open-file 236C snapshot onto the sale transfer without changing the tax figures. */
export async function attachOpenFileSellerTaxToTransfer(
  db: Db,
  { plotId, transferId }: { plotId: string; transferId: string }
) {
  const openFiles = await db.openFile.findMany({
    where: {
      plotId,
      OR: [{ transferId }, { status: { in: LIVE_OPEN_FILE_STATUSES } }],
    },
    select: { id: true },
  });
  const ids = openFiles.map((f) => f.id);
  if (ids.length === 0) return;

  await db.transferTaxAssessment.updateMany({
    where: {
      openFileId: { in: ids },
      taxSection: "SECTION_236C",
      transferId: null,
    },
    data: { transferId },
  });
}

export async function requireSaleTaxAssessments(db: Db, transferId: string) {
  const rows = await db.transferTaxAssessment.findMany({
    where: { transferId },
    select: { taxSection: true, assessmentNumber: true },
  });
  if (!rows.some((r) => r.taxSection === "SECTION_236C")) {
    throw new Error(
      "Record seller FBR 236C tax on the DC value (paid or unpaid) before completing this sale transfer."
    );
  }
  if (!rows.some((r) => r.taxSection === "SECTION_236K")) {
    throw new Error(
      "Record purchaser FBR 236K tax on the DC value (paid or unpaid) before completing this sale transfer."
    );
  }
}

export async function markTaxAssessmentPaid(
  db: Db,
  {
    assessmentId,
    challanNumber,
    cprNumber,
    userId,
  }: {
    assessmentId: string;
    challanNumber: string | null;
    cprNumber: string | null;
    userId: string;
  }
) {
  const row = await db.transferTaxAssessment.findUnique({ where: { id: assessmentId } });
  if (!row) throw new Error("Tax assessment not found.");
  if (row.paymentStatus === "PAID") {
    throw new Error(
      `FBR ${taxSectionShort(row.taxSection)} ${row.assessmentNumber} is already marked paid. History is not overwritten.`
    );
  }
  if (!challanNumber && !cprNumber) {
    throw new Error("Enter the PSID / challan or CPR number to record payment.");
  }

  return db.transferTaxAssessment.update({
    where: { id: assessmentId },
    data: {
      paymentStatus: "PAID",
      challanNumber: challanNumber ?? row.challanNumber,
      cprNumber: cprNumber ?? row.cprNumber,
      paidAt: new Date(),
      paymentRecordedById: userId,
    },
  });
}

export function defaultRateLabel(key: string): string {
  return FBR_TAX_RATE_DEFAULTS[key]?.label ?? key;
}

export { rateKeyFor };
