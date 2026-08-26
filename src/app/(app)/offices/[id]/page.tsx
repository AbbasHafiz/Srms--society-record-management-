import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { isSocietyLandOffice } from "@/lib/offices";
import { fileDownloadHref } from "@/lib/uploads";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deactivateRegisteredOffice,
  reactivateRegisteredOffice,
  uploadOfficeLetterhead,
  generateOfficeRentChargesAction,
  markOfficeRentPaidAction,
} from "../actions";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { ScanUpload } from "@/components/documents/scan-upload";

export const dynamic = "force-dynamic";

export default async function OfficeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canEdit = session?.user && (hasPermission(session.user.role, "edit") || hasPermission(session.user.role, "create"));
  const canUpload = session?.user && hasPermission(session.user.role, "upload_document");
  const canFinance = session?.user && hasPermission(session.user.role, "verify_payment");

  const office = await prisma.registeredOffice.findUnique({
    where: { id },
    include: {
      plot: true,
      rentCharges: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 },
      openFiles: {
        orderBy: { openingDate: "desc" },
        take: 10,
        include: { plot: { select: { sector: true, block: true, plotNumber: true } } },
      },
      documents: {
        where: { documentType: "DEALER_LETTERHEAD", status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!office) notFound();

  const societyLand = isSocietyLandOffice(office.premisesType);
  const inactive = office.status !== "ACTIVE";
  const now = new Date();

  return (
    <div>
      <div className="mb-4">
        <Link href="/offices" className="text-sm text-teal-800 hover:underline">
          ← Property offices
        </Link>
      </div>

      <PageHeader
        title={office.officeName}
        description={`${office.ownerName} · ${office.phone}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={office.premisesType} />
            <Badge status={office.status} />
            {societyLand && office.rentStatus ? <Badge status={office.rentStatus} /> : null}
            {canEdit ? (
              <Link href={`/offices/${office.id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {inactive ? (
        <div className="mb-4">
          <WarningBanner>
            This office is <strong>{labelize(office.status)}</strong>. Historical open-file and rent records are preserved.
          </WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Office details</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Owner" value={office.ownerName} />
            <Row label="Phone" value={office.phone} />
            <Row label="Email" value={office.email ?? "—"} />
            <Row label="Address" value={office.address ?? "—"} />
            <Row label="Premises" value={labelize(office.premisesType)} />
            {office.plot ? (
              <Row
                label="Linked plot"
                value={
                  <Link href={`/plots/${office.plotId}`} className="text-teal-900 hover:underline">
                    {office.plot.sector}/{office.plot.block}-{office.plot.plotNumber}
                  </Link>
                }
              />
            ) : null}
            {societyLand ? (
              <>
                <Row label="Monthly rent" value={office.rentAmount ? formatCurrency(office.rentAmount) : "—"} />
                <Row label="Rent start" value={formatDate(office.rentStartDate)} />
              </>
            ) : (
              <>
                <Row label="License" value={office.licenseNumber ?? "—"} />
                <Row label="Registration" value={formatDate(office.registrationDate)} />
                <Row label="License expiry" value={formatDate(office.expiryDate)} />
              </>
            )}
            {office.remarks ? <Row label="Remarks" value={office.remarks} /> : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Letterhead scan</h2>
          {office.letterheadFilePath ? (
            <p className="mb-3 text-sm">
              <a
                href={fileDownloadHref(office.letterheadFilePath)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal-800 hover:underline"
              >
                View letterhead scan
              </a>
            </p>
          ) : office.documents.length > 0 ? (
            <ul className="mb-3 space-y-2 text-sm">
              {office.documents.map((d) => (
                <li key={d.id}>
                  <a href={fileDownloadHref(d.filePath)} target="_blank" rel="noreferrer" className="text-teal-800 hover:underline">
                    {d.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-slate-500">No letterhead uploaded yet.</p>
          )}

          {canUpload ? (
            <form action={uploadOfficeLetterhead} encType="multipart/form-data" className="space-y-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="officeId" value={office.id} />
              <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" />
              <Button type="submit" size="sm" variant="outline">Upload letterhead</Button>
            </form>
          ) : null}

          {office.plotId ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ScanUpload
                plotId={office.plotId}
                registeredOfficeId={office.id}
                documentType="DEALER_LETTERHEAD"
                title="Plot-linked letterhead versions"
                compact
              />
            </div>
          ) : null}
        </section>

        {societyLand ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Rent charges</h2>
              {canFinance ? (
                <form action={generateOfficeRentChargesAction} className="flex items-center gap-2">
                  <input type="hidden" name="year" value={now.getFullYear()} />
                  <input type="hidden" name="month" value={now.getMonth() + 1} />
                  <Button type="submit" size="sm" variant="outline">
                    Generate {labelize(`${now.getFullYear()}-${now.getMonth() + 1}`)} charges
                  </Button>
                </form>
              ) : null}
            </div>
            {office.rentCharges.length === 0 ? (
              <p className="text-sm text-slate-500">No rent charges recorded yet.</p>
            ) : (
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {office.rentCharges.map((charge) => (
                    <tr key={charge.id}>
                      <td>{charge.year}-{String(charge.month).padStart(2, "0")}</td>
                      <td>{formatCurrency(charge.amount)}</td>
                      <td>{formatDate(charge.dueDate)}</td>
                      <td><Badge status={charge.status} /></td>
                      <td>
                        {canFinance && charge.status !== "PAID" ? (
                          <form action={markOfficeRentPaidAction}>
                            <input type="hidden" name="chargeId" value={charge.id} />
                            <Button type="submit" size="sm" variant="outline">Mark paid</Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display mb-4 text-lg font-semibold">Open file history</h2>
          {office.openFiles.length === 0 ? (
            <p className="text-sm text-slate-500">No open files linked to this office.</p>
          ) : (
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th>Open file</th>
                  <th>Plot</th>
                  <th>Opened</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {office.openFiles.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/open-files/${f.id}`} className="text-teal-900 hover:underline">
                        {f.openFileNumber}
                      </Link>
                    </td>
                    <td>
                      {f.plot.sector}/{f.plot.block}-{f.plot.plotNumber}
                    </td>
                    <td>{formatDate(f.openingDate)}</td>
                    <td>{formatDate(f.expiryDate)}</td>
                    <td><Badge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {canEdit ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="font-display mb-4 text-lg font-semibold">Status</h2>
            {office.status === "ACTIVE" ? (
              <form action={deactivateRegisteredOffice} className="max-w-lg space-y-3">
                <input type="hidden" name="id" value={office.id} />
                <p className="text-sm text-slate-600">
                  Deactivate suspends the office for new open files. Rent and open-file history is never deleted.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Reason (optional)</label>
                  <textarea name="reason" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                </div>
                <Button type="submit" variant="outline">Deactivate office</Button>
              </form>
            ) : office.status === "SUSPENDED" ? (
              <form action={reactivateRegisteredOffice}>
                <input type="hidden" name="id" value={office.id} />
                <p className="mb-3 text-sm text-slate-600">Reactivate to allow new open-file assignments.</p>
                <Button type="submit">Reactivate office</Button>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                Office status is {labelize(office.status)}. Edit registration details to update license expiry.
              </p>
            )}
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
