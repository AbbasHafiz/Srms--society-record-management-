import { format } from "date-fns";

export const PLOT_STATUS_PATH = "/plot-status";
export const DUES_SLIP_PATH = "/dues-slip";

export const SOCIETY_NTN_KEY = "society_ntn";
export const DUES_SLIP_DUE_DAYS_KEY = "dues_slip_due_days";
export const DUES_SLIP_TAX_OFFICER_FEE_KEY = "dues_slip_taxation_officer_fee";

export const DUES_SLIP_DUE_DAYS_DEFAULT = 11;
export const DUES_SLIP_TAX_OFFICER_FEE_DEFAULT = 20000;

export type DefaultPlotDuesHead = {
  code: string;
  name: string;
  sortOrder: number;
  showUptoDate?: boolean;
  showInDeposited?: boolean;
  showInOutstanding?: boolean;
  isExtraFee?: boolean;
};

/** Line items from the CDECHS plot-status / dues ledger slip. */
export const DEFAULT_PLOT_DUES_HEADS: DefaultPlotDuesHead[] = [
  { code: "COST_OF_LAND", name: "Cost of Land", sortOrder: 10 },
  { code: "PRE_DEVELOPMENT", name: "Pre Development Charges", sortOrder: 20 },
  { code: "DEVELOPMENT", name: "Development Charges", sortOrder: 30 },
  { code: "CORNER", name: "Corner Charges", sortOrder: 40 },
  { code: "GRID_SHARING", name: "Grid Sharing Charges", sortOrder: 50 },
  { code: "BOUNDARY_WALL", name: "Boundary Wall Charges", sortOrder: 60 },
  { code: "POSSESSION", name: "Possession Charges", sortOrder: 70 },
  { code: "MASJID_FUND", name: "Masjid Fund", sortOrder: 80 },
  { code: "POSSESSION_FORM_FEE", name: "Possession Form Fee", sortOrder: 90 },
  { code: "SERVICE_CHARGES", name: "Service Charges", sortOrder: 100, showUptoDate: true },
  { code: "ANNUAL_CHARGES", name: "Annual Charges", sortOrder: 110 },
  { code: "INDEPENDENT_FEEDER", name: "Independent Feeder Charges", sortOrder: 120 },
  { code: "SALES_TAX", name: "Sales Tax", sortOrder: 130 },
  { code: "RO_CHARGES", name: "RO Charges", sortOrder: 140, showUptoDate: true },
  {
    code: "TAXATION_OFFICER",
    name: "Taxation Officer",
    sortOrder: 900,
    showInDeposited: false,
    showInOutstanding: false,
    isExtraFee: true,
  },
];

export const PAID_PAYMENT_STATUSES = ["VERIFIED", "PAID"] as const;
export const OUTSTANDING_PAYMENT_STATUSES = ["PENDING", "SUBMITTED", "OVERDUE", "UNPAID", "PARTIAL"] as const;
export const PAID_CHARGE_STATUSES = ["PAID", "WAIVED"] as const;
export const OUTSTANDING_CHARGE_STATUSES = ["PENDING", "BILLED", "OVERDUE"] as const;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeLookupValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  return /^https?:\/\//i.test(v) || v.startsWith("/f/") || v.startsWith("/plot-status") || v.startsWith("/dues-slip");
}

/** Format PKR the way the paper slip does: 550,000 or "-" when empty. */
export function formatSlipAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount === 0) return "-";
  return Math.round(amount).toLocaleString("en-PK");
}

export function formatSlipLongDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMMM d, yyyy");
}

export function formatUptoDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "dd-MM-yyyy");
}

export function plotSizeLine(plot: {
  plotNumber: string;
  sector: string;
  block?: string | null;
  street?: string | null;
  sizeSqYd?: { toString(): string } | number | null;
  sizeMarla?: { toString(): string } | number | null;
}): string {
  const streetOrBlock = plot.street?.trim() || plot.block?.trim() || "—";
  const sqYd = plot.sizeSqYd != null ? Number(plot.sizeSqYd) : null;
  const size =
    sqYd && sqYd > 0
      ? `${Math.round(sqYd)}SQY`
      : plot.sizeMarla != null
        ? `${Number(plot.sizeMarla)} Marla`
        : "";
  return `${streetOrBlock} / ${plot.plotNumber} / ${plot.sector}${size ? ` (${size})` : ""}`;
}

export type ParsedPlotStatusQuery =
  | { kind: "empty" }
  | { kind: "invalid_qr"; message: string }
  | { kind: "lookup"; membership?: string; cnic?: string; code?: string; raw: string };

export function parsePlotStatusSearch(input: {
  membership?: string | null;
  cnic?: string | null;
  q?: string | null;
  code?: string | null;
}): ParsedPlotStatusQuery {
  const membership = normalizeLookupValue(input.membership ?? "");
  const cnic = normalizeLookupValue(input.cnic ?? "");
  const codeOrQ = normalizeLookupValue(input.q || input.code || "");

  if (!membership && !cnic && !codeOrQ) return { kind: "empty" };

  if (codeOrQ && looksLikeUrl(codeOrQ)) {
    const parsed = parseStatusQrPayload(codeOrQ);
    if (parsed.kind === "invalid_qr") return parsed;
    if (parsed.kind !== "lookup") {
      return { kind: "invalid_qr", message: "Invalid QR code." };
    }
    return {
      kind: "lookup",
      membership: membership || parsed.membership,
      cnic: cnic || parsed.cnic,
      code: parsed.code,
      raw: codeOrQ,
    };
  }

  return {
    kind: "lookup",
    membership: membership || undefined,
    cnic: cnic || undefined,
    code: codeOrQ || undefined,
    raw: membership || cnic || codeOrQ,
  };
}

export function parseStatusQrPayload(raw: string): ParsedPlotStatusQuery {
  const value = normalizeLookupValue(raw);
  if (!value) return { kind: "empty" };

  try {
    const asUrl = value.startsWith("/")
      ? new URL(value, "http://local.invalid")
      : new URL(value);

    const path = asUrl.pathname.replace(/\/+$/, "") || "/";
    const fileMatch = path.match(/^\/f\/([^/]+)$/i);
    if (fileMatch) {
      return { kind: "lookup", code: decodeURIComponent(fileMatch[1]), raw: value };
    }

    if (path === PLOT_STATUS_PATH || path === DUES_SLIP_PATH) {
      const membership = asUrl.searchParams.get("membership")?.trim() || undefined;
      const cnic = asUrl.searchParams.get("cnic")?.trim() || undefined;
      const code =
        asUrl.searchParams.get("q")?.trim() ||
        asUrl.searchParams.get("code")?.trim() ||
        undefined;
      if (membership || cnic || code) {
        return { kind: "lookup", membership, cnic, code, raw: value };
      }
    }

    const printMatch = path.match(/^\/plot-status\/print\/([^/]+)$/i);
    if (printMatch) {
      return { kind: "lookup", code: decodeURIComponent(printMatch[1]), raw: value };
    }

    return {
      kind: "invalid_qr",
      message: "This QR does not belong to a society plot file or dues slip.",
    };
  } catch {
    return { kind: "invalid_qr", message: "Invalid QR code." };
  }
}
