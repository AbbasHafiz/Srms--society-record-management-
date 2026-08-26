import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageMess } from "@/lib/rbac";
import { MessMealTypeFields } from "@/components/mess/mess-meal-type-fields";
import { updateMessMeal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditMessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !canManageMess(session.user.role)) {
    redirect("/mess");
  }

  const meal = await prisma.messMeal.findUnique({ where: { id } });
  if (!meal) notFound();
  if (meal.status === "CANCELLED") redirect(`/mess/${id}`);

  return (
    <div>
      <PageHeader
        title="Edit meal record"
        description={`${meal.mealType} on ${meal.mealDate.toISOString().slice(0, 10)}`}
        actions={
          <Link href={`/mess/${meal.id}`} className="text-sm text-teal-800 hover:underline">
            Cancel editing
          </Link>
        }
      />

      <form action={updateMessMeal} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="id" value={meal.id} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Date *</span>
          <Input type="date" name="mealDate" defaultValue={meal.mealDate.toISOString().slice(0, 10)} required />
        </label>
        <MessMealTypeFields defaultMealType={meal.mealType} defaultOtherDetail={meal.otherDetail ?? ""} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Headcount / beneficiaries *</span>
          <Input type="number" name="headcount" min="1" step="1" defaultValue={String(meal.headcount)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Cost (PKR) *</span>
          <Input type="number" name="amount" min="0" step="0.01" defaultValue={String(meal.amount)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Vendor (optional)</span>
          <Input name="vendor" defaultValue={meal.vendor ?? ""} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Remarks</span>
          <Input name="remarks" defaultValue={meal.remarks ?? ""} />
        </label>
        <Button type="submit">Save changes</Button>
      </form>
    </div>
  );
}
