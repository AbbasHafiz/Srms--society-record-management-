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
  | "manage_settings";

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
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  PRESIDENT: ["view", "export_reports", "view_audit_logs", "approve"],
  SECRETARY: ["view", "create", "edit", "approve", "upload_document", "export_reports", "view_audit_logs"],
  GM: ["view", "create", "edit", "approve", "upload_document", "export_reports", "view_audit_logs", "manage_employees"],
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
  FINANCE: ["view", "create", "edit", "verify_payment", "export_reports"],
  HR_ADMIN: ["view", "manage_employees", "mark_attendance", "export_reports"],
  SECURITY: ["view", "mark_attendance"],
  VIEWER: ["view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessModule(role: Role, module: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  const map: Record<string, Role[]> = {
    dashboard: ALL_ROLES,
    plots: ALL_ROLES,
    transfers: [
      "SUPER_ADMIN",
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
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "VIEWER",
      "PRESIDENT",
    ],
    payments: ["SUPER_ADMIN", "PRESIDENT", "SECRETARY", "GM", "FINANCE", "VIEWER"],
    "open-files": [
      "SUPER_ADMIN",
      "SECRETARY",
      "GM",
      "TRANSFER_OFFICER",
      "ASSOCIATE_TRANSFER_OFFICER",
      "RECORD_MANAGER",
      "FINANCE",
      "VIEWER",
      "PRESIDENT",
    ],
    "physical-files": ["SUPER_ADMIN", "SECRETARY", "GM", "RECORD_MANAGER", "TRANSFER_OFFICER", "VIEWER", "PRESIDENT"],
    employees: ["SUPER_ADMIN", "PRESIDENT", "SECRETARY", "GM", "HR_ADMIN", "VIEWER"],
    hr: ["SUPER_ADMIN", "PRESIDENT", "SECRETARY", "GM", "HR_ADMIN", "VIEWER"],
    attendance: ["SUPER_ADMIN", "HR_ADMIN", "SECURITY", "GM", "SECRETARY", "VIEWER"],
    tankers: ["SUPER_ADMIN", "GM", "SECRETARY", "FINANCE", "VIEWER", "PRESIDENT"],
    vehicles: ["SUPER_ADMIN", "GM", "SECRETARY", "HR_ADMIN", "VIEWER"],
    reports: ["SUPER_ADMIN", "PRESIDENT", "SECRETARY", "GM", "FINANCE", "TRANSFER_OFFICER", "VIEWER"],
    audit: ["SUPER_ADMIN", "PRESIDENT", "SECRETARY", "GM"],
    settings: ["SUPER_ADMIN", "SECRETARY", "GM"],
  };
  return map[module]?.includes(role) ?? false;
}

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
