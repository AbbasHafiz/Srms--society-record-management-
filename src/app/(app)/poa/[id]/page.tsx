import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { ConfirmOnSubmitForm } from "@/components/ui/confirm-on-submit-form";
import { canRegisterPoa } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/utils";
import { nextPoaAction } from "@/lib/poa";
import {
  foreignOfficeRequired,
  poaKindLabel,
  poaPurposeLabel,
  poaStatusLabel,
  poaStepLabel,
  principalAbsenceLabel,
} from "@/lib/poa-shared";
import {
  activatePowerOfAttorney,
  presentPowerOfAttorneyToSociety,
  recordForeignOfficeVerification,
  recordTehsildarVerification,
  revokePowerOfAttorney,
  submitPowerOfAttorney,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function PoaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const canEdit = session?.user && canRegisterPoa(session.user.role);

  const poa = await prisma.powerOfAttorney.findUnique({
    where: { id },
    include: {
      plot: true,
      ownership: true,
      receivedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      steps: { orderBy: { createdAt: "asc" } },
      openFiles: { select: { id: true, openFileNumber: true, status: true } },
    },
  });
  if (!poa) notFound();

  const next = nextPoaAction(poa);
  const abroad = foreignOfficeRequired(poa);

  return (
    <div>
      <PageHeader
        title={poa.poaNumber}
        description={`${poaKindLabel(poa.kind)} for ${poa.principalName} — attorney ${poa.attorneyName}`}
        actions={
          <Link href="/poa" className="text-sm text-teal-800 hover:underline">
            ← Power of attorney
          </Link>
        }
      />

      <QueryErrorBanner error={sp.error} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge status={poa.status}>{poaStatusLabel(poa.status)}</Badge>
        <Badge status={poa.kind}>{poaKindLabel(poa.kind)}</Badge>
        <span className="text-sm text-slate-600">{poaPurposeLabel(poa.purpose)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Principal and attorney</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Plot</dt>
                <dd>
                  <Link href={`/plots/${poa.plotId}?tab=poa`} className="font-medium text-teal-900 hover:underline">
                    {poa.plot.sector}/{poa.plot.block}-{poa.plot.plotNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Principal (owner / seller)</dt>
                <dd>{poa.principalName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Principal CNIC</dt>
                <dd>{poa.principalCnic}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Membership</dt>
                <dd>{poa.principalMembershipNo ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Why principal cannot appear</dt>
                <dd>
                  {principalAbsenceLabel(poa.principalAbsenceReason)}
                  {poa.principalAbsenceNotes ? ` — ${poa.principalAbsenceNotes}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Attorney</dt>
                <dd>{poa.attorneyName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Attorney CNIC</dt>
                <dd>{poa.attorneyCnic}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Attorney contact</dt>
                <dd>{poa.attorneyContact ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Executed</dt>
                <dd>
                  {formatDate(poa.executedAt)} · {poa.executionPlace ?? "—"}
                  {poa.executionCity ? ` · ${poa.executionCity}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Valid</dt>
                <dd>
                  {formatDate(poa.validFrom)} → {poa.validUntil ? formatDate(poa.validUntil) : "no end date"}
                </dd>
              </div>
              {poa.purposeNotes ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">Purpose notes</dt>
                  <dd>{poa.purposeNotes}</dd>
                </div>
              ) : null}
              {poa.openFiles.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">Linked open files</dt>
                  <dd>
                    {poa.openFiles.map((f) => (
                      <Link key={f.id} href={`/open-files/${f.id}`} className="mr-2 text-teal-900 hover:underline">
                        {f.openFileNumber}
                      </Link>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {canEdit && next === "submit" ? (
            <Card>
              <CardHeader>
                <CardTitle>Submit for verification</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={submitPowerOfAttorney}>
                  <input type="hidden" name="poaId" value={poa.id} />
                  <Button type="submit" className="w-full">
                    Submit
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && next === "tehsildar" ? (
            <Card>
              <CardHeader>
                <CardTitle>Tehsildar / tehsil office</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={recordTehsildarVerification} className="space-y-3">
                  <input type="hidden" name="poaId" value={poa.id} />
                  <div>
                    <Label>Office name</Label>
                    <Input name="tehsildarOfficeName" required className="mt-1" />
                  </div>
                  <div>
                    <Label>Certificate / diary no.</Label>
                    <Input name="tehsildarCertificateNo" required className="mt-1" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      name="tehsildarVerifiedAt"
                      type="date"
                      required
                      className="mt-1"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label>Attestation scan</Label>
                    <Input
                      name="tehsildarScan"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Record Tehsildar verification
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && next === "foreign_office" ? (
            <Card>
              <CardHeader>
                <CardTitle>Foreign Office / Pakistani mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-slate-600">
                  Required because the principal is abroad. Record attestation, then present to society.
                </p>
                <form action={recordForeignOfficeVerification} className="space-y-3">
                  <input type="hidden" name="poaId" value={poa.id} />
                  <div>
                    <Label>Mission / office</Label>
                    <Input name="foreignOfficeMission" required className="mt-1" placeholder="e.g. Embassy of Pakistan, Dubai" />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input name="foreignOfficeCity" className="mt-1" />
                  </div>
                  <div>
                    <Label>Attestation no.</Label>
                    <Input name="foreignOfficeAttestationNo" required className="mt-1" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      name="foreignOfficeVerifiedAt"
                      type="date"
                      required
                      className="mt-1"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label>Attestation scan</Label>
                    <Input
                      name="foreignOfficeScan"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Record foreign office verification
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && next === "present" ? (
            <Card>
              <CardHeader>
                <CardTitle>Present to society</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-slate-600">
                  Attorney brings original + scans. Received by the signed-in officer. Optionally attach
                  plot documents presented with the PoA.
                </p>
                <form action={presentPowerOfAttorneyToSociety} className="space-y-3">
                  <input type="hidden" name="poaId" value={poa.id} />
                  <div>
                    <Label>Presented at</Label>
                    <Input
                      name="presentedAt"
                      type="date"
                      required
                      className="mt-1"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label>Plot documents scan (optional)</Label>
                    <Input
                      name="plotDocumentsScan"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input name="presentationNotes" className="mt-1" />
                  </div>
                  <Button type="submit" className="w-full">
                    Record as received by {session?.user?.name ?? "me"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && next === "activate" ? (
            <Card>
              <CardHeader>
                <CardTitle>Activate</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={activatePowerOfAttorney}>
                  <input type="hidden" name="poaId" value={poa.id} />
                  <Button type="submit" className="w-full">
                    Activate PoA
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && (poa.status === "ACTIVE" || next === "revoke") && poa.status !== "REVOKED" && poa.status !== "EXPIRED" ? (
            <Card>
              <CardHeader>
                <CardTitle>Revoke</CardTitle>
              </CardHeader>
              <CardContent>
                <ConfirmOnSubmitForm
                  action={revokePowerOfAttorney}
                  confirmMessage="Revoke this power of attorney? It cannot be used after this."
                  className="space-y-3"
                >
                  <input type="hidden" name="poaId" value={poa.id} />
                  <div>
                    <Label>Reason</Label>
                    <Input name="revocationReason" required className="mt-1" />
                  </div>
                  <Button type="submit" variant="outline" className="w-full">
                    Revoke
                  </Button>
                </ConfirmOnSubmitForm>
              </CardContent>
            </Card>
          ) : null}

          {poa.receivedBy ? (
            <p className="text-xs text-slate-500">
              Received at society by {poa.receivedBy.name}
              {poa.presentedAt ? ` on ${formatDate(poa.presentedAt)}` : ""}.
            </p>
          ) : null}

          {abroad && poa.status === "TEHSILDAR_VERIFIED" ? (
            <p className="text-xs text-amber-800">
              Foreign office step is required because the principal is abroad.
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Verification chain</h2>
          <p className="text-sm text-slate-600">Immutable steps — each verification is a new row, not a flag.</p>
        </div>
        {poa.steps.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">No verification steps recorded yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {poa.steps.map((s) => (
              <li key={s.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-slate-900">{poaStepLabel(s.stepType)}</p>
                <p className="text-slate-600">
                  {formatDateTime(s.occurredAt)}
                  {s.officeName ? ` · ${s.officeName}` : ""}
                  {s.certificateNo ? ` · ${s.certificateNo}` : ""}
                </p>
                {s.notes ? <p className="text-xs text-slate-500">{s.notes}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8">
        <DocumentScansPanel
          heading="PoA scans"
          description="Instrument, Tehsildar and foreign-office attestations, attorney CNIC, and plot documents presented at society."
          scans={[
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_INSTRUMENT",
              title: "Executed PoA instrument",
            },
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_ATTORNEY_CNIC",
              title: "Attorney CNIC (front)",
              documentNumber: "FRONT",
            },
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_ATTORNEY_CNIC",
              title: "Attorney CNIC (back)",
              documentNumber: "BACK",
            },
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_TEHSILDAR_CERTIFICATE",
              title: "Tehsildar certificate",
            },
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_FOREIGN_OFFICE_ATTESTATION",
              title: "Foreign office attestation",
            },
            {
              plotId: poa.plotId,
              powerOfAttorneyId: poa.id,
              ownershipId: poa.ownershipId ?? undefined,
              documentType: "POA_PLOT_DOCUMENTS",
              title: "Plot documents presented with PoA",
            },
          ]}
        />
      </div>
    </div>
  );
}
