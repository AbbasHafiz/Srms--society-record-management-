import { prisma } from "@/lib/db";
import { createFinanceTransaction } from "@/lib/finance";
import { PAYMENT_METHODS } from "@/lib/finance-constants";
import { plotLabel } from "@/lib/plots";
import { labelize } from "@/lib/utils";
import ExcelJS from "exceljs";
import {
  type ExcelColumn,
  type ExcelCommitResult,
  type ExcelPreviewResult,
  emptyPreview,
  mapRowCells,
  parseExcelDate,
  parseEnumValue,
  parseFirstSheet,
  parsePlotLabel,
  parsePositiveNumber,
  plotKey,
  summarizePreview,
} from "@/lib/excel";
import type {
  FinanceCategoryType,
  FinanceTransactionStatus,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";

const STATUSES: FinanceTransactionStatus[] = ["DRAFT", "POSTED", "VOID"];

export const FINANCE_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    header: "Txn Number",
    key: "txnNumber",
    width: 16,
    importIgnored: true,
    description: "Ledger number filled on export. Ignored on import — new rows only.",
  },
  {
    header: "Date",
    key: "date",
    width: 14,
    required: true,
    description: "Transaction date (YYYY-MM-DD or DD-MM-YYYY).",
  },
  {
    header: "Ref",
    key: "ref",
    width: 18,
    description: "Reference, receipt, or cheque number. Used with date and amount to detect duplicates.",
  },
  {
    header: "Plot",
    key: "plot",
    width: 16,
    description: "Plot as sector/block-number, e.g. E-17/3-123.",
  },
  {
    header: "Membership",
    key: "membership",
    width: 16,
    description: "Membership number when the entry is for a plot owner.",
  },
  {
    header: "Party",
    key: "party",
    width: 22,
    description: "Payer or payee. Linked to the owner or an employee when recognised.",
  },
  {
    header: "Category",
    key: "category",
    width: 36,
    required: true,
    description: "Finance category name or code (see the Categories sheet on the template).",
  },
  {
    header: "Method",
    key: "method",
    width: 16,
    description: "Cash, PO, Bank Transfer, Cheque, or Other. Blank imports as Cash.",
  },
  {
    header: "Amount",
    key: "amount",
    width: 14,
    required: true,
    description: "Amount in PKR, greater than zero.",
  },
  {
    header: "In/Out",
    key: "direction",
    width: 12,
    description: "In (revenue / credit) or Out (expense / debit). Must match the category.",
  },
  {
    header: "Status",
    key: "status",
    width: 12,
    description: "POSTED or DRAFT. Blank imports as POSTED. VOID cannot be imported.",
  },
  {
    header: "Notes",
    key: "notes",
    width: 40,
    description: "Description or remarks stored on the ledger row.",
  },
  {
    header: "PO Number",
    key: "poNumber",
    width: 16,
    description: "Pay-order number when method is PO.",
  },
];

const FINANCE_ALIASES: Record<string, string[]> = {
  txnNumber: ["txn number", "txn", "transaction number", "ledger number"],
  date: ["date", "txn date", "transaction date"],
  ref: ["ref", "reference", "ref no", "reference no"],
  plot: ["plot", "plot no", "plot number"],
  plotSector: ["plot sector", "sector"],
  plotBlock: ["plot block", "block"],
  plotNumber: ["plot number", "plot no"],
  membership: ["membership", "membership no", "membership number"],
  party: ["party", "payee", "payer", "party name", "employee code", "staff code"],
  category: ["category", "category name", "account"],
  categoryCode: ["category code", "code"],
  method: ["method", "payment method", "pay method"],
  amount: ["amount", "pkr", "rs"],
  direction: ["in/out", "in out", "direction", "debit/credit", "debit credit", "type"],
  status: ["status"],
  notes: ["notes", "description", "remarks", "narration", "particulars"],
  poNumber: ["po number", "po", "po no", "pay order", "pay order number"],
  postNow: ["post now", "post", "posted"],
};

export type FinanceExcelFilters = {
  tab?: string;
  status?: string;
  categoryId?: string;
  from?: string;
  to?: string;
};

export function financeExcelWhere(filters: FinanceExcelFilters): Prisma.FinanceTransactionWhereInput {
  const tab = filters.tab === "revenue" || filters.tab === "expenses" ? filters.tab : "all";
  const typeFilter: FinanceCategoryType | undefined =
    tab === "revenue" ? "REVENUE" : tab === "expenses" ? "EXPENSE" : undefined;
  const status = STATUSES.includes(filters.status as FinanceTransactionStatus)
    ? (filters.status as FinanceTransactionStatus)
    : undefined;
  const dateFilter =
    filters.from || filters.to
      ? {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to + "T23:59:59") : undefined,
        }
      : undefined;
  return {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(status ? { status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(dateFilter ? { txnDate: dateFilter } : {}),
  };
}

function methodLabel(method: PaymentMethod): string {
  return method === "PO" ? "PO" : labelize(method);
}

function duplicateKey(ref: string | null, dateIso: string, amount: number): string {
  return `${dateIso}|${amount.toFixed(2)}|${(ref ?? "").trim().toLowerCase()}`;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function loadFinanceExcelRows(filters: FinanceExcelFilters) {
  const transactions = await prisma.financeTransaction.findMany({
    where: financeExcelWhere(filters),
    include: {
      category: true,
      plot: {
        select: {
          sector: true,
          block: true,
          plotNumber: true,
          ownerships: {
            where: { status: "ACTIVE" },
            select: { ownerName: true, membershipNumber: true },
            take: 1,
          },
        },
      },
      employee: { select: { employeeCode: true, name: true } },
      payment: { select: { receiptNumber: true, poNumber: true, remarks: true } },
      ownership: { select: { ownerName: true, membershipNumber: true } },
    },
    orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
    take: 10000,
  });

  return transactions.map((t) => {
    const owner = t.ownership ?? t.plot?.ownerships[0] ?? null;
    const party =
      owner?.ownerName ?? (t.employee ? `${t.employee.name} (${t.employee.employeeCode})` : "");
    const ref = t.reference ?? t.payment?.receiptNumber ?? "";
    const poNumber = t.payment?.poNumber ?? (t.paymentMethod === "PO" ? t.reference : "") ?? "";
    return {
      txnNumber: t.txnNumber,
      date: isoDate(t.txnDate),
      ref,
      plot: t.plot ? plotLabel(t.plot) : "",
      membership: owner?.membershipNumber ?? "",
      party,
      category: t.category.name,
      method: methodLabel(t.paymentMethod),
      amount: Number(t.amount),
      direction: t.type === "REVENUE" ? "In" : "Out",
      status: t.status,
      notes: t.description ?? t.payment?.remarks ?? "",
      poNumber,
    };
  });
}

type ParsedFinanceRow = {
  rowNumber: number;
  summary: string;
  values: Record<string, string>;
  errors: string[];
  warnings?: string[];
  duplicate?: boolean;
  data?: {
    categoryId: string;
    amount: number;
    txnDate: Date;
    paymentMethod: PaymentMethod;
    reference: string | null;
    description: string | null;
    plotId: string | null;
    ownershipId: string | null;
    employeeId: string | null;
    status: FinanceTransactionStatus;
    duplicate: boolean;
  };
};

function parseDirection(value: string): "IN" | "OUT" | null | "invalid" {
  const raw = value.trim().toLowerCase().replace(/[_./-]+/g, " ");
  if (!raw) return null;
  if (["in", "credit", "revenue", "income", "cr"].includes(raw)) return "IN";
  if (["out", "debit", "expense", "expenditure", "dr"].includes(raw)) return "OUT";
  return "invalid";
}

async function parseFinanceImportRows(buffer: Buffer): Promise<ParsedFinanceRow[] | { fileError: string }> {
  let parsed: Awaited<ReturnType<typeof parseFirstSheet>>;
  try {
    parsed = await parseFirstSheet(buffer);
  } catch (err) {
    return { fileError: err instanceof Error ? err.message : "Could not parse this spreadsheet." };
  }

  if (parsed.headers.length === 0) {
    return {
      fileError: "The file is empty. Download the import template and add rows under the header.",
    };
  }

  const headerBlob = parsed.headers.map((h) => h.trim().toLowerCase()).join(" ");
  const hasDate = /\bdate\b/.test(headerBlob);
  const hasAmount = /\bamount\b/.test(headerBlob);
  const hasCategory = /category|account/.test(headerBlob);
  if (!hasDate || !hasAmount || !hasCategory) {
    return {
      fileError:
        "The first row must be column headers matching the export template (Date, Ref, Plot, Membership, Party, Category, Method, Amount, In/Out, Status, Notes, PO Number).",
    };
  }

  if (parsed.rows.length === 0) {
    return [];
  }

  const [categories, plots, owners, employees, existingTxns] = await Promise.all([
    prisma.financeCategory.findMany({ select: { id: true, name: true, code: true, type: true, isActive: true } }),
    prisma.plot.findMany({ select: { id: true, sector: true, block: true, plotNumber: true } }),
    prisma.ownership.findMany({
      select: { id: true, plotId: true, ownerName: true, membershipNumber: true },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, employeeCode: true },
    }),
    prisma.financeTransaction.findMany({
      where: { status: { not: "VOID" } },
      select: { txnNumber: true, txnDate: true, amount: true, reference: true },
      take: 20000,
    }),
  ]);

  const catByCode = new Map(categories.map((c) => [c.code.toLowerCase(), c]));
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const plotByKey = new Map(plots.map((p) => [plotKey(p.sector, p.block, p.plotNumber), p]));
  const plotByLabel = new Map(plots.map((p) => [plotLabel(p).toLowerCase(), p]));
  const ownerByMembership = new Map(owners.map((o) => [o.membershipNumber.toLowerCase(), o]));
  const employeeByCode = new Map(employees.map((e) => [e.employeeCode.toLowerCase(), e]));
  const employeeByName = new Map(employees.map((e) => [e.name.toLowerCase(), e]));
  const existingByKey = new Map<string, string>();
  for (const txn of existingTxns) {
    const key = duplicateKey(txn.reference, isoDate(txn.txnDate), Number(txn.amount));
    if (txn.reference?.trim()) existingByKey.set(key, txn.txnNumber);
  }

  const seenInFile = new Map<string, number>();

  return parsed.rows.map(({ rowNumber, cells }) => {
    const values = mapRowCells(cells, FINANCE_ALIASES);
    const errors: string[] = [];
    const warnings: string[] = [];

    const categoryText = values.category.trim() || values.categoryCode.trim();
    const category =
      (values.categoryCode.trim() ? catByCode.get(values.categoryCode.trim().toLowerCase()) : undefined) ??
      (categoryText ? catByName.get(categoryText.toLowerCase()) ?? catByCode.get(categoryText.toLowerCase()) : undefined);
    if (!categoryText) errors.push("Category is required.");
    else if (!category) errors.push(`Unknown category "${categoryText}".`);
    else if (!category.isActive) errors.push(`Category "${category.name}" is inactive.`);

    const amount = parsePositiveNumber(values.amount);
    if (!values.amount.trim()) errors.push("Amount is required.");
    else if (amount == null) errors.push("Amount must be greater than zero.");

    const txnDate = values.date.trim() ? parseExcelDate(values.date) : null;
    if (!values.date.trim()) errors.push("Date is required.");
    else if (!txnDate) errors.push(`Unrecognised date "${values.date}".`);

    const paymentMethod =
      parseEnumValue(values.method, PAYMENT_METHODS, {
        CASH: "Cash",
        PO: "PO",
        BANK_TRANSFER: "Bank Transfer",
        CHEQUE: "Cheque",
        OTHER: "Other",
      }) ?? (values.method.trim() ? null : "CASH");
    if (values.method.trim() && !paymentMethod) {
      errors.push(`Unknown method "${values.method}". Use Cash, PO, Bank Transfer, Cheque, or Other.`);
    }

    const direction = parseDirection(values.direction);
    if (direction === "invalid") {
      errors.push(`In/Out must be In (revenue/credit) or Out (expense/debit), not "${values.direction}".`);
    } else if (category && direction) {
      const expected = category.type === "REVENUE" ? "IN" : "OUT";
      if (direction !== expected) {
        errors.push(
          `In/Out does not match category "${category.name}" (${category.type === "REVENUE" ? "revenue / in" : "expense / out"}).`
        );
      }
    }

    const statusRaw = values.status.trim().toUpperCase();
    if (statusRaw === "VOID") {
      errors.push("VOID cannot be imported. Import a new row instead of changing history.");
    }
    const status: FinanceTransactionStatus =
      statusRaw === "DRAFT" ? "DRAFT" : "POSTED";

    let plotId: string | null = null;
    let ownershipId: string | null = null;
    let employeeId: string | null = null;

    const plotText = values.plot.trim();
    if (plotText) {
      const fromLabel = parsePlotLabel(plotText);
      const hit =
        plotByLabel.get(plotText.toLowerCase()) ??
        (fromLabel ? plotByKey.get(plotKey(fromLabel.sector, fromLabel.block || null, fromLabel.plotNumber)) : undefined);
      if (!fromLabel && !hit && !(values.plotSector.trim() && values.plotNumber.trim())) {
        errors.push(`Plot "${plotText}" is not in sector/block-number form (e.g. E-17/3-123).`);
      } else if (!hit && fromLabel) {
        errors.push(`Unknown plot "${plotText}".`);
      } else if (hit) {
        plotId = hit.id;
      }
    } else if (values.plotSector.trim() && values.plotNumber.trim()) {
      const hit = plotByKey.get(plotKey(values.plotSector, values.plotBlock, values.plotNumber));
      if (!hit) errors.push("Plot was not found in the register.");
      else plotId = hit.id;
    }

    const membershipText = values.membership.trim();
    if (membershipText) {
      const owner = ownerByMembership.get(membershipText.toLowerCase());
      if (!owner) errors.push(`Unknown membership "${membershipText}".`);
      else {
        ownershipId = owner.id;
        if (plotId && plotId !== owner.plotId) errors.push("Plot and membership belong to different records.");
        else if (!plotId) plotId = owner.plotId;
      }
    }

    const partyText = values.party.trim();
    if (partyText) {
      const employee = employeeByCode.get(partyText.toLowerCase()) ?? employeeByName.get(partyText.toLowerCase());
      if (employee) employeeId = employee.id;
    }

    const ref = values.ref.trim() || null;
    const poNumber = values.poNumber.trim() || null;
    const notes = values.notes.trim();
    const description = [
      notes,
      partyText && !employeeId && !ownershipId ? `Party: ${partyText}` : "",
      poNumber && poNumber !== ref ? `PO ${poNumber}` : "",
    ]
      .filter(Boolean)
      .join(". ") || null;

    let duplicate = false;
    if (txnDate && amount != null && (ref || poNumber)) {
      const key = duplicateKey(ref || poNumber, isoDate(txnDate), amount);
      const existing = existingByKey.get(key);
      if (existing) {
        duplicate = true;
        warnings.push(
          `Possible duplicate of ledger ${existing} (same ref, date, and amount). Confirm to post another copy.`
        );
      }
      const seenRow = seenInFile.get(key);
      if (seenRow) {
        duplicate = true;
        warnings.push(`Duplicate of row ${seenRow} in this file (same ref, date, and amount).`);
      }
      seenInFile.set(key, rowNumber);
    }

    const summary = [values.date, category?.name ?? categoryText, amount ?? values.amount, values.ref || poNumber]
      .filter(Boolean)
      .join(" · ");

    return {
      rowNumber,
      summary: summary || `Row ${rowNumber}`,
      values,
      errors,
      warnings,
      duplicate,
      data:
        errors.length === 0 && category && amount && txnDate && paymentMethod
          ? {
              categoryId: category.id,
              amount,
              txnDate,
              paymentMethod,
              reference: ref || poNumber,
              description,
              plotId,
              ownershipId,
              employeeId,
              status,
              duplicate,
            }
          : undefined,
    };
  });
}

export async function previewFinanceExcel(buffer: Buffer): Promise<ExcelPreviewResult> {
  const rows = await parseFinanceImportRows(buffer);
  if ("fileError" in rows) return emptyPreview(rows.fileError);
  return summarizePreview(rows);
}

export async function commitFinanceExcel(
  buffer: Buffer,
  userId: string,
  options: { allowDuplicates?: boolean } = {}
): Promise<ExcelCommitResult> {
  const rows = await parseFinanceImportRows(buffer);
  if ("fileError" in rows) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: rows.fileError };
  }

  let imported = 0;
  let skippedDuplicates = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (const row of rows) {
    if (!row.data) {
      errors.push({ rowNumber: row.rowNumber, message: row.errors.join(" ") });
      continue;
    }
    if (row.data.duplicate && !options.allowDuplicates) {
      skippedDuplicates += 1;
      continue;
    }
    try {
      await createFinanceTransaction({
        categoryId: row.data.categoryId,
        amount: row.data.amount,
        txnDate: row.data.txnDate,
        paymentMethod: row.data.paymentMethod,
        reference: row.data.reference,
        description: row.data.description,
        plotId: row.data.plotId,
        ownershipId: row.data.ownershipId,
        employeeId: row.data.employeeId,
        status: row.data.status,
        createdById: userId,
      });
      imported += 1;
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        message: err instanceof Error ? err.message : "Could not save this row.",
      });
    }
  }

  const skipped = rows.length - imported;
  if (imported === 0) {
    return {
      ok: false,
      imported,
      skipped,
      errors,
      message: skippedDuplicates && !options.allowDuplicates
        ? "No rows imported. Matching ref + date + amount already exist — tick “Post duplicates anyway” to add another copy."
        : rows.length === 0
          ? "This file has a header row but no data. Add ledger rows under the header, then import again."
          : "No ledger entries were added. Fix the errors shown and try again.",
    };
  }

  const bits = [`Imported ${imported} new ledger ${imported === 1 ? "entry" : "entries"}.`];
  if (skippedDuplicates) {
    bits.push(`${skippedDuplicates} duplicate ${skippedDuplicates === 1 ? "row was" : "rows were"} left unposted.`);
  }
  if (errors.length) bits.push(`${errors.length} ${errors.length === 1 ? "row had" : "rows had"} errors and were not imported.`);
  bits.push("Existing payments and posted amounts were not changed.");

  return { ok: true, imported, skipped, errors, message: bits.join(" ") };
}

export function financeExcelFilename(template?: boolean) {
  return template ? "finance-import-template.xlsx" : "finance-ledger.xlsx";
}

export async function buildFinanceTemplateBuffer(): Promise<Buffer> {
  const categories = await prisma.financeCategory.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    select: { code: true, name: true, type: true },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Society Records";
  const ledger = workbook.addWorksheet("Ledger", { views: [{ state: "frozen", ySplit: 1 }] });
  ledger.columns = FINANCE_EXCEL_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));
  const header = ledger.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115E59" } };
  header.alignment = { vertical: "middle", wrapText: true };

  const instructions = workbook.addWorksheet("Instructions");
  instructions.getColumn(1).width = 100;
  const lines = [
    "Society Records — finance ledger import",
    "Imports create new immutable ledger rows. They never overwrite historical payments or posted amounts.",
    "Keep the first row as headers. Use the same headers as Export Excel.",
    "Required: Date, Category, Amount.",
    "Category must match an active finance category name or code (see the Categories sheet).",
    "In/Out: In = revenue/credit, Out = expense/debit. Must match the category type.",
    "Method: Cash, PO, Bank Transfer, Cheque, Other.",
    "Status: POSTED (default) or DRAFT. Do not import VOID.",
    "Duplicate detection: same Ref (or PO Number) + Date + Amount. Confirm in the preview to post a second copy.",
    "Plot format: sector/block-number (e.g. E-17/3-123). Membership links the current owner.",
  ];
  lines.forEach((line, i) => {
    instructions.getCell(i + 1, 1).value = line;
    if (i === 0) instructions.getCell(i + 1, 1).font = { bold: true, size: 14 };
  });
  let row = lines.length + 2;
  instructions.getCell(row, 1).value = "Column";
  instructions.getCell(row, 2).value = "Required";
  instructions.getCell(row, 3).value = "Meaning";
  instructions.getRow(row).font = { bold: true };
  instructions.getColumn(2).width = 14;
  instructions.getColumn(3).width = 80;
  for (const col of FINANCE_EXCEL_COLUMNS) {
    row += 1;
    instructions.getCell(row, 1).value = col.header;
    instructions.getCell(row, 2).value = col.required ? "Yes" : col.importIgnored ? "Export only" : "No";
    instructions.getCell(row, 3).value = col.description ?? "";
  }

  const catSheet = workbook.addWorksheet("Categories");
  catSheet.getRow(1).values = ["Code", "Name", "Type"];
  catSheet.getRow(1).font = { bold: true };
  catSheet.getColumn(1).width = 28;
  catSheet.getColumn(2).width = 56;
  catSheet.getColumn(3).width = 12;
  categories.forEach((cat, i) => {
    catSheet.getRow(i + 2).values = [cat.code, cat.name, cat.type];
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
