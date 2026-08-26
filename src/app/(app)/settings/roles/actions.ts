"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { ORG_ROLE_CATEGORIES } from "@/lib/hr";
import type { OrgRoleCategory } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

function slugifyCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

async function assertCanManageRoles() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (
    !hasPermission(session.user.role, "manage_users") &&
    !hasPermission(session.user.role, "manage_employees")
  ) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function createOrgRole(formData: FormData) {
  const session = await assertCanManageRoles();

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "") as OrgRoleCategory;
  const description = String(formData.get("description") || "").trim() || null;
  const codeRaw = String(formData.get("code") || "").trim();
  const code = codeRaw ? slugifyCode(codeRaw) : slugifyCode(name);

  if (!name) throw new Error("Role name is required");
  if (!ORG_ROLE_CATEGORIES.includes(category)) throw new Error("Invalid category");

  const existing = await prisma.orgRole.findUnique({ where: { code } });
  if (existing) throw new Error(`Role code "${code}" already exists`);

  const role = await prisma.orgRole.create({
    data: {
      code,
      name,
      category,
      description,
      isSystem: false,
      isActive: true,
      sortOrder: 500,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ORG_ROLE_CREATED",
    module: "org_roles",
    recordId: role.id,
    newValue: { code: role.code, name: role.name, category: role.category },
  });

  revalidatePath("/settings/roles");
  revalidatePath("/employees");
}

export async function toggleOrgRole(formData: FormData) {
  const session = await assertCanManageRoles();

  const id = String(formData.get("id") || "");
  const role = await prisma.orgRole.findUnique({ where: { id } });
  if (!role) throw new Error("Role not found");
  if (role.isSystem && role.isActive) {
    throw new Error("System roles cannot be deactivated");
  }

  const updated = await prisma.orgRole.update({
    where: { id },
    data: { isActive: !role.isActive },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ORG_ROLE_TOGGLED",
    module: "org_roles",
    recordId: role.id,
    oldValue: { isActive: role.isActive },
    newValue: { isActive: updated.isActive },
  });

  revalidatePath("/settings/roles");
  revalidatePath("/employees");
}

export async function updateOrgRole(formData: FormData) {
  const session = await assertCanManageRoles();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  const role = await prisma.orgRole.findUnique({ where: { id } });
  if (!role) throw new Error("Role not found");
  if (!name) throw new Error("Role name is required");

  const updated = await prisma.orgRole.update({
    where: { id },
    data: { name, description },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ORG_ROLE_UPDATED",
    module: "org_roles",
    recordId: role.id,
    oldValue: { name: role.name, description: role.description },
    newValue: { name: updated.name, description: updated.description },
  });

  revalidatePath("/settings/roles");
}
