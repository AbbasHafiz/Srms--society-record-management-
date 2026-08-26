import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { createTransferDraft } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({
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
        title="New Transfer — Step 1"
        description="Search and select a plot. History is preserved; old membership is never deleted."
        actions={
          <Link href="/transfers" className="text-sm text-teal-800 hover:underline">
            Back to transfers
          </Link>
        }
      />

      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search plot, owner, membership…"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="space-y-3">
        {plots.map((p) => {
          const owner = p.ownerships[0];
          const mortgaged = p.mortgages.length > 0;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-display text-lg font-semibold text-slate-900">
                  {p.sector}/{p.block}-{p.plotNumber}
                </p>
                <p className="text-sm text-slate-600">
                  Owner: {owner?.ownerName} · {owner?.membershipNumber} · {owner?.cnic}
                </p>
                {mortgaged ? (
                  <p className="mt-1 text-sm font-medium text-rose-700">
                    ⚠ Active mortgage — transfer completion will be blocked until bank clearance
                  </p>
                ) : null}
              </div>
              <form action={createTransferDraft}>
                <input type="hidden" name="plotId" value={p.id} />
                <Button type="submit" disabled={!owner}>
                  Select &amp; continue
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
