import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { ORG_ROLE_CATEGORIES, orgRoleCategoryBadgeColor } from "@/lib/hr";
import { createOrgRole, toggleOrgRole } from "./actions";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn, labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrgRolesPage() {
  const session = await auth();
  const canManage =
    session?.user &&
    (hasPermission(session.user.role, "manage_users") ||
      hasPermission(session.user.role, "manage_employees"));

  const roles = await prisma.orgRole.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });

  const grouped = ORG_ROLE_CATEGORIES.map((cat) => ({
    category: cat,
    roles: roles.filter((r) => r.category === cat),
  })).filter((g) => g.roles.length > 0 || canManage);

  return (
    <div>
      <PageHeader
        title="Organization Roles"
        description="Job titles and panel positions — separate from app login permissions. Create custom roles for new staff categories."
        actions={
          <Link href="/settings" className="text-sm text-teal-800 hover:underline">
            Back to settings
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Role</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createOrgRole} className="space-y-4">
                <div>
                  <Label htmlFor="name">Role name *</Label>
                  <Input id="name" name="name" required className="mt-1" placeholder="Assistant Supervisor" />
                </div>
                <div>
                  <Label htmlFor="code">Code (optional)</Label>
                  <Input
                    id="code"
                    name="code"
                    className="mt-1 font-mono text-sm"
                    placeholder="ASSISTANT_SUPERVISOR"
                  />
                  <p className="mt-1 text-xs text-slate-500">Auto-generated from name if left blank.</p>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    {ORG_ROLE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {labelize(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Optional notes about this role"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Role
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className={canManage ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          {grouped.map(({ category, roles: catRoles }) => (
            <section key={category} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <span
                  className={cn(
                    "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                    orgRoleCategoryBadgeColor(category)
                  )}
                >
                  {labelize(category)}
                </span>
                <h2 className="mt-2 font-display text-lg font-semibold">{labelize(category)} Roles</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Staff</th>
                    <th>Type</th>
                    <th>Status</th>
                    {canManage ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {catRoles.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="text-slate-500">
                        No roles in this category.
                      </td>
                    </tr>
                  ) : (
                    catRoles.map((role) => (
                      <tr key={role.id}>
                        <td className="font-mono text-xs">{role.code}</td>
                        <td>
                          <div className="font-medium">{role.name}</div>
                          {role.description ? (
                            <div className="text-xs text-slate-500">{role.description}</div>
                          ) : null}
                        </td>
                        <td>{role._count.employees}</td>
                        <td>{role.isSystem ? "System" : "Custom"}</td>
                        <td>
                          <Badge status={role.isActive ? "ACTIVE" : "INACTIVE"} />
                        </td>
                        {canManage ? (
                          <td>
                            {!role.isSystem || !role.isActive ? (
                              <form action={toggleOrgRole}>
                                <input type="hidden" name="id" value={role.id} />
                                <Button type="submit" variant="outline" className="h-8 text-xs">
                                  {role.isActive ? "Deactivate" : "Activate"}
                                </Button>
                              </form>
                            ) : (
                              <span className="text-xs text-slate-400">Protected</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        App login permissions (Super Admin, Admin, Transfer Officer, etc.) are managed separately via user accounts.
        Khazanchi panel members typically map to the FINANCE app role when given system access.
      </p>
    </div>
  );
}
