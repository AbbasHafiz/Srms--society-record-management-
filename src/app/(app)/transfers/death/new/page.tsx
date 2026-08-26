import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createDeathSuccessionDraft } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewDeathTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string }>;
}) {
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

  return (
    <div>
      <PageHeader
        title="Death / Succession Transfer — Case Intake"
        description="Open a succession case when a plot owner has passed away. Legal heirs, FRC (NADRA), and supporting documents are required before completion."
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/transfers/new" className="text-teal-800 hover:underline">
              Sale transfer
            </Link>
            <Link href="/transfers" className="text-teal-800 hover:underline">
              Back to transfers
            </Link>
          </div>
        }
      />

      <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <p className="font-medium">Pakistani society-office succession process</p>
        <p className="mt-1 text-violet-900">
          Record the deceased member, legal heirs (wife, children, etc.), FRC from NADRA, and CNIC of
          each heir. Society transfers membership to the nominated primary successor with heir consent —
          prior ownership history is never deleted.
        </p>
      </div>

      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search plot, deceased owner, membership…"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="space-y-4">
        {plots.map((p) => {
          const owner = p.ownerships[0];
          const mortgaged = p.mortgages.length > 0;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4">
                <p className="font-display text-lg font-semibold text-slate-900">
                  {p.sector}/{p.block}-{p.plotNumber}
                </p>
                <p className="text-sm text-slate-600">
                  Deceased owner: {owner?.ownerName} · {owner?.membershipNumber} · {owner?.cnic}
                </p>
                {mortgaged ? (
                  <p className="mt-1 text-sm font-medium text-rose-700">
                    Active mortgage — bank clearance required before completion
                  </p>
                ) : null}
              </div>

              {owner ? (
                <form action={createDeathSuccessionDraft} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <input type="hidden" name="plotId" value={p.id} />
                  <div>
                    <Label htmlFor={`dod-${p.id}`}>Date of death</Label>
                    <Input
                      id={`dod-${p.id}`}
                      name="deceasedDateOfDeath"
                      type="date"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cert-${p.id}`}>Death certificate ref (optional)</Label>
                    <Input
                      id={`cert-${p.id}`}
                      name="deathCertificateRef"
                      placeholder="UC / NADRA ref"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`remarks-${p.id}`}>Case remarks</Label>
                    <Input
                      id={`remarks-${p.id}`}
                      name="remarks"
                      placeholder="e.g. Widow + 2 children — heir consent on file"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit">Open succession case</Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-500">No active owner on this plot.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
