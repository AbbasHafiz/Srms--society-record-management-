import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { releaseMortgage } from "../actions";
import { ConfirmOnSubmitForm, QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { fileDownloadHref } from "@/lib/uploads";
import { hasPermission } from "@/lib/rbac";
import { formatDate, labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MortgageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const canRelease =
    session?.user &&
    (hasPermission(session.user.role, "approve") || hasPermission(session.user.role, "edit"));

  const mortgage = await prisma.mortgage.findUnique({
    where: { id },
    include: {
      plot: true,
      ownership: true,
      documents: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!mortgage) notFound();

  const canReleaseNow = canRelease && ["PENDING", "ACTIVE"].includes(mortgage.status);

  return (
    <div>
      <div className="mb-4">
        <Link href="/mortgages" className="text-sm text-teal-800 hover:underline">
          ← Mortgage register
        </Link>
      </div>

      <PageHeader
        title={mortgage.bankName}
        description={`Mortgage on plot ${mortgage.plot.sector}/${mortgage.plot.block}-${mortgage.plot.plotNumber}`}
        actions={<Badge status={mortgage.status === "ACTIVE" ? "ACTIVE_MORTGAGE" : mortgage.status} />}
      />

      {mortgage.status === "ACTIVE" ? (
        <div className="mb-4">
          <WarningBanner>
            Active mortgage — plot transfers are blocked until bank clearance / release is recorded.
          </WarningBanner>
        </div>
      ) : null}

      <QueryErrorBanner error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Mortgage details</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Bank" value={mortgage.bankName} />
            <Row label="Loan reference" value={mortgage.loanReference ?? "—"} />
            <Row label="Mortgage date" value={formatDate(mortgage.mortgageDate)} />
            <Row label="Release date" value={formatDate(mortgage.releaseDate)} />
            <Row
              label="Plot"
              value={
                <Link href={`/plots/${mortgage.plotId}?tab=mortgage`} className="text-teal-900 hover:underline">
                  {mortgage.plot.sector}/{mortgage.plot.block}-{mortgage.plot.plotNumber}
                </Link>
              }
            />
            <Row label="Owner" value={mortgage.ownership?.ownerName ?? "—"} />
            {mortgage.remarks ? <Row label="Remarks" value={mortgage.remarks} /> : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Documents</h2>
          {mortgage.documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents attached.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {mortgage.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2">
                  <span>
                    {labelize(d.documentType)} — {d.title}
                  </span>
                  <a href={fileDownloadHref(d.filePath)} className="text-teal-800 hover:underline" target="_blank" rel="noreferrer">
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canReleaseNow ? (
          <section className="rounded-xl border border-teal-100 bg-teal-50/40 p-5 shadow-sm lg:col-span-2">
            <h2 className="font-display mb-4 text-lg font-semibold text-teal-950">Release mortgage</h2>
            <ConfirmOnSubmitForm
              action={releaseMortgage}
              confirmMessage={`Record release of mortgage with ${mortgage.bankName}? Plot transfers will be unblocked once no active mortgages remain.`}
              className="max-w-lg space-y-3"
            >
              <input type="hidden" name="mortgageId" value={mortgage.id} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Release date</label>
                <Input name="releaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Bank release letter / NOC (optional)
                </label>
                <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                <textarea name="remarks" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
              <Button type="submit">Record release</Button>
            </ConfirmOnSubmitForm>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}
