import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRegisterPoa } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { PoaCreateFields } from "@/components/poa/poa-create-fields";
import { createPowerOfAttorney } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPoaPage({
  searchParams,
}: {
  searchParams: Promise<{ plotId?: string; q?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canRegisterPoa(session.user.role)) {
    redirect("/poa");
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
        title="Register power of attorney"
        description="Linked to the current owner (principal). The attorney may appear at society to sell / open-file / transfer, process possession, or apply for NOC — after Tehsildar and, if abroad, Foreign Office verification."
        actions={
          <Link href="/poa" className="text-sm text-teal-800 hover:underline">
            ← Power of attorney
          </Link>
        }
      />

      <QueryErrorBanner error={sp.error} />

      {!sp.plotId ? (
        <form className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input name="q" placeholder="Search plot, sector, owner…" defaultValue={q} className="max-w-md" />
          <Button type="submit">Search plots</Button>
        </form>
      ) : (
        <p className="mb-4">
          <Link href="/poa/new" className="text-sm text-teal-800 hover:underline">
            ← Choose a different plot
          </Link>
        </p>
      )}

      {!sp.plotId && plots.length > 0 ? (
        <ul className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {plots.map((p) => {
            const o = p.ownerships[0];
            return (
              <li key={p.id}>
                <Link href={`/poa/new?plotId=${p.id}`} className="block rounded-md px-3 py-2 hover:bg-slate-50">
                  <span className="font-medium text-teal-900">
                    {p.sector}/{p.block}-{p.plotNumber}
                  </span>
                  {o ? (
                    <span className="ml-2 text-sm text-slate-600">
                      Principal {o.ownerName} · {o.membershipNumber}
                    </span>
                  ) : (
                    <span className="ml-2 text-sm text-rose-700">No current owner</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!sp.plotId && !q ? (
        <p className="text-sm text-slate-600">Search and select the plot whose owner is the principal.</p>
      ) : null}

      {selectedPlot && owner ? (
        <form
          action={createPowerOfAttorney}
          className="grid max-w-3xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <input type="hidden" name="plotId" value={selectedPlot.id} />
          <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-3 text-sm">
            <p>
              Plot{" "}
              <strong>
                {selectedPlot.sector}/{selectedPlot.block}-{selectedPlot.plotNumber}
              </strong>
            </p>
            <p className="mt-1 text-slate-700">
              Principal (owner / seller): <strong>{owner.ownerName}</strong> · CNIC {owner.cnic} ·{" "}
              {owner.membershipNumber}
            </p>
          </div>

          <PoaCreateFields />

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Remarks</span>
            <textarea
              name="remarks"
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit">Save draft PoA</Button>
            <p className="mt-2 text-xs text-slate-500">
              Next: submit, record Tehsildar verification, Foreign Office if the principal is abroad, then
              present original + scans to society and activate.
            </p>
          </div>
        </form>
      ) : sp.plotId && !selectedPlot ? (
        <p className="text-sm text-rose-700">Plot not found.</p>
      ) : sp.plotId && selectedPlot && !owner ? (
        <p className="text-sm text-rose-700">This plot has no current owner to act as principal.</p>
      ) : null}
    </div>
  );
}
