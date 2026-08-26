import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { createPlot } from "../actions";
import { PlotPropertyDetailsFields } from "@/components/plots/plot-property-details-fields";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewPlotPage() {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/plots");
  }

  const sizeOptions = await prisma.propertySizeOption.findMany({
    where: { isActive: true },
    orderBy: [{ propertyType: "asc" }, { sortOrder: "asc" }],
  });

  const serializedSizes = sizeOptions.map((o) => ({
    id: o.id,
    propertyType: o.propertyType,
    label: o.label,
    sizeValue: o.sizeValue.toString(),
    unit: o.unit,
    sizeMarla: o.sizeMarla?.toString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Register Property"
        description="Add a new plot, flat, shop, park, masjid, or other society property to the master register."
        actions={
          <Link href="/plots" className="text-sm text-teal-800 hover:underline">
            Back to plot register
          </Link>
        }
      />

      <form
        action={createPlot}
        className="max-w-2xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <fieldset className="space-y-4">
          <legend className="font-display text-base font-semibold text-slate-900">Location</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sector" name="sector" required placeholder="E-17" />
            <Field label="Block" name="block" placeholder="3" />
            <Field label="Plot / Unit no." name="plotNumber" required placeholder="123" />
            <Field label="Street" name="street" placeholder="Street 12" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-base font-semibold text-slate-900">Property details</legend>
          <PlotPropertyDetailsFields sizeOptions={serializedSizes} />
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Remarks
            </label>
            <textarea
              name="remarks"
              rows={2}
              placeholder="Optional notes (e.g. society amenity, no possession file)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit">Register property</Button>
          <Link href="/plots">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      />
    </div>
  );
}
