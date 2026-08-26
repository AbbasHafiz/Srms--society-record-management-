import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/ui/page";
import { createNocApplication } from "../actions";
import { plotTypeLabel } from "@/lib/plots";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { canCreateNocApplication } from "@/lib/noc";
import { formatCurrency } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewNocPage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; purpose?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canCreateNocApplication(session.user.role)) {
    redirect("/noc");
  }

  const sp = await searchParams;
  const q = sp.q?.trim();
  const defaultPurpose = sp.purpose === "CONSTRUCTION" ? "CONSTRUCTION" : "GENERAL";

  const [plots, nocFee] = await Promise.all([
    prisma.plot.findMany({
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
    }),
    prisma.feeConfiguration.findFirst({
      where: { feeType: "NOC", status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;

  return (
    <div>
      <PageHeader
        title="Apply for NOC"
        description="The plot owner applies to the society for a No Objection Certificate (NOC). For construction, the society reviews and issues NOC to build a house or structure on the plot."
        actions={
          <Link href="/noc" className="text-sm text-teal-800 hover:underline">
            Back to NOC register
          </Link>
        }
      />

      <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-950">
        <strong>Construction NOC:</strong> Owner applies to society for NOC to construct / build a house.
        Society staff verify ownership, plot size, and dues before issuing the certificate.
      </div>

      {!sp.plotId ? (
        <form className="mb-6 flex gap-2">
          <input type="hidden" name="purpose" value={defaultPurpose} />
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
          <p className="text-sm text-slate-600">No plots found. Search or open from a plot profile.</p>
        ) : (
          plots.map((p) => {
            const owner = p.ownerships[0];
            const mortgaged = p.hasActiveMortgage || p.mortgages.length > 0;
            const isSelected = selectedPlot?.id === p.id;

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
                      {plotTypeLabel(p.plotType)} ·{" "}
                      <span className="font-medium text-teal-900">{plotSizeDisplay(p)}</span>
                    </p>
                    {owner ? (
                      <p className="text-sm text-slate-700">
                        Owner: <strong>{owner.ownerName}</strong> · {owner.membershipNumber} ·{" "}
                        {owner.cnic}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-rose-700">No active owner on record</p>
                    )}
                    {nocFee ? (
                      <p className="text-sm text-slate-600">
                        NOC fee: <strong>{formatCurrency(nocFee.amount)}</strong>
                      </p>
                    ) : null}
                    {mortgaged && defaultPurpose === "CONSTRUCTION" ? (
                      <WarningBanner>
                        Active bank mortgage on this plot. Construction NOC may require bank clearance —
                        proceed with caution.
                      </WarningBanner>
                    ) : null}
                  </div>

                  {owner ? (
                    <form action={createNocApplication} className="max-w-md space-y-3 lg:min-w-[20rem]">
                      <input type="hidden" name="plotId" value={p.id} />
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          NOC purpose
                        </label>
                        <select
                          name="purpose"
                          defaultValue={defaultPurpose}
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="CONSTRUCTION">Build house / Construction</option>
                          <option value="TRANSFER">Transfer</option>
                          <option value="GENERAL">General</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Proposed construction type
                        </label>
                        <select
                          name="constructionType"
                          defaultValue="HOUSE"
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="HOUSE">House / Residential building</option>
                          <option value="BOUNDARY_WALL">Boundary wall</option>
                          <option value="EXTENSION">Extension / additional floor</option>
                          <option value="COMMERCIAL_BUILDING">Commercial building</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Application notes
                        </label>
                        <textarea
                          name="applicationNotes"
                          rows={2}
                          placeholder="e.g. Single-storey house, covered area details…"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      {mortgaged ? (
                        <label className="flex items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" name="acknowledgeMortgage" className="mt-1" />
                          I acknowledge the active mortgage warning and wish to submit this application.
                        </label>
                      ) : null}
                      <Button type="submit" className="w-full">
                        Submit NOC application
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
