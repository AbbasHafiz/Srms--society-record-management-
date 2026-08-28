import ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  required?: boolean;
  importIgnored?: boolean;
  description?: string;
};

export type ExcelPreviewRow = {
  rowNumber: number;
  summary: string;
  values: Record<string, string>;
  errors: string[];
  warnings?: string[];
  duplicate?: boolean;
};

export type ExcelPreviewResult = {
  fileError?: string;
  rows: ExcelPreviewRow[];
  validCount: number;
  errorCount: number;
  duplicateCount?: number;
};

export type ExcelCommitResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  message: string;
  errors: Array<{ rowNumber: number; message: string }>;
};

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
}

export function excelExportHref(
  module: string,
  params: Record<string, string | undefined | null> = {},
  opts?: { template?: boolean }
) {
  const sp = new URLSearchParams();
  sp.set("module", module);
  if (opts?.template) sp.set("template", "1");
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value).trim() !== "") sp.set(key, String(value));
  }
  return `/excel/export?${sp.toString()}`;
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function buildWorkbookBuffer(options: {
  sheetName: string;
  columns: ExcelColumn[];
  rows?: Array<Record<string, unknown>>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Society Records";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(options.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = options.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF115E59" },
  };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 22;

  for (const row of options.rows ?? []) {
    const values: Record<string, unknown> = {};
    for (const col of options.columns) {
      const raw = row[col.key];
      values[col.key] = raw == null ? "" : raw instanceof Date ? formatIsoDate(raw) : String(raw);
    }
    sheet.addRow(values);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function sniffSpreadsheetKind(buffer: Uint8Array): "xlsx" | "xls" | "csv" {
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "xlsx";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "xls";
  }
  return "csv";
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export const OLD_XLS_ERROR =
  "This looks like the older .xls format. Save it as Excel Workbook (.xlsx) or CSV and try again.";

export async function parseFirstSheet(buffer: Buffer): Promise<{
  headers: string[];
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
}> {
  const kind = sniffSpreadsheetKind(buffer);
  if (kind === "xls") {
    throw new Error(OLD_XLS_ERROR);
  }
  if (kind === "csv") {
    const matrix = parseCsvText(buffer.toString("utf8"));
    if (matrix.length === 0) return { headers: [], rows: [] };
    const headers = matrix[0].map((h) => h.trim());
    const rows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];
    for (let i = 1; i < matrix.length; i++) {
      const cells: Record<string, string> = {};
      let hasValue = false;
      headers.forEach((header, index) => {
        if (!header) return;
        const text = (matrix[i][index] ?? "").trim();
        cells[header] = text;
        if (text) hasValue = true;
      });
      if (hasValue) rows.push({ rowNumber: i + 1, cells });
    }
    return { headers: headers.filter(Boolean), rows };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error(
      "Could not parse this spreadsheet. Save it as .xlsx or CSV using the import template headers."
    );
  }
  const sheet =
    workbook.getWorksheet("Ledger") ??
    workbook.worksheets.find((item) => {
      const name = item.name.trim().toLowerCase();
      return name !== "instructions" && name !== "categories";
    }) ??
    workbook.worksheets[0];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const text = cellToString(row.getCell(colNumber).value);
      cells[header] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push({ rowNumber, cells });
  });

  return { headers: headers.filter(Boolean), rows };
}

export function mapRowCells(
  cells: Record<string, string>,
  aliases: Record<string, string[]>
): Record<string, string> {
  const byNormalized = new Map<string, string>();
  for (const [header, value] of Object.entries(cells)) {
    byNormalized.set(normalizeHeader(header), value);
  }
  const mapped: Record<string, string> = {};
  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const found = byNormalized.get(normalizeHeader(name));
      if (found != null && found !== "") {
        mapped[key] = found;
        break;
      }
    }
    if (mapped[key] == null) mapped[key] = "";
  }
  return mapped;
}

export function cellToString(value: ExcelJS.CellValue): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return formatIsoDate(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("hyperlink" in value && "text" in value) return String((value as { text?: string }).text ?? "").trim();
  }
  return String(value).trim();
}

export function formatIsoDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function parseExcelDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + serial * 86400000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePositiveNumber(value: string): number | null {
  const n = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  labels?: Partial<Record<T, string>>
): T | null {
  const raw = normalizeHeader(value);
  if (!raw) return null;
  for (const item of allowed) {
    if (normalizeHeader(item) === raw) return item;
    if (labels?.[item] && normalizeHeader(labels[item]!) === raw) return item;
  }
  return null;
}

export function truthyFlag(value: string): boolean {
  const v = normalizeHeader(value);
  return ["yes", "y", "true", "1", "posted", "post"].includes(v);
}

export async function readExcelFileFromFormData(formData: FormData): Promise<Buffer> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Choose an Excel (.xlsx) or CSV file to continue.");
  }
  if (file.size === 0) {
    throw new Error("The selected file is empty. Download the import template and add rows under the header.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("File is too large. Keep the spreadsheet under 5 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = sniffSpreadsheetKind(buffer);
  if (kind === "xls") {
    throw new Error(OLD_XLS_ERROR);
  }
  if (kind === "xlsx" && buffer.length < 4) {
    throw new Error("That file is not a valid .xlsx workbook.");
  }
  return buffer;
}

export function emptyPreview(fileError: string): ExcelPreviewResult {
  return { fileError, rows: [], validCount: 0, errorCount: 0 };
}

export function summarizePreview(rows: ExcelPreviewRow[]): ExcelPreviewResult {
  return {
    rows,
    validCount: rows.filter((r) => r.errors.length === 0 && !r.duplicate).length,
    errorCount: rows.filter((r) => r.errors.length > 0).length,
    duplicateCount: rows.filter((r) => r.duplicate && r.errors.length === 0).length,
  };
}

export function parsePlotLabel(value: string): { sector: string; block: string; plotNumber: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  const sector = trimmed.slice(0, slash).trim();
  const rest = trimmed.slice(slash + 1).trim();
  if (!sector || !rest) return null;
  const dash = rest.indexOf("-");
  if (dash > 0) {
    const block = rest.slice(0, dash).trim();
    const plotNumber = rest.slice(dash + 1).trim();
    if (!plotNumber) return null;
    return { sector, block, plotNumber };
  }
  return { sector, block: "", plotNumber: rest };
}

export function plotKey(sector: string, block: string | null | undefined, plotNumber: string) {
  return `${sector.trim().toLowerCase()}|${(block ?? "").trim().toLowerCase()}|${plotNumber.trim().toLowerCase()}`;
}
