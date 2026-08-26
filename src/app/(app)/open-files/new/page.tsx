import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpenFileDealerFields } from "@/components/open-files/open-file-dealer-fields";
import { createOpenFile } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOpenFilePage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/open-files");
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
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
    take: 20,
    orderBy: { plotNumber: "asc" },
  });

  const selectedPlot = sp.plotId ? plots.find((p) => p.id === sp.plotId) : undefined;
  const owner = selectedPlot?.ownerships[0];

  return (
    <div>
      <PageHeader
        title="New Open File"
        description="Register a dealer open file on a plot. Link a registered property office for letterhead and dealer name."
        actions={
          <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
            ← Open files
          </Link>
        }
      />

      {!sp.plotId ? (
        <form className="mb-6 flex gap-2">
          <Input name="q" placeholder="Search plot, sector, owner…" defaultValue={q} className="max-w-md" />
          <Button type="submit">Search plots</Button>
        </form>
      ) : null}

      {!sp.plotId && plots.length > 0 ? (
        <ul className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {plots.map((p) => {
            const o = p.ownerships[0];
            return (
              <li key={p.id}>
                <Link
                  href={`/open-files/new?plotId=${p.id}`}
                  className="block rounded-md px-3 py-2 hover:bg-slate-50"
                >
                  <span className="font-medium text-teal-900">
                    {p.sector}/{p.block}-{p.plotNumber}
                  </span>
                  {o ? (
                    <span className="ml-2 text-sm text-slate-600">
                      {o.ownerName} · {o.membershipNumber}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedPlot && owner ? (
        <form
          action={createOpenFile}
          className="grid max-w-3xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <input type="hidden" name="plotId" value={selectedPlot.id} />
          <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            Plot <strong>{selectedPlot.sector}/{selectedPlot.block}-{selectedPlot.plotNumber}</strong> · Seller{" "}
            <strong>{owner.ownerName}</strong>
          </div>

          <input type="hidden" name="sellerName" value={owner.ownerName} />
          <input type="hidden" name="sellerCnic" value={owner.cnic} />
          <input type="hidden" name="sellerMembershipNo" value={owner.membershipNumber} />

          <OpenFileDealerFields />

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">TRD number (optional)</span>
            <Input name="trdNumber" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Opening date</span>
            <Input name="openingDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit">Create open file</Button>
          </div>
        </form>
      ) : sp.plotId ? (
        <p className="text-sm text-rose-700">Plot not found or has no active owner.</p>
      ) : (
        <p className="text-sm text-slate-600">Search and select a plot to begin.</p>
      )}
    </div>
  );
}
