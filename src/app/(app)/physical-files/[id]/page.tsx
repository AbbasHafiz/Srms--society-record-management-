import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { movePhysicalFile } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { getScanPath } from "@/lib/qr";
import { formatDateTime, labelize } from "@/lib/utils";
import { PrintButton } from "@/components/print/print-button";
import type { FileLocation } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function formatLocation(loc: FileLocation | null | undefined) {
  if (!loc) return "—";
  const parts = [loc.building, loc.room, loc.almirah, loc.locker];
  if (loc.shelf) parts.push(`Shelf ${loc.shelf}`);
  if (loc.position) parts.push(`Pos ${loc.position}`);
  if (loc.label) parts.push(`(${loc.label})`);
  return parts.join(" › ");
}

async function moveFileAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "move_physical_file")) {
    throw new Error("You do not have permission to move physical files");
  }

  const physicalFileId = formData.get("physicalFileId") as string;
  const toLocationId = formData.get("toLocationId") as string;
  const reason = (formData.get("reason") as string)?.trim();
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!physicalFileId || !toLocationId || !reason) {
    throw new Error("Location and reason are required");
  }

  await movePhysicalFile({
    physicalFileId,
    toLocationId,
    movedById: session.user.id,
    reason,
    remarks,
  });

  revalidatePath(`/physical-files/${physicalFileId}`);
  revalidatePath("/physical-files");
  redirect(`/physical-files/${physicalFileId}`);
}

export default async function PhysicalFileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canMove = session?.user && hasPermission(session.user.role, "move_physical_file");

  const file = await prisma.physicalFile.findUnique({
    where: { id },
    include: {
      plot: true,
      currentLocation: true,
      movements: {
        orderBy: { movedAt: "desc" },
        include: {
          fromLocation: true,
          toLocation: true,
          movedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!file) notFound();

  const locations = canMove
    ? await prisma.fileLocation.findMany({
        where: { isActive: true },
        orderBy: [{ building: "asc" }, { room: "asc" }, { almirah: "asc" }, { locker: "asc" }],
      })
    : [];

  return (
    <div>
      <PageHeader
        title={file.fileNumber}
        description={`Barcode ${file.barcode}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton href={`/physical-files/${file.id}/print`} label="Print movement slip" />
            <Link href="/physical-files" className="text-sm text-teal-800 hover:underline">
              ← Back to list
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>File Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Plot</dt>
                <dd>
                  <Link href={`/plots/${file.plotId}`} className="font-medium text-teal-900 hover:underline">
                    {file.plot.sector}/{file.plot.block}-{file.plot.plotNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Status</dt>
                <dd>
                  <Badge status={file.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Current Location</dt>
                <dd>{formatLocation(file.currentLocation)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Condition</dt>
                <dd>{labelize(file.condition)}</dd>
              </div>
              {file.remarks ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">Remarks</dt>
                  <dd>{file.remarks}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card className="print-qr-panel">
          <CardHeader>
            <CardTitle>Scan QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <QrCodeDisplay barcode={file.barcode} size={180} showUrl={false} />
            <p className="mt-3 font-mono text-sm text-slate-700">{file.barcode}</p>
            <Link href={getScanPath(file.barcode)} className="mt-2 text-sm text-teal-800 hover:underline">
              Open scan page →
            </Link>
          </CardContent>
        </Card>
      </div>

      {canMove ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Move File</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={moveFileAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="physicalFileId" value={file.id} />
              <div className="sm:col-span-2">
                <Label htmlFor="toLocationId">Destination</Label>
                <select
                  id="toLocationId"
                  name="toLocationId"
                  required
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select location…
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {formatLocation(loc)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" name="reason" required className="mt-1" placeholder="Transfer processing, audit…" />
              </div>
              <div>
                <Label htmlFor="remarks">Remarks (optional)</Label>
                <Input id="remarks" name="remarks" className="mt-1" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit">Record Movement</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Movement History</h2>
        </div>
        {file.movements.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No movements recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Moved By</th>
              </tr>
            </thead>
            <tbody>
              {file.movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.movedAt)}</td>
                  <td>{formatLocation(m.fromLocation)}</td>
                  <td>{formatLocation(m.toLocation)}</td>
                  <td>
                    {m.reason}
                    {m.remarks ? <div className="text-xs text-slate-500">{m.remarks}</div> : null}
                  </td>
                  <td>{m.movedBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
