import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canManageMaintenance,
  canViewMaintenance,
  getMaintenanceWork,
  MAINTENANCE_PAYMENT_STATUSES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPE_SUGGESTIONS,
} from "@/lib/maintenance";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { fileDownloadHref } from "@/lib/uploads";
import { MaintenanceEditForm } from "@/components/maintenance/maintenance-edit-form";
import {
  cancelMaintenanceWork,
  postMaintenanceToFinanceAction,
  uploadMaintenanceScan,
} from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !canViewMaintenance(session.user.role)) {
    return (
      <div>
        <PageHeader title="Maintenance job" description="You do not have access." />
      </div>
    );
  }

  const work = await getMaintenanceWork(id);
  if (!work) notFound();

  const canManage = canManageMaintenance(session.user.role);
  const editable = canManage && work.status !== "CANCELLED";
  const employees = editable
    ? await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, employeeCode: true },
        orderBy: { name: "asc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <Link href="/maintenance" className="text-sm text-teal-800 hover:underline">
        ← Maintenance jobs
      </Link>

      <PageHeader
        title={labelize(work.workType)}
        description={work.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge status={work.status} />
            <Badge status={work.paymentStatus} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Job details</h2>
          <div className="mt-3">
            <Row label="Date" value={formatDate(work.workDate)} />
            <Row label="Type" value={labelize(work.workType)} />
            <Row label="Location" value={work.location ?? "—"} />
            <Row label="Cost" value={formatCurrency(work.cost)} />
            <Row label="Contractor" value={work.contractorName ?? "—"} />
            <Row
              label="Assigned employee"
              value={
                work.employee ? `${work.employee.name} (${work.employee.employeeCode})` : "—"
              }
            />
            <Row label="Remarks" value={work.remarks ?? "—"} />
            <Row label="Recorded by" value={work.createdBy?.name ?? "—"} />
            {work.financeTransaction ? (
              <Row
                label="Finance ledger"
                value={
                  <Link href="/finance" className="text-teal-800 hover:underline">
                    {work.financeTransaction.txnNumber}
                  </Link>
                }
              />
            ) : null}
          </div>

          {work.scanFilePath ? (
            <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Document scan</p>
              <a
                href={fileDownloadHref(work.scanFilePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-teal-800 hover:underline"
              >
                View scan
              </a>
            </div>
          ) : null}

          {canManage && !work.scanFilePath ? (
            <form action={uploadMaintenanceScan} encType="multipart/form-data" className="mt-4 space-y-2 border-t pt-4">
              <input type="hidden" name="id" value={work.id} />
              <Label className="text-xs text-slate-500">Upload document scan</Label>
              <Input name="scan" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />
              <Button type="submit" size="sm" variant="outline">
                Upload scan
              </Button>
            </form>
          ) : null}
        </section>

        <div className="space-y-6">
          {editable ? (
            <MaintenanceEditForm
              work={{
                id: work.id,
                workDate: work.workDate.toISOString().slice(0, 10),
                workType: work.workType,
                description: work.description,
                location: work.location,
                contractorName: work.contractorName,
                employeeId: work.employeeId,
                cost: Number(work.cost),
                status: work.status,
                paymentStatus: work.paymentStatus,
                remarks: work.remarks,
              }}
              employees={employees}
              typeSuggestions={[...MAINTENANCE_TYPE_SUGGESTIONS]}
              statuses={MAINTENANCE_STATUSES}
              paymentStatuses={MAINTENANCE_PAYMENT_STATUSES}
            />
          ) : null}

          {canManage && !work.financeTransactionId && work.status !== "CANCELLED" ? (
            <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Post to finance</h2>
              <p className="mt-1 text-sm text-slate-600">
                Link this job to the Repair &amp; maintenance expense category in the ledger.
              </p>
              <form action={postMaintenanceToFinanceAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={work.id} />
                <label className="block text-sm">
                  <Label>Payment method</Label>
                  <select name="paymentMethod" defaultValue="CASH" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="PO">PO</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <Button type="submit">Post to ledger</Button>
              </form>
            </section>
          ) : null}

          {canManage && work.status !== "CANCELLED" ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Cancel job</h2>
              <p className="mt-1 text-sm text-slate-600">
                Jobs are never deleted — cancelled records remain in history.
              </p>
              <form action={cancelMaintenanceWork} className="mt-4">
                <input type="hidden" name="id" value={work.id} />
                <Button type="submit" variant="outline" className="text-rose-800">
                  Cancel job
                </Button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
