import type { FilerStatus, TaxPartyRole, TaxPaymentStatus, TaxSection } from "@/generated/prisma/client";

/** SystemSetting keys for FBR 236C / 236K rates (percent of DC value). */
export const FBR_TAX_RATE_KEYS = {
  cFiler: "fbr_236c_filer_percent",
  cNonFiler: "fbr_236c_nonfiler_percent",
  kFiler: "fbr_236k_filer_percent",
  kNonFiler: "fbr_236k_nonfiler_percent",
} as const;

/**
 * Defaults in the society-stated band (1%, 2.7% to 10.5%):
 * filer lower, non-filer higher, non-filer 236K capped at 10.5%.
 */
export const FBR_TAX_RATE_DEFAULTS: Record<string, { value: string; label: string }> = {
  [FBR_TAX_RATE_KEYS.cFiler]: {
    value: "1",
    label: "FBR 236C seller — active taxpayer / filer (%)",
  },
  [FBR_TAX_RATE_KEYS.cNonFiler]: {
    value: "2.7",
    label: "FBR 236C seller — non-filer (%)",
  },
  [FBR_TAX_RATE_KEYS.kFiler]: {
    value: "2.7",
    label: "FBR 236K purchaser — active taxpayer / filer (%)",
  },
  [FBR_TAX_RATE_KEYS.kNonFiler]: {
    value: "10.5",
    label: "FBR 236K purchaser — non-filer (%)",
  },
};

export const FBR_TAX_RATE_MIN = 0.01;
export const FBR_TAX_RATE_MAX = 10.5;

export const FILER_STATUSES: FilerStatus[] = ["FILER", "NON_FILER"];
export const TAX_PAYMENT_STATUSES: TaxPaymentStatus[] = ["UNPAID", "PAID"];

export const TAX_FORM_FIELDS = {
  dcValue: "dcValue",
  taxSection: "taxSection",
  filerStatus: "filerStatus",
  paymentStatus: "taxPaymentStatus",
  challanNumber: "challanNumber",
  cprNumber: "cprNumber",
  remarks: "taxRemarks",
  plotId: "plotId",
  transferId: "transferId",
  openFileId: "openFileId",
} as const;

export function taxSectionLabel(section: TaxSection | string): string {
  switch (section) {
    case "SECTION_236C":
      return "236C — seller";
    case "SECTION_236K":
      return "236K — purchaser";
    default:
      return section;
  }
}

export function taxSectionShort(section: TaxSection | string): string {
  switch (section) {
    case "SECTION_236C":
      return "236C";
    case "SECTION_236K":
      return "236K";
    default:
      return section;
  }
}

export function filerStatusLabel(status: FilerStatus | string): string {
  switch (status) {
    case "FILER":
      return "Active taxpayer (filer / ATL)";
    case "NON_FILER":
      return "Non-filer";
    default:
      return status;
  }
}

export function taxPartyRoleLabel(role: TaxPartyRole | string): string {
  switch (role) {
    case "SELLER":
      return "Seller";
    case "PURCHASER":
      return "Purchaser";
    default:
      return role;
  }
}

export function formatPercent(value: number | string | { toString(): string }): string {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-PK", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`;
}

export function computeTaxAmount(dcValue: number, ratePercent: number): number {
  if (!Number.isFinite(dcValue) || !Number.isFinite(ratePercent) || dcValue <= 0 || ratePercent < 0) {
    return 0;
  }
  return Math.round((dcValue * ratePercent) / 100 * 100) / 100;
}

export function rateKeyFor(section: TaxSection, filerStatus: FilerStatus): string {
  if (section === "SECTION_236C") {
    return filerStatus === "FILER" ? FBR_TAX_RATE_KEYS.cFiler : FBR_TAX_RATE_KEYS.cNonFiler;
  }
  return filerStatus === "FILER" ? FBR_TAX_RATE_KEYS.kFiler : FBR_TAX_RATE_KEYS.kNonFiler;
}
