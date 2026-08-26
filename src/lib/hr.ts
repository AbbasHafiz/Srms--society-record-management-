import type {
  Designation,
  OrgRoleCategory,
  EmploymentType,
  ContractorTrade,
} from "@/generated/prisma/client";

export const ALL_DESIGNATIONS: Designation[] = [
  "PRESIDENT",
  "SECRETARY",
  "GM",
  "TRANSFER_OFFICER",
  "ASSOCIATE_TRANSFER_OFFICER",
  "RECORD_MANAGER",
  "FINANCE",
  "COOK",
  "DRIVER",
  "COMPUTER_OPERATOR",
  "ELECTRICIAN",
  "PLUMBER",
  "MALI",
  "SWEEPER",
  "MESS",
  "SECURITY_GUARD",
  "TRACTOR_DRIVER",
  "OTHER",
];

export const ORG_ROLE_CATEGORIES: OrgRoleCategory[] = [
  "PANEL",
  "MANAGEMENT",
  "OPERATIONAL",
  "TECHNICAL",
  "CONTRACTOR",
  "OTHER",
];

export const EMPLOYMENT_TYPES: EmploymentType[] = ["STAFF", "CONTRACTOR", "PANEL_MEMBER", "OTHER"];

export const CONTRACTOR_TRADES: ContractorTrade[] = [
  "ELECTRICAL",
  "MAINTENANCE",
  "CIVIL",
  "PLUMBING",
  "DEVELOPMENT",
  "OTHER",
];

export const MANAGEMENT_DESIGNATIONS: Designation[] = [
  "PRESIDENT",
  "SECRETARY",
  "GM",
  "TRANSFER_OFFICER",
  "ASSOCIATE_TRANSFER_OFFICER",
  "RECORD_MANAGER",
  "FINANCE",
];

export const OPERATIONAL_DESIGNATIONS: Designation[] = ALL_DESIGNATIONS.filter(
  (d) => !MANAGEMENT_DESIGNATIONS.includes(d)
);

/** Quick-filter chips for operational staff on the employees list. */
export const QUICK_FILTER_DESIGNATIONS: Designation[] = [
  "COOK",
  "DRIVER",
  "COMPUTER_OPERATOR",
  "MALI",
  "SWEEPER",
  "SECURITY_GUARD",
  "TRACTOR_DRIVER",
  "MESS",
  "ELECTRICIAN",
  "PLUMBER",
];

export const PANEL_ORG_ROLE_CODES = [
  "PRESIDENT",
  "SECRETARY",
  "EXECUTIVE_MEMBER",
  "GM",
  "KHAZANCHI",
  "TRANSFER_OFFICER",
  "BUILDING_INSPECTOR",
  "ARCHITECT",
  "SUPERVISOR",
  "RECORD_KEEPER",
  "ADMIN",
] as const;

export function isManagementDesignation(designation: Designation | null | undefined): boolean {
  return designation ? MANAGEMENT_DESIGNATIONS.includes(designation) : false;
}

export function isManagementCategory(category: OrgRoleCategory): boolean {
  return category === "PANEL" || category === "MANAGEMENT";
}

export function orgRoleCategoryBadgeColor(category: OrgRoleCategory): string {
  switch (category) {
    case "PANEL":
      return "bg-purple-100 text-purple-900 border-purple-200";
    case "MANAGEMENT":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "OPERATIONAL":
      return "bg-lime-100 text-lime-900 border-lime-200";
    case "TECHNICAL":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "CONTRACTOR":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function designationBadgeColor(designation: Designation): string {
  if (MANAGEMENT_DESIGNATIONS.includes(designation)) {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  switch (designation) {
    case "COOK":
    case "MESS":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "DRIVER":
    case "TRACTOR_DRIVER":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "COMPUTER_OPERATOR":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "SECURITY_GUARD":
      return "bg-slate-800 text-white border-slate-700";
    case "MALI":
    case "SWEEPER":
      return "bg-lime-100 text-lime-900 border-lime-200";
    case "ELECTRICIAN":
    case "PLUMBER":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function employmentTypeBadgeColor(type: EmploymentType): string {
  switch (type) {
    case "CONTRACTOR":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "PANEL_MEMBER":
      return "bg-purple-100 text-purple-900 border-purple-200";
    case "STAFF":
      return "bg-teal-100 text-teal-900 border-teal-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/** Map legacy Designation enum values to OrgRole codes for migration/display fallback. */
export const DESIGNATION_TO_ORG_ROLE_CODE: Record<Designation, string> = {
  PRESIDENT: "PRESIDENT",
  SECRETARY: "SECRETARY",
  GM: "GM",
  TRANSFER_OFFICER: "TRANSFER_OFFICER",
  ASSOCIATE_TRANSFER_OFFICER: "ASSOCIATE_TRANSFER_OFFICER",
  RECORD_MANAGER: "RECORD_KEEPER",
  FINANCE: "KHAZANCHI",
  COOK: "COOK",
  DRIVER: "DRIVER",
  COMPUTER_OPERATOR: "COMPUTER_OPERATOR",
  ELECTRICIAN: "ELECTRICIAN",
  PLUMBER: "PLUMBER",
  MALI: "MALI",
  SWEEPER: "SWEEPER",
  MESS: "MESS",
  SECURITY_GUARD: "SECURITY_GUARD",
  TRACTOR_DRIVER: "TRACTOR_DRIVER",
  OTHER: "OTHER",
};

export type OrgRoleDisplay = {
  name: string;
  category: OrgRoleCategory;
  code: string;
};

export function resolveEmployeeRoleDisplay(employee: {
  orgRole?: OrgRoleDisplay | null;
  designation?: Designation | null;
}): { label: string; category: OrgRoleCategory; colorClass: string } {
  if (employee.orgRole) {
    return {
      label: employee.orgRole.name,
      category: employee.orgRole.category,
      colorClass: orgRoleCategoryBadgeColor(employee.orgRole.category),
    };
  }
  if (employee.designation) {
    const category = isManagementDesignation(employee.designation) ? "MANAGEMENT" : "OPERATIONAL";
    return {
      label: employee.designation.replace(/_/g, " "),
      category,
      colorClass: designationBadgeColor(employee.designation),
    };
  }
  return {
    label: "Unassigned",
    category: "OTHER",
    colorClass: orgRoleCategoryBadgeColor("OTHER"),
  };
}

export function isSecurityGuardEmployee(employee: {
  designation?: Designation | null;
  orgRole?: { code: string } | null;
}): boolean {
  return employee.orgRole?.code === "SECURITY_GUARD" || employee.designation === "SECURITY_GUARD";
}

export function employeeRoleLabel(employee: {
  orgRole?: { name: string; category?: OrgRoleCategory; code?: string } | null;
  designation?: Designation | null;
}): string {
  return resolveEmployeeRoleDisplay({
    orgRole:
      employee.orgRole?.category && employee.orgRole?.code
        ? (employee.orgRole as OrgRoleDisplay)
        : employee.orgRole
          ? {
              name: employee.orgRole.name,
              category: employee.orgRole.category ?? "OTHER",
              code: employee.orgRole.code ?? "OTHER",
            }
          : null,
    designation: employee.designation,
  }).label;
}
