import { Role } from "@/generated/prisma/client";

export type Permission =
  | "view"
  | "create"
  | "edit"
  | "approve"
  | "upload_document"
  | "verify_payment"
  | "complete_transfer"
  | "move_physical_file"
  | "configure_fees"
  | "manage_users"
  | "view_audit_logs"
  | "export_reports"
  | "manage_employees"
  | "mark_attendance"
  | "manage_settings"
  | "manage_finance";

const ALL: Permission[] = [
  "view",
  "create",
  "edit",
  "approve",
  "upload_document",
  "verify_payment",
  "complete_transfer",
  "move_physical_file",
  "configure_fees",
  "manage_users",
  "view_audit_logs",
  "export_reports",
  "manage_employees",
  "mark_attendance",
  "manage_settings",
  "manage_finance",
];

const ADMIN_PERMISSIONS: Permission[] = ALL.filter((p) => p !== "manage_users");

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ADMIN_PERMISSIONS,
  PRESIDENT: ["view", "export_reports", "view_audit_logs", "approve"],
  SECRETARY: ["view", "create", "edit", "approve", "upload_document", "export_reports", "view_audit_logs"],
  GM: [
    "view",
    "create",
    "edit",
    "approve",
    "upload_document",
    "export_reports",
    "view_audit_logs",
    "manage_employees",
  ],
  TRANSFER_OFFICER: [
    "view",
    "create",
    "edit",
    "upload_document",
    "complete_transfer",
    "move_physical_file",
    "export_reports",
  ],
  ASSOCIATE_TRANSFER_OFFICER: ["view", "create", "edit", "upload_document"],
  RECORD_MANAGER: ["view", "create", "edit", "upload_document", "move_physical_file", "export_reports"],
  FINANCE: ["view", "create", "edit", "verify_payment", "export_reports", "manage_employees", "manage_finance"],
  HR_ADMIN: ["view", "manage_employees", "mark_attendance", "export_reports"],
  SECURITY: ["view", "mark_attendance"],
  TANKER_OPERATOR: ["view", "create", "edit"],
  VIEWER: ["view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

const FLEET_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "FINANCE", "GM"];

/** HR, finance, GM, and admins can manage fleet fuel and mess records. */
export function canManageFleetRecords(role: Role): boolean {
  return FLEET_MANAGER_ROLES.includes(role);
}

export function canManageMess(role: Role): boolean {
  return canManageFleetRecords(role);
}

const SOCIETY_EXPENSE_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "FINANCE", "GM", "RECORD_MANAGER"];

export function canManageSocietyExpenses(role: Role): boolean {
  return SOCIETY_EXPENSE_MANAGER_ROLES.includes(role);
}

export function canManageElectricity(role: Role): boolean {
  return canManageSocietyExpenses(role);
}

export function canManageMaintenance(role: Role): boolean {
  return canManageSocietyExpenses(role);
}

export function canViewFuelSpending(role: Role): boolean {
  return canManageFleetRecords(role) || role === "TANKER_OPERATOR";
}

export function canAddFuelLog(role: Role): boolean {
  if (role === "TANKER_OPERATOR") return false;
  return canManageFleetRecords(role) || hasPermission(role, "edit") || hasPermission(role, "manage_employees");
}

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
const WITHOUT_TANKER_OPERATOR = ALL_ROLES.filter((r) => r !== "TANKER_OPERATOR");

const PATH_MODULES = ([
  ["/notifications/whatsapp", "notifications/whatsapp"],
  ["/notifications", "notifications"],
  ["/annual-charges", "annual-charges"],
  ["/open-files", "open-files"],
  ["/poa", "poa"],
  ["/offices", "offices"],
  ["/physical-files", "physical-files"],
  ["/dashboard", "dashboard"],
  ["/owners", "plots"],
  ["/transfers", "transfers"],
  ["/tax", "transfers"],
  ["/documents", "documents"],
  ["/memberships", "memberships"],
  ["/possession", "possession"],
  ["/mortgages", "mortgages"],
  ["/attendance", "attendance"],
  ["/employees", "employees"],
  ["/settings/backup", "settings/backup"],
  ["/settings", "settings"],
  ["/finance", "finance"],
  ["/payments", "payments"],
  ["/reports", "reports"],
  ["/tankers", "tankers"],
  ["/garbage", "garbage"],
  ["/vehicles", "vehicles"],
  ["/electricity", "electricity"],
  ["/maintenance", "maintenance"],
  ["/mess", "mess"],
  ["/audit", "audit"],
  ["/plot-status", "plot-status"],
  ["/dues-slip", "plot-status"],
  ["/plots", "plots"],
  ["/search", "dashboard"],
  ["/hr", "hr"],
  ["/noc", "documents"],
  ["/nec", "documents"],
  ["/f", "plots"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

export function getModuleForPath(pathname: string): string | null {
  for (const [prefix, module] of PATH_MODULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return module;
    }
  }
  return null;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const routeModule = getModuleForPath(pathname);
  if (routeModule === "settings/backup") return canManageBackup(role);
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (!routeModule) {
    return role !== "TANKER_OPERATOR";
  }
  return canAccessModule(role, routeModule);
}

const POA_REGISTER_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SECRETARY",
  "GM",
  "TRANSFER_OFFICER",
  "ASSOCIATE_TRANSFER_OFFICER",
  "RECORD_MANAGER",
];

/** Records, transfer desk, secretary, and admins register PoA / open files. Finance is not required except fee payments. */
export function canRegisterPoa(role: Role): boolean {
  return POA_REGISTER_ROLES.includes(role);
}

export function canRegisterOpenFile(role: Role): boolean {
  return canRegisterPoa(role) || hasPermission(role, "create");
}

const BACKUP_ROLES: Role[] = ["SUPER_ADMIN", "GM"];

/** Full database + uploads backup/restore. Not granted to ADMIN or Finance. */
export function canManageBackup(role: Role): boolean {
  return BACKUP_ROLES.includes(role);
}

export function canAccessModule(role: Role, module: string): boolean {
  if (module === "settings/backup") return canManageBackup(role);
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const map: Record<string, Role[]> = {
    dashboard: ALL_ROLES,
    plots: WITHOUT_TANKER_OPERATOR,
    transfers: [
      "SUPER_ADMIN",
      "ADMIN",
      "PRESIDENT",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
    ],
    documents: [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "VIEWER",
      "PRESIDENT",
    ],
    payments: ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM", "FINANCE", "VIEWER"],
    finance: ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM", "FINANCE", "VIEWER"],
    "open-files": [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    poa: [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    offices: [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    "physical-files": [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "RECORD_MANAGER",
      "TRANSFER_OFFICER",
      "VIEWER",
      "PRESIDENT",
    ],
    employees: ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM", "HR_ADMIN", "FINANCE", "VIEWER"],
    hr: ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM", "HR_ADMIN", "FINANCE", "VIEWER"],
    attendance: ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "SECURITY", "GM", "SECRETARY", "VIEWER"],
    tankers: ["SUPER_ADMIN", "ADMIN", "GM", "SECRETARY", "FINANCE", "VIEWER", "PRESIDENT", "TANKER_OPERATOR"],
    garbage: ["SUPER_ADMIN", "ADMIN", "GM", "SECRETARY", "HR_ADMIN", "VIEWER", "PRESIDENT", "TANKER_OPERATOR"],
    vehicles: ["SUPER_ADMIN", "ADMIN", "GM", "SECRETARY", "HR_ADMIN", "FINANCE", "VIEWER", "TANKER_OPERATOR"],
    mess: ["SUPER_ADMIN", "ADMIN", "GM", "SECRETARY", "HR_ADMIN", "FINANCE", "VIEWER", "PRESIDENT"],
    electricity: ["SUPER_ADMIN", "ADMIN", "GM", "FINANCE", "RECORD_MANAGER", "VIEWER", "PRESIDENT", "SECRETARY"],
    maintenance: ["SUPER_ADMIN", "ADMIN", "GM", "FINANCE", "RECORD_MANAGER", "VIEWER", "PRESIDENT", "SECRETARY"],
    reports: [
      "SUPER_ADMIN",
      "ADMIN",
      "PRESIDENT",
      "SECRETARY",
      "GM",
      "FINANCE",
      "TRANSFER_OFFICER",
      "VIEWER",
    ],
    notifications: WITHOUT_TANKER_OPERATOR,
    "notifications/whatsapp": WITHOUT_TANKER_OPERATOR,
    memberships: WITHOUT_TANKER_OPERATOR,
    mortgages: [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    possession: [
      "SUPER_ADMIN",
      "ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    "annual-charges": ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM", "FINANCE", "VIEWER"],
    "plot-status": [
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
    ],
    audit: ["SUPER_ADMIN", "ADMIN", "PRESIDENT", "SECRETARY", "GM"],
    settings: ["SUPER_ADMIN", "ADMIN", "SECRETARY", "GM"],
    /** Full DB + files backup. Finance Excel import is not a substitute. */
    "settings/backup": ["SUPER_ADMIN", "GM"],
  };
  return map[module]?.includes(role) ?? false;
}
