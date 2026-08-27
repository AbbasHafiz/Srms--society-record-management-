import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMortgage } from "../actions";
import { plotTypeLabel } from "@/lib/plots";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewMortgagePage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/mortgages");
  }

  const sp = await searchParams;
  const q = sp.q?.trim();

  const plots = await prisma.plot.findMany({
    where: q
      ? {
          OR: [
            { plotNumber: { contains: q, mode: "insensitive" } },
            { sector: { contains: q, mode: "insensitive" } },
            {
              ownerships: {
                some: {
                  status: "ACTIVE",
                  OR: [
                    { ownerName: { contains: q, mode: "insensitive" } },
                    { membershipNumber: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : sp.plotId
        ? { id: sp.plotId }
        : undefined,
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
      mortgages: { where: { status: "ACTIVE" }, take: 1 },
    },
    take: 20,
    orderBy: { plotNumber: "asc" },
  });

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;

  return (
    <div>
      <PageHeader
        title="Register Mortgage"
        description="Record a bank mortgage / encumbrance on a plot. Active mortgages block transfers."
        actions={
          <Link href="/mortgages" className="text-sm text-teal-800 hover:underline">
            Back to mortgage register
          </Link>
        }
      />

      {!sp.plotId ? (
        <form className="mb-6 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search plot, owner, membership…"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
          <Button type="submit">Search</Button>
        </form>
      ) : null}

      <div className="space-y-4">
        {plots.length === 0 ? (
          <p className="text-sm text-slate-600">No plots found.</p>
        ) : (
          plots.map((p) => {
            const owner = p.ownerships[0];
            const isSelected = selectedPlot?.id === p.id;
            const hasActive = p.hasActiveMortgage || p.mortgages.length > 0;

            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  isSelected ? "border-teal-400 ring-1 ring-teal-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="space-y-2">
                    <p className="font-display text-lg font-semibold text-slate-900">
                      {p.sector}/{p.block}-{p.plotNumber}
                    </p>
                    <p className="text-sm text-slate-600">
                      {plotTypeLabel(p.plotType)} · {plotSizeDisplay(p)}
                    </p>
                    {owner ? (
                      <p className="text-sm text-slate-700">
                        Owner: <strong>{owner.ownerName}</strong> · {owner.membershipNumber}
                      </p>
                    ) : null}
                    {hasActive ? (
                      <p className="text-sm font-medium text-rose-700">Plot already has an active mortgage</p>
                    ) : null}
                  </div>

                  <form action={createMortgage} className="max-w-md space-y-3 lg:min-w-[20rem]">
                    <input type="hidden" name="plotId" value={p.id} />
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Bank name</label>
                      <Input name="bankName" required placeholder="e.g. HBL" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Loan reference</label>
                      <Input name="loanReference" placeholder="Optional" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Mortgage date</label>
                      <Input name="mortgageDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                      <select name="status" defaultValue="ACTIVE" className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="PENDING">Pending</option>
                        <option value="ACTIVE">Active</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Mortgage letter (optional)</label>
                      <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                      <textarea name="remarks" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <Button type="submit" className="w-full">Register mortgage</Button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
