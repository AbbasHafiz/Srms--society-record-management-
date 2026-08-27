import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WarningBanner } from "@/components/ui/page";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { PlotStatusBadges } from "@/components/plots/plot-status-badges";
import { PlotStaffAssignForm } from "@/components/plots/plot-staff-form";
import { endPlotStaffAssignment } from "@/app/(app)/plots/actions";
import { uploadDocument } from "@/app/(app)/documents/actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { fileDownloadHref } from "@/lib/uploads";
import { getScanPath } from "@/lib/qr";
import { plotTypeLabel, plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import { plotSizeDisplay, NOC_PURPOSE_LABELS } from "@/lib/property-sizes";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatDate, formatDateTime, daysUntil, labelize } from "@/lib/utils";
import { poaKindLabel, poaPurposeLabel, poaStatusLabel } from "@/lib/poa-shared";
import { PlotDcValueForm } from "@/components/tax/plot-dc-value-form";

export const dynamic = "force-dynamic";

const TABS = [
  "overview",
  "staff",
  "owner",
  "history",
  "transfers",
  "documents",
  "possession",
  "noc",
  "nec",
  "mortgage",
  "payments",
  "open-file",
  "poa",
  "physical-file",
  "movements",
  "audit",
] as const;

type Tab = (typeof TABS)[number];

export default async function PlotProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.includes(sp.tab as Tab) ? sp.tab : "overview") as Tab;

  const session = await auth();
  const canEdit = session?.user && hasPermission(session.user.role, "edit");

  const plot = await prisma.plot.findUnique({
    where: { id },
    include: {
      ownerships: { orderBy: { startDate: "asc" } },
      transfers: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: [{ ownershipId: "asc" }, { createdAt: "desc" }] },
      possessions: { orderBy: { applicationDate: "desc" } },
      nocs: { orderBy: { applicationDate: "desc" } },
      necs: { orderBy: { applicationDate: "desc" } },
      mortgages: { orderBy: { createdAt: "desc" } },
      openFiles: { include: { renewals: true }, orderBy: { openingDate: "desc" } },
      powerOfAttorneys: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      taxAssessments: { orderBy: { createdAt: "desc" } },
      plotCharges: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      physicalFile: {
        include: {
          currentLocation: true,
          movements: {
            include: { fromLocation: true, toLocation: true, movedBy: true },
            orderBy: { movedAt: "desc" },
          },
        },
      },
      auditLogs: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      staffAssignments: {
        include: { employee: { include: { orgRole: true } } },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
      },
    },
  });

  if (!plot) notFound();

  const activeEmployees = canEdit
    ? await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ orgRole: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          employeeCode: true,
          orgRole: { select: { name: true } },
          designation: true,
        },
      })
    : [];

  const plotId = plot.id;
  const activeOwner = plot.ownerships.find((o) => o.status === "ACTIVE");
  const activeMortgage = plot.mortgages.find((m) => m.status === "ACTIVE");
  const activeOpenFile = plot.openFiles.find((f) => f.status === "ACTIVE" || f.status === "OPEN");
  const pendingNoc = plot.nocs.find((n) => ["SUBMITTED", "UNDER_REVIEW"].includes(n.status));

  function tabHref(t: Tab) {
    return `/plots/${plotId}?tab=${t}`;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/plots" className="text-sm text-teal-800 hover:underline">
          ← Plot register
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 px-6 py-7 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-200/80">Plot Profile</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight md:text-4xl">
            PLOT #{plot.sector}/{plot.block}-{plot.plotNumber}
          </h1>
          <p className="mt-2 text-sm text-teal-100/90">
            {plot.street || "—"} · {plotSizeDisplay(plot)} · {plotTypeLabel(plot.plotType)}
          </p>
          <div className="mt-3">
            <PlotStatusBadges
              plot={plot}
              className="[&_span]:border-teal-700/30 [&_span]:bg-white/10 [&_span]:text-teal-50"
            />
          </div>
          {session?.user ? (
            <div className="mt-4">
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="plots"
                relatedRecordId={plotId}
                plotId={plotId}
                defaultTemplateKey="custom_message"
                templateVars={{
                  plotLabel: plotLabel(plot),
                  ownerName: activeOwner?.ownerName ?? "",
                  membershipNumber: activeOwner?.membershipNumber ?? "",
                  message: "",
                }}
                presets={
                  activeOwner?.contact
                    ? [
                        {
                          key: "owner",
                          label: "Plot owner",
                          name: activeOwner.ownerName,
                          phone: activeOwner.contact,
                          type: "OWNER",
                        },
                      ]
                    : []
                }
                allowedModes={["preset", "custom"]}
              />
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-teal-200/70">Current Owner</p>
              <p className="text-lg font-semibold">{activeOwner?.ownerName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-teal-200/70">Membership</p>
              <p className="text-lg font-semibold">{activeOwner?.membershipNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-teal-200/70">Status</p>
              <p className="text-lg font-semibold">{labelize(plot.ownershipStatus)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-b border-slate-100 px-6 py-4">
          {activeMortgage ? (
            <WarningBanner>
              Active Bank Mortgage — {activeMortgage.bankName}
              {activeMortgage.loanReference ? ` (${activeMortgage.loanReference})` : ""}. Transfer
              completion is blocked until bank clearance.
            </WarningBanner>
          ) : null}
          {pendingNoc ? (
            <WarningBanner>NOC Pending — Application {pendingNoc.applicationNumber}</WarningBanner>
          ) : null}
          {activeOpenFile ? (
            <WarningBanner>
              Dealer open file {activeOpenFile.openFileNumber} is an open transfer (end purchaser not yet
              named). Expires in {daysUntil(activeOpenFile.expiryDate)} days (
              {formatDate(activeOpenFile.expiryDate)})
            </WarningBanner>
          ) : null}
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
          {TABS.map((t) => (
            <Link
              key={t}
              href={tabHref(t)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                tab === t
                  ? "bg-teal-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {labelize(t)}
            </Link>
          ))}
        </div>

        <div className="p-6">
          {tab === "overview" && (
            <div className="grid gap-6 md:grid-cols-2">
              <InfoBlock title="Plot Master">
                <Row label="Internal Plot ID" value={plot.id} mono />
                <Row label="Sector / Block" value={`${plot.sector} / ${plot.block || "—"}`} />
                <Row label="Property Type" value={plotTypeLabel(plot.plotType)} />
                <Row label="Street" value={plot.street || "—"} />
                <Row label="Size" value={plotSizeDisplay(plot)} />
                <Row label="Development" value={labelize(plot.developmentStatus)} />
                <Row label="Possession" value={labelize(plot.possessionStatus)} />
                <Row label="Annual Charges" value={labelize(plot.annualChargesStatus)} />
                <Row
                  label="DC value"
                  value={plot.dcValue ? formatCurrency(plot.dcValue) : "Not set"}
                />
              </InfoBlock>
              <InfoBlock title="Current Snapshot">
                <Row label="Owner" value={activeOwner?.ownerName || "—"} />
                <Row label="CNIC" value={activeOwner?.cnic || "—"} />
                <Row label="Membership" value={activeOwner?.membershipNumber || "—"} />
                <Row label="Allotment" value={activeOwner?.allotmentNumber || "—"} />
                <Row label="Ownership Since" value={formatDate(activeOwner?.startDate)} />
                <Row
                  label="Physical File"
                  value={
                    plot.physicalFile
                      ? `${plot.physicalFile.fileNumber} @ ${formatLocation(plot.physicalFile.currentLocation)}`
                      : "—"
                  }
                />
              </InfoBlock>
              {canEdit ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <h3 className="font-display mb-2 text-base font-semibold">Deputy Commissioner (DC) value</h3>
                  <PlotDcValueForm
                    plotId={plot.id}
                    currentDcValue={plot.dcValue ? String(plot.dcValue) : null}
                  />
                </div>
              ) : null}
              {plot.taxAssessments.length > 0 ? (
                <div className="md:col-span-2">
                  <h3 className="font-display mb-3 text-lg font-semibold">FBR tax snapshots</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Section</th>
                        <th>Party</th>
                        <th>DC / rate</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plot.taxAssessments.map((a) => (
                        <tr key={a.id}>
                          <td className="font-mono text-sm">{a.assessmentNumber}</td>
                          <td>{a.taxSection === "SECTION_236C" ? "236C seller" : "236K purchaser"}</td>
                          <td>
                            {a.partyName}
                            {a.transferId ? (
                              <>
                                {" "}
                                <Link href={`/transfers/${a.transferId}`} className="text-teal-800 hover:underline">
                                  transfer
                                </Link>
                              </>
                            ) : a.openFileId ? (
                              <>
                                {" "}
                                <Link href={`/open-files/${a.openFileId}`} className="text-teal-800 hover:underline">
                                  open file
                                </Link>
                              </>
                            ) : null}
                          </td>
                          <td>
                            {formatCurrency(a.dcValueSnapshot)} · {String(a.ratePercent)}%
                          </td>
                          <td>{formatCurrency(a.amount)}</td>
                          <td>
                            <Badge status={a.paymentStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="md:col-span-2">
                <h3 className="font-display mb-3 text-lg font-semibold">Ownership Timeline</h3>
                <OwnershipTimeline ownerships={plot.ownerships} />
              </div>
              <div className="md:col-span-2">
                <h3 className="font-display mb-3 text-lg font-semibold">Assigned Staff</h3>
                {plot.staffAssignments.filter((a) => a.status === "ACTIVE").length === 0 ? (
                  <p className="text-sm text-slate-500">No staff currently assigned to this property.</p>
                ) : (
                  <table className="data-table mb-4">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Designation</th>
                        <th>Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plot.staffAssignments
                        .filter((a) => a.status === "ACTIVE")
                        .map((a) => (
                          <tr key={a.id}>
                            <td>
                              <Link
                                href={`/employees/${a.employee.id}`}
                                className="font-medium text-teal-900 hover:underline"
                              >
                                {a.employee.name}
                              </Link>
                              <div className="text-xs text-slate-500">{a.employee.employeeCode}</div>
                            </td>
                            <td>{a.roleLabel || "—"}</td>
                            <td>{a.employee.orgRole?.name ?? (a.employee.designation ? labelize(a.employee.designation) : "—")}</td>
                            <td>{formatDate(a.startDate)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
                <Link href={tabHref("staff")} className="text-sm text-teal-800 hover:underline">
                  View all staff assignments →
                </Link>
              </div>
            </div>
          )}

          {tab === "staff" && (
            <div className="space-y-6">
              {canEdit ? (
                <PlotStaffAssignForm plotId={plot.id} employees={activeEmployees} />
              ) : null}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Designation</th>
                    <th>Period</th>
                    <th>Status</th>
                    {canEdit ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {plot.staffAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 6 : 5} className="text-slate-500">
                        No staff assignments for this property.
                      </td>
                    </tr>
                  ) : (
                    plot.staffAssignments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="font-medium">{a.employee.name}</div>
                          <div className="text-xs text-slate-500">{a.employee.employeeCode}</div>
                        </td>
                        <td>{a.roleLabel || "—"}</td>
                        <td>{a.employee.orgRole?.name ?? (a.employee.designation ? labelize(a.employee.designation) : "—")}</td>
                        <td>
                          {formatDate(a.startDate)}
                          {a.endDate ? ` → ${formatDate(a.endDate)}` : a.status === "ACTIVE" ? " → Current" : ""}
                        </td>
                        <td>
                          <Badge status={a.status} />
                        </td>
                        {canEdit && a.status === "ACTIVE" ? (
                          <td>
                            <form action={endPlotStaffAssignment}>
                              <input type="hidden" name="assignmentId" value={a.id} />
                              <input type="hidden" name="plotId" value={plot.id} />
                              <Button type="submit" variant="outline" size="sm">
                                End
                              </Button>
                            </form>
                          </td>
                        ) : canEdit ? (
                          <td />
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "owner" && activeOwner && (
            <div className="space-y-6">
            <InfoBlock title="Active Owner Record">
              <Row label="Name" value={activeOwner.ownerName} />
              <Row label="CNIC" value={activeOwner.cnic} />
              <Row label="Contact" value={activeOwner.contact || "—"} />
              <Row label="Address" value={activeOwner.address || "—"} />
              <Row label="Membership" value={activeOwner.membershipNumber} />
              <Row label="Allotment" value={activeOwner.allotmentNumber} />
              <Row label="Start" value={formatDate(activeOwner.startDate)} />
              <Row label="Status" value={<Badge status={activeOwner.status} />} />
            </InfoBlock>
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-medium text-slate-900">Powers of attorney</h3>
                {canEdit ? (
                  <Link href={`/poa/new?plotId=${plot.id}`} className="text-sm text-teal-800 hover:underline">
                    Register PoA
                  </Link>
                ) : null}
              </div>
              {plot.powerOfAttorneys.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No PoA on this owner. Register one if the seller is abroad or unwell, or for a special
                  purpose (possession, NOC).
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {plot.powerOfAttorneys.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                      <Link href={`/poa/${p.id}`} className="font-medium text-teal-900 hover:underline">
                        {p.poaNumber}
                      </Link>
                      <span>
                        {p.attorneyName} · {poaKindLabel(p.kind)}
                      </span>
                      <Badge status={p.status}>{poaStatusLabel(p.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              <p className="mb-4 text-sm text-slate-600">
                Complete ownership history is preserved. Transferred memberships remain searchable and
                are never deleted.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Owner</th>
                    <th>Membership</th>
                    <th>Allotment</th>
                    <th>Period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...plot.ownerships].reverse().map((o, i) => (
                    <tr key={o.id}>
                      <td>{plot.ownerships.length - i}</td>
                      <td>
                        <div className="font-medium">{o.ownerName}</div>
                        <div className="text-xs text-slate-500">{o.cnic}</div>
                      </td>
                      <td>{o.membershipNumber}</td>
                      <td>{o.allotmentNumber}</td>
                      <td>
                        {formatDate(o.startDate)} → {o.endDate ? formatDate(o.endDate) : "Current"}
                      </td>
                      <td>
                        <Badge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "transfers" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer ID</th>
                  <th>Type</th>
                  <th>Seller → Purchaser</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {plot.transfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/transfers/${t.id}`} className="font-medium text-teal-900 hover:underline">
                        {t.transferNumber}
                      </Link>
                    </td>
                    <td>{t.transferType?.replace(/_/g, " ") ?? "SALE"}</td>
                    <td>
                      {t.sellerName} → {t.purchaserName || "—"}
                    </td>
                    <td>
                      {t.slaDueAt
                        ? new Date(t.slaDueAt).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td>
                      <Badge status={t.status} />
                    </td>
                    <td>{formatDateTime(t.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "documents" && (
            <div className="space-y-6">
              {activeOwner && canEdit ? (
                <DocumentScansPanel
                  heading="Current Owner Scans"
                  description="Upload CNIC and allotment letter scans for the active owner. New uploads are versioned; prior scans are kept."
                  scans={[
                    {
                      plotId: plot.id,
                      ownershipId: activeOwner.id,
                      documentType: "CNIC",
                      title: `${activeOwner.ownerName} — CNIC`,
                    },
                    {
                      plotId: plot.id,
                      ownershipId: activeOwner.id,
                      documentType: "ALLOTMENT_LETTER",
                      title: `${activeOwner.ownerName} — Allotment Letter`,
                    },
                  ]}
                />
              ) : null}

              {canEdit ? (
                <DocumentUploadForm
                  action={uploadDocument}
                  plotId={plot.id}
                  ownerships={plot.ownerships.map((o) => ({
                    id: o.id,
                    ownerName: o.ownerName,
                    membershipNumber: o.membershipNumber,
                  }))}
                />
              ) : null}

              {plot.ownerships.map((owner) => {
                const docs = plot.documents.filter((d) => d.ownershipId === owner.id);
                return (
                  <div key={owner.id}>
                    <h3 className="font-display mb-2 text-base font-semibold">
                      {owner.ownerName}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        ({owner.membershipNumber}) · <Badge status={owner.status} />
                      </span>
                    </h3>
                    {docs.length === 0 ? (
                      <p className="text-sm text-slate-500">No documents for this ownership.</p>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Number</th>
                            <th>Version</th>
                            <th>Status</th>
                            <th>Scan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docs.map((d) => (
                            <tr key={d.id}>
                              <td>{labelize(d.documentType)}</td>
                              <td>{d.title}</td>
                              <td>{d.documentNumber || "—"}</td>
                              <td>v{d.version}</td>
                              <td>
                                <Badge status={d.status} />
                              </td>
                              <td>
                                <a
                                  href={fileDownloadHref(d.filePath)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-teal-800 hover:underline"
                                >
                                  View
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}

              {plot.documents.filter((d) => !d.ownershipId).length > 0 ? (
                <div>
                  <h3 className="font-display mb-2 text-base font-semibold">Plot-level documents</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Title</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Scan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plot.documents
                        .filter((d) => !d.ownershipId)
                        .map((d) => (
                          <tr key={d.id}>
                            <td>{labelize(d.documentType)}</td>
                            <td>{d.title}</td>
                            <td>v{d.version}</td>
                            <td>
                              <Badge status={d.status} />
                            </td>
                            <td>
                              <a
                                href={fileDownloadHref(d.filePath)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-teal-800 hover:underline"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {tab === "possession" && <SimpleRegister rows={plot.possessions.map((p) => ({
            a: p.applicationNumber,
            b: p.applicantName,
            c: p.letterNumber || "—",
            d: formatDate(p.issueDate),
            s: p.approvalStatus,
          }))} headers={["Application", "Applicant", "Letter", "Issued", "Status"]} />}

          {tab === "noc" && (
            <div className="space-y-4">
              {session?.user && hasPermission(session.user.role, "create") ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/noc/new?plotId=${plot.id}&purpose=CONSTRUCTION`}
                    className="inline-flex h-9 items-center rounded-md bg-teal-800 px-3 text-sm font-medium text-white hover:bg-teal-900"
                  >
                    Apply for construction NOC
                  </Link>
                  <Link
                    href={`/noc/new?plotId=${plot.id}`}
                    className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Other NOC application
                  </Link>
                </div>
              ) : null}
              <p className="text-sm text-slate-600">
                Owner applies to the society for NOC to construct / build on this plot. Plot size:{" "}
                <strong className="text-teal-900">{plotSizeDisplay(plot)}</strong>
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Purpose</th>
                    <th>NOC No</th>
                    <th>Issued</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plot.nocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-slate-500">
                        No NOC records.
                      </td>
                    </tr>
                  ) : (
                    plot.nocs.map((p) => (
                      <tr
                        key={p.id}
                        className={p.purpose === "CONSTRUCTION" ? "bg-teal-50/50" : undefined}
                      >
                        <td>
                          <Link href={`/noc/${p.id}`} className="text-teal-900 hover:underline">
                            {p.applicationNumber}
                          </Link>
                        </td>
                        <td className={p.purpose === "CONSTRUCTION" ? "font-medium text-teal-900" : ""}>
                          {NOC_PURPOSE_LABELS[p.purpose] ?? labelize(p.purpose)}
                        </td>
                        <td>{p.nocNumber || "—"}</td>
                        <td>{formatDate(p.issueDate)}</td>
                        <td>{formatCurrency(p.fee)}</td>
                        <td>
                          <Badge status={p.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "nec" && <SimpleRegister rows={plot.necs.map((p) => ({
            a: p.applicationNumber,
            b: p.necNumber || "—",
            c: formatDate(p.issueDate),
            d: formatCurrency(p.fee),
            s: p.status,
          }))} headers={["Application", "NEC No", "Issued", "Fee", "Status"]} />}

          {tab === "mortgage" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Loan Ref</th>
                  <th>Mortgage Date</th>
                  <th>Release</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plot.mortgages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-slate-500">
                      No bank/mortgage records.
                    </td>
                  </tr>
                ) : (
                  plot.mortgages.map((m) => (
                    <tr key={m.id} className={m.status === "ACTIVE" ? "bg-rose-50" : undefined}>
                      <td className="font-medium">{m.bankName}</td>
                      <td>{m.loanReference || "—"}</td>
                      <td>{formatDate(m.mortgageDate)}</td>
                      <td>{formatDate(m.releaseDate)}</td>
                      <td>
                        <Badge status={m.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>PO</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plot.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.receiptNumber}</td>
                      <td>{labelize(p.feeType)}</td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>{p.poNumber || "—"}</td>
                      <td>
                        <Badge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h3 className="font-display mb-2 text-base font-semibold">
                  Annual Charges (rate snapshots preserved)
                </h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Rate Snapshot</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plot.plotCharges.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.year}
                          {c.month ? `-${String(c.month).padStart(2, "0")}` : ""}
                        </td>
                        <td>{formatCurrency(c.rateSnapshot)}</td>
                        <td>{formatCurrency(c.amount)}</td>
                        <td>
                          <Badge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "open-file" && (
            plot.openFiles.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-600">
                No open files on this plot. An open transfer is a sale to an investor or dealer — end
                purchaser stays empty until a later buyer closes the file.
              </p>
            ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Open File</th>
                  <th>Dealer</th>
                  <th>Period</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plot.openFiles.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/open-files/${f.id}`} className="text-teal-900 hover:underline">
                        {f.openFileNumber}
                      </Link>
                    </td>
                    <td>{f.dealerName}</td>
                    <td>
                      {formatDate(f.openingDate)} → {formatDate(f.expiryDate)}
                    </td>
                    <td>{formatCurrency(f.feeAmount)}</td>
                    <td>
                      <Badge status={f.status}>
                        {f.status === "CLOSED"
                          ? "Closed in purchaser's name"
                          : f.status === "CANCELLED"
                            ? "Cancelled / withdrawn"
                            : f.status === "OPEN" || f.status === "ACTIVE"
                              ? "Open"
                              : f.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )
          )}

          {tab === "poa" && (
            plot.powerOfAttorneys.length === 0 ? (
              <div className="px-5 py-8">
                <p className="text-sm text-slate-600">
                  No power of attorney on this plot. Register one if the owner is abroad or unwell, or
                  for possession / NOC when the owner cannot appear.
                </p>
                {canEdit ? (
                  <Link href={`/poa/new?plotId=${plot.id}`} className="mt-3 inline-block text-sm text-teal-800 hover:underline">
                    Register PoA →
                  </Link>
                ) : null}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PoA</th>
                    <th>Kind</th>
                    <th>Purpose</th>
                    <th>Attorney</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plot.powerOfAttorneys.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/poa/${p.id}`} className="text-teal-900 hover:underline">
                          {p.poaNumber}
                        </Link>
                      </td>
                      <td>{poaKindLabel(p.kind)}</td>
                      <td>{poaPurposeLabel(p.purpose)}</td>
                      <td>{p.attorneyName}</td>
                      <td>
                        <Badge status={p.status}>{poaStatusLabel(p.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === "physical-file" && plot.physicalFile && (
            <div className="space-y-6">
              <InfoBlock title="Physical File">
                <Row label="File No" value={plot.physicalFile.fileNumber} />
                <Row label="Barcode / QR" value={plot.physicalFile.barcode} mono />
                <Row label="Status" value={<Badge status={plot.physicalFile.status} />} />
                <Row label="Condition" value={labelize(plot.physicalFile.condition)} />
                <Row label="Current Location" value={formatLocation(plot.physicalFile.currentLocation)} />
                <div className="pt-2">
                  <Link
                    href={`/physical-files/${plot.physicalFile.id}`}
                    className="text-sm text-teal-800 hover:underline"
                  >
                    Open physical file record →
                  </Link>
                </div>
              </InfoBlock>
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-start sm:gap-6">
                <QrCodeDisplay barcode={plot.physicalFile.barcode} size={180} showUrl={false} />
                <div className="mt-4 text-center sm:mt-0 sm:text-left">
                  <p className="font-mono text-sm text-slate-700">{plot.physicalFile.barcode}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Scan to view owner, pending dues, mortgage, and file status.
                  </p>
                  <Link
                    href={getScanPath(plot.physicalFile.barcode)}
                    className="mt-2 inline-block text-sm font-medium text-teal-800 hover:underline"
                  >
                    Open scan page →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {tab === "movements" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>To</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {(plot.physicalFile?.movements || []).map((m) => (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.movedAt)}</td>
                    <td>{formatLocation(m.fromLocation)}</td>
                    <td>{formatLocation(m.toLocation)}</td>
                    <td>{m.movedBy?.name || "—"}</td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "audit" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                </tr>
              </thead>
              <tbody>
                {plot.auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.createdAt)}</td>
                    <td>{a.user?.name || "System"}</td>
                    <td>{a.action}</td>
                    <td>{a.module}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/transfers/new?plotId=${plot.id}`}
          className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
        >
          Start Sale Transfer
        </Link>
        <Link
          href={`/transfers/death/new?plotId=${plot.id}`}
          className="inline-flex h-10 items-center rounded-md border border-violet-300 bg-violet-50 px-4 text-sm font-medium text-violet-900 hover:bg-violet-100"
        >
          Death / Succession Case
        </Link>
        {session?.user && hasPermission(session.user.role, "create") ? (
          <Link
            href={`/noc/new?plotId=${plot.id}&purpose=CONSTRUCTION`}
            className="inline-flex h-10 items-center rounded-md border border-teal-800 px-4 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            Apply for construction NOC
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function formatLocation(
  loc:
    | {
        building: string;
        room: string;
        almirah: string;
        locker: string;
        shelf: string | null;
        position: string | null;
      }
    | null
    | undefined
) {
  if (!loc) return "—";
  return [loc.building, loc.room, loc.almirah, loc.locker, loc.shelf, loc.position]
    .filter(Boolean)
    .join(" → ");
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="font-display mb-3 text-base font-semibold">{title}</h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 sm:text-right ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function OwnershipTimeline({
  ownerships,
}: {
  ownerships: Array<{
    id: string;
    ownerName: string;
    membershipNumber: string;
    startDate: Date;
    endDate: Date | null;
    status: string;
  }>;
}) {
  return (
    <ol className="relative space-y-4 border-l-2 border-teal-800/30 pl-6">
      {[...ownerships].reverse().map((o) => (
        <li key={o.id} className="relative">
          <span className="absolute -left-[1.91rem] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-800 shadow" />
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{o.ownerName}</p>
              <Badge status={o.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {formatDate(o.startDate)} → {o.endDate ? formatDate(o.endDate) : "Current"} ·{" "}
              {o.membershipNumber}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SimpleRegister({
  rows,
  headers,
}: {
  rows: Array<{ a: string; b: string; c: string; d: string; s: string }>;
  headers: string[];
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="text-slate-500">
              No records.
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i}>
              <td>{r.a}</td>
              <td>{r.b}</td>
              <td>{r.c}</td>
              <td>{r.d}</td>
              <td>
                <Badge status={r.s} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
