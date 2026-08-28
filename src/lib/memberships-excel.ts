import { prisma } from "@/lib/db";
import { plotLabel } from "@/lib/plots";
import { formatDate } from "@/lib/utils";
import type { OwnershipStatus, Prisma } from "@/generated/prisma/client";
import type { ExcelColumn } from "@/lib/excel";

const STATUS_OPTIONS: OwnershipStatus[] = ["ACTIVE", "TRANSFERRED", "CANCELLED", "SUSPENDED"];

export const MEMBERSHIP_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Membership Number", key: "membershipNumber", width: 18 },
  { header: "Allotment Number", key: "allotmentNumber", width: 18 },
  { header: "Owner Name", key: "ownerName", width: 22 },
  { header: "CNIC", key: "cnic", width: 18 },
  { header: "Contact", key: "contact", width: 16 },
  { header: "Plot", key: "plot", width: 18 },
  { header: "Sector", key: "sector", width: 12 },
  { header: "Block", key: "block", width: 10 },
  { header: "Plot Number", key: "plotNumber", width: 14 },
  { header: "Start Date", key: "startDate", width: 14 },
  { header: "End Date", key: "endDate", width: 14 },
  { header: "Status", key: "status", width: 14 },
  { header: "Transfer Number", key: "transferNumber", width: 16 },
];

export type MembershipExcelFilters = {
  q?: string;
  status?: string;
  deceased?: string;
};

export function membershipExcelWhere(filters: MembershipExcelFilters): Prisma.OwnershipWhereInput {
  const q = filters.q?.trim();
  const status = filters.status?.trim() as OwnershipStatus | undefined;
  const deceasedOnly = filters.deceased === "1";
  return {
    ...(status && STATUS_OPTIONS.includes(status) ? { status } : {}),
    ...(deceasedOnly
      ? { status: "TRANSFERRED", transferOut: { transferType: "DEATH_SUCCESSION" } }
      : {}),
    ...(q
      ? {
          OR: [
            { ownerName: { contains: q, mode: "insensitive" } },
            { membershipNumber: { contains: q, mode: "insensitive" } },
            { allotmentNumber: { contains: q, mode: "insensitive" } },
            { cnic: { contains: q } },
            { plot: { plotNumber: { contains: q, mode: "insensitive" } } },
            { plot: { sector: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function loadMembershipExcelRows(filters: MembershipExcelFilters) {
  const memberships = await prisma.ownership.findMany({
    where: membershipExcelWhere(filters),
    include: {
      plot: true,
      transferOut: { select: { transferNumber: true, transferType: true } },
      transferIn: { select: { transferNumber: true } },
    },
    orderBy: [{ status: "asc" }, { membershipNumber: "asc" }],
    take: 10000,
  });
  return memberships.map((m) => {
    const deceased =
      m.status === "TRANSFERRED" && m.transferOut?.transferType === "DEATH_SUCCESSION";
    return {
      membershipNumber: m.membershipNumber,
      allotmentNumber: m.allotmentNumber,
      ownerName: m.ownerName,
      cnic: m.cnic,
      contact: m.contact ?? "",
      plot: plotLabel(m.plot),
      sector: m.plot.sector,
      block: m.plot.block ?? "",
      plotNumber: m.plot.plotNumber,
      startDate: formatDate(m.startDate),
      endDate: m.endDate ? formatDate(m.endDate) : "",
      status: deceased ? "DECEASED" : m.status,
      transferNumber: m.transferOut?.transferNumber ?? m.transferIn?.transferNumber ?? "",
    };
  });
}

export const OWNERSHIP_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Owner Name", key: "ownerName", width: 22 },
  { header: "CNIC", key: "cnic", width: 18 },
  { header: "Membership Number", key: "membershipNumber", width: 18 },
  { header: "Allotment Number", key: "allotmentNumber", width: 18 },
  { header: "Plot", key: "plot", width: 18 },
  { header: "Period Start", key: "startDate", width: 14 },
  { header: "Period End", key: "endDate", width: 14 },
  { header: "Status", key: "status", width: 14 },
];

export async function loadOwnershipExcelRows(filters: { q?: string; status?: string }) {
  const q = filters.q?.trim();
  const status = filters.status?.trim() as OwnershipStatus | undefined;
  const ownerships = await prisma.ownership.findMany({
    where: {
      ...(status && STATUS_OPTIONS.includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { ownerName: { contains: q, mode: "insensitive" } },
              { membershipNumber: { contains: q, mode: "insensitive" } },
              { allotmentNumber: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
            ],
          }
        : {}),
    },
    include: { plot: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 10000,
  });
  return ownerships.map((o) => ({
    ownerName: o.ownerName,
    cnic: o.cnic,
    membershipNumber: o.membershipNumber,
    allotmentNumber: o.allotmentNumber,
    plot: plotLabel(o.plot),
    startDate: formatDate(o.startDate),
    endDate: o.endDate ? formatDate(o.endDate) : "present",
    status: o.status,
  }));
}

export function membershipExcelFilename(template?: boolean) {
  return template ? "plots-import-template.xlsx" : "membership-register.xlsx";
}
