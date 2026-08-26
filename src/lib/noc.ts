import type { Role } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/rbac";

export function canApproveNoc(role: Role): boolean {
  return (
    hasPermission(role, "approve") ||
    role === "RECORD_MANAGER" ||
    role === "SUPER_ADMIN"
  );
}

export function canCreateNocApplication(role: Role): boolean {
  return hasPermission(role, "create") || hasPermission(role, "edit");
}
