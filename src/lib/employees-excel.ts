import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextEmployeeCode } from "@/lib/numbering";
import {
  CONTRACTOR_TRADES,
  EMPLOYMENT_TYPES,
} from "@/lib/hr";
import type {
  ContractorTrade,
  EmployeeStatus,
  EmploymentType,
  OrgRoleCategory,
  Prisma,
} from "@/generated/prisma/client";
import { labelize } from "@/lib/utils";
import {
  type ExcelColumn,
  type ExcelCommitResult,
  type ExcelPreviewResult,
  mapRowCells,
  parseExcelDate,
  parseEnumValue,
  parseFirstSheet,
  parsePositiveNumber,
  summarizePreview,
} from "@/lib/excel";

const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "RESIGNED",
  "TERMINATED",
];

export const EMPLOYEE_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Employee Code", key: "employeeCode", width: 16 },
  { header: "Name", key: "name", width: 22 },
  { header: "CNIC", key: "cnic", width: 18 },
  { header: "Contact", key: "contact", width: 16 },
  { header: "Email", key: "email", width: 22 },
  { header: "Role Code", key: "roleCode", width: 22 },
  { header: "Role Name", key: "roleName", width: 22 },
  { header: "Employment Type", key: "employmentType", width: 18 },
  { header: "Department", key: "department", width: 16 },
  { header: "Supervisor Code", key: "supervisorCode", width: 16 },
  { header: "Joining Date", key: "joiningDate", width: 14 },
  { header: "Salary", key: "salary", width: 12 },
  { header: "Company Name", key: "companyName", width: 20 },
  { header: "Contractor Trade", key: "contractorTrade", width: 18 },
  { header: "Status", key: "status", width: 12 },
  { header: "Other Detail", key: "otherDetail", width: 18 },
  { header: "Remarks", key: "remarks", width: 22 },
];

const EMPLOYEE_ALIASES: Record<string, string[]> = {
  employeeCode: ["employee code", "code"],
  name: ["name", "staff name"],
  cnic: ["cnic"],
  contact: ["contact", "phone", "mobile"],
  email: ["email"],
  roleCode: ["role code", "org role code", "designation code"],
  roleName: ["role name", "role", "org role", "designation"],
  employmentType: ["employment type", "type"],
  department: ["department"],
  supervisorCode: ["supervisor code", "supervisor"],
  joiningDate: ["joining date", "joined"],
  salary: ["salary"],
  companyName: ["company name", "company"],
  contractorTrade: ["contractor trade", "trade"],
  status: ["status"],
  otherDetail: ["other detail", "job title"],
  remarks: ["remarks", "notes"],
};

export type EmployeeExcelFilters = {
  q?: string;
  status?: string;
  orgRoleId?: string;
  employmentType?: string;
  category?: string;
  group?: string;
};

export function employeeExcelWhere(filters: EmployeeExcelFilters): Prisma.EmployeeWhereInput {
  const status = filters.status?.trim() as EmployeeStatus | undefined;
  const employmentType = filters.employmentType?.trim() as EmploymentType | undefined;
  const category = filters.category?.trim() as OrgRoleCategory | undefined;
  const group = filters.group?.trim();
  const q = filters.q?.trim();

  const categoryFilter: Prisma.EmployeeWhereInput =
    category
      ? { orgRole: { category } }
      : group === "management"
        ? { orgRole: { category: { in: ["PANEL", "MANAGEMENT"] } } }
        : group === "operational"
          ? { orgRole: { category: { in: ["OPERATIONAL", "TECHNICAL"] } } }
          : group === "contractors"
            ? { employmentType: "CONTRACTOR" }
            : group === "panel"
              ? { employmentType: "PANEL_MEMBER" }
              : {};

  return {
    ...(status && EMPLOYEE_STATUSES.includes(status) ? { status } : {}),
    ...(filters.orgRoleId ? { orgRoleId: filters.orgRoleId } : {}),
    ...(employmentType && EMPLOYMENT_TYPES.includes(employmentType) ? { employmentType } : {}),
    ...categoryFilter,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { employeeCode: { contains: q, mode: "insensitive" } },
            { cnic: { contains: q } },
            { department: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function loadEmployeeExcelRows(filters: EmployeeExcelFilters) {
  const employees = await prisma.employee.findMany({
    where: employeeExcelWhere(filters),
    include: {
      orgRole: true,
      supervisor: { select: { employeeCode: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 10000,
  });
  return employees.map((e) => ({
    employeeCode: e.employeeCode,
    name: e.name,
    cnic: e.cnic,
    contact: e.contact ?? "",
    email: e.email ?? "",
    roleCode: e.orgRole?.code ?? "",
    roleName: e.orgRole?.name ?? "",
    employmentType: e.employmentType,
    department: e.department ?? "",
    supervisorCode: e.supervisor?.employeeCode ?? "",
    joiningDate: e.joiningDate,
    salary: e.salary != null ? Number(e.salary) : "",
    companyName: e.companyName ?? "",
    contractorTrade: e.contractorTrade ?? "",
    status: e.status,
    otherDetail: e.otherDetail ?? "",
    remarks: e.remarks ?? "",
  }));
}

type ParsedEmployeeRow = {
  rowNumber: number;
  summary: string;
  values: Record<string, string>;
  errors: string[];
  data?: {
    employeeCode: string | null;
    name: string;
    cnic: string;
    contact: string | null;
    email: string | null;
    orgRoleId: string;
    otherDetail: string | null;
    supervisorId: string | null;
    employmentType: EmploymentType;
    companyName: string | null;
    contractorTrade: ContractorTrade | null;
    department: string | null;
    joiningDate: Date;
    salary: number | null;
    status: EmployeeStatus;
    remarks: string | null;
  };
};

async function parseEmployeeImportRows(buffer: Buffer): Promise<ParsedEmployeeRow[]> {
  const parsed = await parseFirstSheet(buffer);
  const [roles, existing, supervisors] = await Promise.all([
    prisma.orgRole.findMany({ where: { isActive: true } }),
    prisma.employee.findMany({ select: { cnic: true, employeeCode: true } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, employeeCode: true },
    }),
  ]);
  const roleByCode = new Map(roles.map((r) => [r.code.toLowerCase(), r]));
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));
  const existingCnic = new Set(existing.map((e) => e.cnic.replace(/\s/g, "").toLowerCase()));
  const existingCodes = new Set(existing.map((e) => e.employeeCode.toLowerCase()));
  const supervisorByCode = new Map(supervisors.map((s) => [s.employeeCode.toLowerCase(), s.id]));
  const seenCnic = new Set<string>();
  const seenCodes = new Set<string>();

  return parsed.rows.map(({ rowNumber, cells }) => {
    const values = mapRowCells(cells, EMPLOYEE_ALIASES);
    const errors: string[] = [];
    const name = values.name.trim();
    const cnic = values.cnic.trim();
    if (!name) errors.push("Name is required.");
    if (!cnic) errors.push("CNIC is required.");
    const cnicKey = cnic.replace(/\s/g, "").toLowerCase();
    if (cnic) {
      if (existingCnic.has(cnicKey) || seenCnic.has(cnicKey)) {
        errors.push("This CNIC already exists. Staff records are not overwritten from Excel.");
      } else {
        seenCnic.add(cnicKey);
      }
    }

    const employeeCode = values.employeeCode.trim() || null;
    if (employeeCode) {
      const codeKey = employeeCode.toLowerCase();
      if (existingCodes.has(codeKey) || seenCodes.has(codeKey)) {
        errors.push("Employee code already exists.");
      } else {
        seenCodes.add(codeKey);
      }
    }

    const roleCode = values.roleCode.trim();
    const roleName = values.roleName.trim();
    const orgRole =
      (roleCode ? roleByCode.get(roleCode.toLowerCase()) : undefined) ??
      (roleName ? roleByName.get(roleName.toLowerCase()) : undefined) ??
      (roleCode ? roleByName.get(roleCode.toLowerCase()) : undefined);
    if (!orgRole) errors.push("Organization role is required (role code or name).");
    const otherDetail = values.otherDetail.trim() || null;
    if (orgRole?.code === "OTHER" && !otherDetail) {
      errors.push("Specify Other Detail when the role is Other.");
    }

    const employmentType =
      parseEnumValue(values.employmentType, EMPLOYMENT_TYPES, {
        STAFF: "Staff",
        CONTRACTOR: "Contractor",
        PANEL_MEMBER: "Panel Member",
        OTHER: "Other",
      }) ?? (values.employmentType ? null : "STAFF");
    if (values.employmentType && !employmentType) errors.push("Unknown employment type.");

    const contractorTrade = values.contractorTrade.trim()
      ? parseEnumValue(values.contractorTrade, CONTRACTOR_TRADES)
      : null;
    if (values.contractorTrade.trim() && !contractorTrade) errors.push("Unknown contractor trade.");

    const status =
      parseEnumValue(values.status, EMPLOYEE_STATUSES, Object.fromEntries(
        EMPLOYEE_STATUSES.map((s) => [s, labelize(s)])
      ) as Partial<Record<EmployeeStatus, string>>) ??
      (values.status ? null : "ACTIVE");
    if (values.status && !status) errors.push("Unknown status.");

    let salary: number | null = null;
    if (values.salary.trim()) {
      salary = parsePositiveNumber(values.salary);
      if (salary == null) errors.push("Salary must be a positive amount.");
    }

    const joiningDate = values.joiningDate.trim() ? parseExcelDate(values.joiningDate) : new Date();
    if (values.joiningDate.trim() && !joiningDate) errors.push("Joining date is not a valid date.");

    let supervisorId: string | null = null;
    if (values.supervisorCode.trim()) {
      supervisorId = supervisorByCode.get(values.supervisorCode.trim().toLowerCase()) ?? null;
      if (!supervisorId) errors.push("Supervisor code was not found among active staff.");
    }

    return {
      rowNumber,
      summary: [employeeCode, name, cnic].filter(Boolean).join(" · ") || `Row ${rowNumber}`,
      values,
      errors,
      data:
        errors.length === 0 && orgRole && employmentType && status && joiningDate
          ? {
              employeeCode,
              name,
              cnic,
              contact: values.contact.trim() || null,
              email: values.email.trim() || null,
              orgRoleId: orgRole.id,
              otherDetail,
              supervisorId,
              employmentType,
              companyName: values.companyName.trim() || null,
              contractorTrade: employmentType === "CONTRACTOR" ? contractorTrade : null,
              department: values.department.trim() || null,
              joiningDate,
              salary,
              status,
              remarks: values.remarks.trim() || null,
            }
          : undefined,
    };
  });
}

export async function previewEmployeeExcel(buffer: Buffer): Promise<ExcelPreviewResult> {
  return summarizePreview(await parseEmployeeImportRows(buffer));
}

export async function commitEmployeeExcel(buffer: Buffer, userId: string): Promise<ExcelCommitResult> {
  const rows = await parseEmployeeImportRows(buffer);
  let imported = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (const row of rows) {
    if (!row.data) {
      errors.push({ rowNumber: row.rowNumber, message: row.errors.join(" ") });
      continue;
    }
    try {
      const employeeCode = row.data.employeeCode || (await nextEmployeeCode());
      const employee = await prisma.employee.create({
        data: {
          employeeCode,
          name: row.data.name,
          cnic: row.data.cnic,
          contact: row.data.contact,
          email: row.data.email,
          orgRoleId: row.data.orgRoleId,
          otherDetail: row.data.otherDetail,
          supervisorId: row.data.supervisorId,
          employmentType: row.data.employmentType,
          companyName: row.data.companyName,
          contractorTrade: row.data.contractorTrade,
          department: row.data.department,
          joiningDate: row.data.joiningDate,
          salary: row.data.salary,
          status: row.data.status,
          remarks: row.data.remarks,
        },
      });
      await writeAuditLog({
        userId,
        action: "EMPLOYEE_EXCEL_IMPORTED",
        module: "employees",
        recordId: employee.id,
        newValue: {
          employeeCode: employee.employeeCode,
          name: employee.name,
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
        ? `Added ${imported} staff member${imported === 1 ? "" : "s"}. ${skipped ? `${skipped} row${skipped === 1 ? "" : "s"} skipped.` : ""}`.trim()
        : skipped
          ? "No staff were added. Fix the errors and try again."
          : "The spreadsheet has no data rows.",
  };
}

export function employeeExcelFilename(template?: boolean) {
  return template ? "employees-import-template.xlsx" : "employees-register.xlsx";
}
