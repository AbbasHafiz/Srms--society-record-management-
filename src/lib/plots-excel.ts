import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextAllotmentNumber, nextMembershipNumber } from "@/lib/numbering";
import {
  ALL_DEVELOPMENT_STATUSES,
  ALL_PLOT_TYPES,
  ALL_POSSESSION_STATUSES,
  plotTypeLabel,
} from "@/lib/plots";
import type {
  DevelopmentStatus,
  PlotType,
  PossessionStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  type ExcelColumn,
  type ExcelCommitResult,
  type ExcelPreviewResult,
  mapRowCells,
  parseExcelDate,
  parseEnumValue,
  parseFirstSheet,
  parsePositiveNumber,
  plotKey,
  summarizePreview,
} from "@/lib/excel";

export const PLOT_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Sector", key: "sector", width: 12 },
  { header: "Block", key: "block", width: 10 },
  { header: "Plot Number", key: "plotNumber", width: 14 },
  { header: "Street", key: "street", width: 16 },
  { header: "Size Marla", key: "sizeMarla", width: 12 },
  { header: "Size Sq Yd", key: "sizeSqYd", width: 12 },
  { header: "Property Type", key: "plotType", width: 16 },
  { header: "Other Detail", key: "otherDetail", width: 18 },
  { header: "Possession Status", key: "possessionStatus", width: 18 },
  { header: "Development Status", key: "developmentStatus", width: 18 },
  { header: "DC Value", key: "dcValue", width: 14 },
  { header: "Remarks", key: "remarks", width: 22 },
  { header: "Owner Name", key: "ownerName", width: 22 },
  { header: "CNIC", key: "cnic", width: 18 },
  { header: "Contact", key: "contact", width: 16 },
  { header: "Address", key: "address", width: 22 },
  { header: "Email", key: "email", width: 22 },
  { header: "Membership Number", key: "membershipNumber", width: 18 },
  { header: "Allotment Number", key: "allotmentNumber", width: 18 },
  { header: "Ownership Start Date", key: "startDate", width: 18 },
];

const PLOT_ALIASES: Record<string, string[]> = {
  sector: ["sector"],
  block: ["block"],
  plotNumber: ["plot number", "plot no", "plot / unit no", "unit no", "plot"],
  street: ["street"],
  sizeMarla: ["size marla", "marla", "size"],
  sizeSqYd: ["size sq yd", "size sqyd", "sq yd", "square yards"],
  plotType: ["property type", "plot type", "type"],
  otherDetail: ["other detail", "other type", "specify"],
  possessionStatus: ["possession status", "possession"],
  developmentStatus: ["development status", "development"],
  dcValue: ["dc value", "dc"],
  remarks: ["remarks", "notes"],
  ownerName: ["owner name", "owner", "member name"],
  cnic: ["cnic"],
  contact: ["contact", "phone", "mobile"],
  address: ["address"],
  email: ["email"],
  membershipNumber: ["membership number", "membership"],
  allotmentNumber: ["allotment number", "allotment"],
  startDate: ["ownership start date", "start date", "allotment date"],
};

const PLOT_TYPE_LABELS: Partial<Record<PlotType, string>> = Object.fromEntries(
  ALL_PLOT_TYPES.map((t) => [t, plotTypeLabel(t)])
) as Partial<Record<PlotType, string>>;

export type PlotExcelFilters = {
  q?: string;
  type?: string;
  possession?: string;
};

export function plotExcelWhere(filters: PlotExcelFilters): Prisma.PlotWhereInput | undefined {
  const where: Prisma.PlotWhereInput = {};
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { plotNumber: { contains: q, mode: "insensitive" } },
      { sector: { contains: q, mode: "insensitive" } },
      { street: { contains: q, mode: "insensitive" } },
      { block: { contains: q, mode: "insensitive" } },
      {
        ownerships: {
          some: {
            OR: [
              { ownerName: { contains: q, mode: "insensitive" } },
              { membershipNumber: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
            ],
          },
        },
      },
    ];
  }
  if (filters.type && ALL_PLOT_TYPES.includes(filters.type as PlotType)) {
    where.plotType = filters.type as PlotType;
  }
  if (filters.possession && ALL_POSSESSION_STATUSES.includes(filters.possession as PossessionStatus)) {
    where.possessionStatus = filters.possession as PossessionStatus;
  }
  return Object.keys(where).length ? where : undefined;
}

export async function loadPlotExcelRows(filters: PlotExcelFilters) {
  const plots = await prisma.plot.findMany({
    where: plotExcelWhere(filters),
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
    orderBy: [{ sector: "asc" }, { plotNumber: "asc" }],
    take: 10000,
  });
  return plots.map((p) => {
    const owner = p.ownerships[0];
    return {
      sector: p.sector,
      block: p.block ?? "",
      plotNumber: p.plotNumber,
      street: p.street ?? "",
      sizeMarla: Number(p.sizeMarla),
      sizeSqYd: p.sizeSqYd != null ? Number(p.sizeSqYd) : "",
      plotType: plotTypeLabel(p.plotType, p.otherDetail),
      otherDetail: p.otherDetail ?? "",
      possessionStatus: p.possessionStatus,
      developmentStatus: p.developmentStatus,
      dcValue: p.dcValue != null ? Number(p.dcValue) : "",
      remarks: p.remarks ?? "",
      ownerName: owner?.ownerName ?? "",
      cnic: owner?.cnic ?? "",
      contact: owner?.contact ?? "",
      address: owner?.address ?? "",
      email: owner?.email ?? "",
      membershipNumber: owner?.membershipNumber ?? "",
      allotmentNumber: owner?.allotmentNumber ?? "",
      startDate: owner?.startDate ?? "",
    };
  });
}

type PlotOwnerInput = {
  ownerName: string;
  cnic: string;
  contact: string | null;
  address: string | null;
  email: string | null;
  membershipNumber: string | null;
  allotmentNumber: string | null;
  startDate: Date;
};

type ParsedPlotRow = {
  rowNumber: number;
  summary: string;
  values: Record<string, string>;
  errors: string[];
  data?: {
    plotNumber: string;
    sector: string;
    block: string | null;
    street: string | null;
    sizeMarla: number;
    sizeSqYd: number | null;
    plotType: PlotType;
    otherDetail: string | null;
    possessionStatus: PossessionStatus;
    developmentStatus: DevelopmentStatus;
    dcValue: number | null;
    remarks: string | null;
    owner?: PlotOwnerInput;
  };
};

async function parsePlotImportRows(buffer: Buffer): Promise<ParsedPlotRow[]> {
  const parsed = await parseFirstSheet(buffer);
  const existingPlots = await prisma.plot.findMany({
    select: { sector: true, block: true, plotNumber: true },
  });
  const existingKeys = new Set(
    existingPlots.map((p) => plotKey(p.sector, p.block, p.plotNumber))
  );
  const seenKeys = new Set<string>();
  const memberships = new Set(
    (await prisma.ownership.findMany({ select: { membershipNumber: true } })).map((o) =>
      o.membershipNumber.toLowerCase()
    )
  );
  const allotments = new Set(
    (await prisma.ownership.findMany({ select: { allotmentNumber: true } })).map((o) =>
      o.allotmentNumber.toLowerCase()
    )
  );
  const seenMemberships = new Set<string>();
  const seenAllotments = new Set<string>();

  return parsed.rows.map(({ rowNumber, cells }) => {
    const values = mapRowCells(cells, PLOT_ALIASES);
    const errors: string[] = [];
    const sector = values.sector.trim();
    const plotNumber = values.plotNumber.trim();
    const block = values.block.trim() || null;
    if (!sector) errors.push("Sector is required.");
    if (!plotNumber) errors.push("Plot number is required.");

    const key = plotKey(sector, block, plotNumber);
    if (sector && plotNumber) {
      if (existingKeys.has(key)) {
        errors.push("This plot number already exists. Ownership is never rewritten from Excel.");
      } else if (seenKeys.has(key)) {
        errors.push("Duplicate plot number in this spreadsheet.");
      } else {
        seenKeys.add(key);
      }
    }

    const sizeMarla = parsePositiveNumber(values.sizeMarla);
    if (sizeMarla == null) errors.push("Size (marla) must be a positive number.");

    const plotType =
      parseEnumValue(values.plotType, ALL_PLOT_TYPES, PLOT_TYPE_LABELS) ??
      (values.plotType ? null : "RESIDENTIAL");
    if (values.plotType && !plotType) errors.push("Unknown property type.");
    const resolvedType = plotType ?? "RESIDENTIAL";
    const otherDetail = values.otherDetail.trim() || null;
    if (resolvedType === "OTHER" && !otherDetail) {
      errors.push("Specify Other Detail when property type is Other.");
    }

    const possessionStatus =
      parseEnumValue(values.possessionStatus, ALL_POSSESSION_STATUSES) ??
      (values.possessionStatus ? null : "NOT_APPLIED");
    if (values.possessionStatus && !possessionStatus) errors.push("Unknown possession status.");

    const developmentStatus =
      parseEnumValue(values.developmentStatus, ALL_DEVELOPMENT_STATUSES) ??
      (values.developmentStatus ? null : "DEVELOPED");
    if (values.developmentStatus && !developmentStatus) errors.push("Unknown development status.");

    let sizeSqYd: number | null = null;
    if (values.sizeSqYd.trim()) {
      sizeSqYd = parsePositiveNumber(values.sizeSqYd);
      if (sizeSqYd == null) errors.push("Size (sq yd) must be a positive number.");
    }
    let dcValue: number | null = null;
    if (values.dcValue.trim()) {
      dcValue = parsePositiveNumber(values.dcValue);
      if (dcValue == null) errors.push("DC value must be a positive amount.");
    }

    const ownerName = values.ownerName.trim();
    let owner: PlotOwnerInput | undefined;
    if (ownerName || values.cnic.trim() || values.membershipNumber.trim()) {
      if (!ownerName) errors.push("Owner name is required when membership details are provided.");
      if (!values.cnic.trim()) errors.push("CNIC is required for a new owner.");
      const membershipNumber = values.membershipNumber.trim() || null;
      const allotmentNumber = values.allotmentNumber.trim() || null;
      if (membershipNumber) {
        const m = membershipNumber.toLowerCase();
        if (memberships.has(m) || seenMemberships.has(m)) {
          errors.push("Membership number already exists and cannot be reused.");
        } else {
          seenMemberships.add(m);
        }
      }
      if (allotmentNumber) {
        const a = allotmentNumber.toLowerCase();
        if (allotments.has(a) || seenAllotments.has(a)) {
          errors.push("Allotment number already exists and cannot be reused.");
        } else {
          seenAllotments.add(a);
        }
      }
      const startDate = values.startDate.trim() ? parseExcelDate(values.startDate) : new Date();
      if (values.startDate.trim() && !startDate) errors.push("Ownership start date is not a valid date.");
      owner = {
        ownerName,
        cnic: values.cnic.trim(),
        contact: values.contact.trim() || null,
        address: values.address.trim() || null,
        email: values.email.trim() || null,
        membershipNumber,
        allotmentNumber,
        startDate: startDate ?? new Date(),
      };
    }

    const summary = [sector, block, plotNumber].filter(Boolean).join("/") + (ownerName ? ` · ${ownerName}` : "");
    return {
      rowNumber,
      summary: summary || `Row ${rowNumber}`,
      values,
      errors,
      data:
        errors.length === 0 && sizeMarla
          ? {
              plotNumber,
              sector,
              block,
              street: values.street.trim() || null,
              sizeMarla,
              sizeSqYd,
              plotType: resolvedType,
              otherDetail,
              possessionStatus: possessionStatus ?? "NOT_APPLIED",
              developmentStatus: developmentStatus ?? "DEVELOPED",
              dcValue,
              remarks: values.remarks.trim() || null,
              owner,
            }
          : undefined,
    };
  });
}

export async function previewPlotExcel(buffer: Buffer): Promise<ExcelPreviewResult> {
  const rows = await parsePlotImportRows(buffer);
  return summarizePreview(rows);
}

export async function commitPlotExcel(buffer: Buffer, userId: string): Promise<ExcelCommitResult> {
  const rows = await parsePlotImportRows(buffer);
  let imported = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (const row of rows) {
    if (!row.data) {
      errors.push({ rowNumber: row.rowNumber, message: row.errors.join(" ") });
      continue;
    }
    try {
      const ownerInput = row.data.owner;
      const membershipNumber = ownerInput
        ? ownerInput.membershipNumber || (await nextMembershipNumber())
        : undefined;
      const allotmentNumber = ownerInput
        ? ownerInput.allotmentNumber || (await nextAllotmentNumber())
        : undefined;

      const created = await prisma.$transaction(async (tx) => {
        const plot = await tx.plot.create({
          data: {
            plotNumber: row.data!.plotNumber,
            sector: row.data!.sector,
            block: row.data!.block,
            street: row.data!.street,
            sizeMarla: row.data!.sizeMarla,
            sizeSqYd: row.data!.sizeSqYd,
            plotType: row.data!.plotType,
            otherDetail: row.data!.otherDetail,
            possessionStatus: row.data!.possessionStatus,
            developmentStatus: row.data!.developmentStatus,
            dcValue: row.data!.dcValue,
            remarks: row.data!.remarks,
          },
        });
        if (ownerInput && membershipNumber && allotmentNumber) {
          await tx.ownership.create({
            data: {
              plotId: plot.id,
              ownerName: ownerInput.ownerName,
              cnic: ownerInput.cnic,
              contact: ownerInput.contact,
              address: ownerInput.address,
              email: ownerInput.email,
              membershipNumber,
              allotmentNumber,
              startDate: ownerInput.startDate,
              status: "ACTIVE",
            },
          });
        }
        return { plot, membershipNumber };
      });

      await writeAuditLog({
        userId,
        action: "PLOT_EXCEL_IMPORTED",
        module: "plots",
        recordId: created.plot.id,
        plotId: created.plot.id,
        newValue: {
          plotNumber: created.plot.plotNumber,
          sector: created.plot.sector,
          membershipNumber: created.membershipNumber ?? null,
          source: "excel",
        },
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
  return {
    ok: imported > 0,
    imported,
    skipped,
    errors,
    message:
      imported > 0
        ? `Imported ${imported} new plot${imported === 1 ? "" : "s"}. ${skipped ? `${skipped} row${skipped === 1 ? "" : "s"} skipped.` : "Existing plots were not changed."}`
        : skipped
          ? "No rows were imported. Fix the errors and try again."
          : "The spreadsheet has no data rows.",
  };
}

export function plotExcelFilename(filters: PlotExcelFilters, template?: boolean) {
  if (template) return "plots-import-template.xlsx";
  const bits = ["plots-register"];
  if (filters.q) bits.push("filtered");
  return `${bits.join("-")}.xlsx`;
}
