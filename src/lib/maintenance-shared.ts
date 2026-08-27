import { canManageMaintenance as canManageMaintenanceRole } from "@/lib/rbac";
import type { MaintenanceWorkStatus, PaymentStatus, Role } from "@/generated/prisma/client";

export const MAINTENANCE_TYPE_SUGGESTIONS = [
  "ELECTRICAL",
  "PLUMBING",
  "CIVIL",
  "ROADS",
  "STREET_LIGHTS",
  "PARK",
  "MOSQUE",
  "BUILDING",
  "GENERATOR",
  "OTHER",
] as const;

export const MAINTENANCE_STATUSES: MaintenanceWorkStatus[] = [
  "REPORTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const MAINTENANCE_PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "PARTIAL",
  "OVERDUE",
  "UNPAID",
];

export function canManageMaintenance(role: Role) {
  return canManageMaintenanceRole(role);
}

export function canViewMaintenance(role: Role) {
  return (
    canManageMaintenance(role) ||
    role === "VIEWER" ||
    role === "SECRETARY" ||
    role === "PRESIDENT"
  );
}

export function normalizeMaintenanceType(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Maintenance type is required");
  return trimmed;
}
