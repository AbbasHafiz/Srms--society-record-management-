import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/ui/page";
import { createPossessionApplication } from "../actions";
import { plotTypeLabel } from "@/lib/plots";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { canCreatePossessionApplication } from "@/lib/possession";
import { formatCurrency } from "@/lib/utils";
import { redirect } from "next/navigation";
import { OwnerAppearanceFields } from "@/components/poa/owner-appearance-fields";
import { isPossessionPoa } from "@/lib/poa-shared";

export const dynamic = "force-dynamic";

export default async function NewPossessionPage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canCreatePossessionApplication(session.user.role)) {
    redirect("/possession");
  }

  const sp = await searchParams;
  const q = sp.q?.trim();

  const [plots, possessionFee] = await Promise.all([
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
        powerOfAttorneys: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            poaNumber: true,
            kind: true,
            purpose: true,
            attorneyName: true,
            attorneyCnic: true,
            status: true,
            principalCnic: true,
          },
        },
      },
      take: 20,
      orderBy: { plotNumber: "asc" },
    }),
    prisma.feeConfiguration.findFirst({
      where: { feeType: "POSSESSION", status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;

  return (
    <div>
      <PageHeader
        title="Apply for Possession"
        description="Submit a possession application for an allotted plot. Fee is taken from active POSSESSION fee configuration."
        actions={
          <Link href="/possession" className="text-sm text-teal-800 hover:underline">
            Back to possession register
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
          <p className="text-sm text-slate-600">No plots found. Search or open from a plot profile.</p>
        ) : (
          plots.map((p) => {
            const owner = p.ownerships[0];
            const isSelected = selectedPlot?.id === p.id;
            const alreadyIssued = p.possessionStatus === "ISSUED";

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
                        Owner: <strong>{owner.ownerName}</strong> · {owner.membershipNumber}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-rose-700">No active owner on record</p>
                    )}
                    {possessionFee ? (
                      <p className="text-sm text-slate-600">
                        Possession fee: <strong>{formatCurrency(possessionFee.amount)}</strong>
                      </p>
                    ) : null}
                    {alreadyIssued ? (
                      <WarningBanner>Possession already issued for this plot.</WarningBanner>
                    ) : null}
                  </div>

                  {owner && !alreadyIssued ? (
                    <form action={createPossessionApplication} className="max-w-md space-y-3 lg:min-w-[20rem]">
                      <input type="hidden" name="plotId" value={p.id} />
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Applicant name
                        </label>
                        <input
                          name="applicantName"
                          defaultValue={owner.ownerName}
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                        />
                      </div>
                      <OwnerAppearanceFields
                        legend="Owner appearing for possession"
                        newPoaHref={`/poa/new?plotId=${p.id}`}
                        poas={p.powerOfAttorneys.filter(
                          (poa) =>
                            isPossessionPoa(poa) &&
                            poa.principalCnic.replace(/\D/g, "") === owner.cnic.replace(/\D/g, "")
                        )}
                      />
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Remarks
                        </label>
                        <textarea
                          name="remarks"
                          rows={2}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Submit possession application
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
