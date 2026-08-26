import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessModule, hasPermission } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { labelize } from "@/lib/utils";
import { createFinanceCategoryAction, toggleFinanceCategoryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function FinanceCategoriesPage() {
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_finance");

  if (!session?.user || !canAccessModule(session.user.role, "finance") || !canManage) {
    return (
      <div>
        <PageHeader title="Finance Categories" description="You do not have permission to manage categories." />
        <Link href="/finance" className="text-sm text-teal-800 hover:underline">
          Back to finance
        </Link>
      </div>
    );
  }

  const categories = await prisma.financeCategory.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const revenue = categories.filter((c) => c.type === "REVENUE");
  const expenses = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div>
      <PageHeader
        title="Finance Categories"
        description="Chart of accounts for society revenue and expenses. System categories cannot be deleted."
        actions={
          <Link href="/finance" className="text-sm text-teal-800 hover:underline">
            Back to ledger
          </Link>
        }
      />

      <form
        action={createFinanceCategoryAction}
        className="mb-8 max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-slate-800">Add custom category</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="REV_CUSTOM_FEE" className="mt-1 uppercase" />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              required
              defaultValue="REVENUE"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" className="mt-1" />
          </div>
        </div>
        <Button type="submit" size="sm">
          Add category
        </Button>
      </form>

      <CategoryTable title="Revenue categories" items={revenue} canManage={!!canManage} />
      <div className="mt-8">
        <CategoryTable title="Expense categories" items={expenses} canManage={!!canManage} />
      </div>
    </div>
  );
}

function CategoryTable({
  title,
  items,
  canManage,
}: {
  title: string;
  items: Array<{
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
    description: string | null;
    sortOrder: number;
  }>;
  canManage: boolean;
}) {
  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title="No categories" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>System</th>
                <th>Status</th>
                <th>Description</th>
                {canManage ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.code}</td>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.isSystem ? "Yes" : "Custom"}</td>
                  <td>
                    <Badge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="max-w-xs truncate text-slate-600">{c.description ?? "—"}</td>
                  {canManage ? (
                    <td>
                      {c.isSystem ? (
                        "—"
                      ) : (
                        <form action={toggleFinanceCategoryAction}>
                          <input type="hidden" name="categoryId" value={c.id} />
                          <Button type="submit" size="sm" variant="outline">
                            {c.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
