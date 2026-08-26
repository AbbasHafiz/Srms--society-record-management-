import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { getScanPath } from "@/lib/qr";
import { labelize } from "@/lib/utils";
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

export default async function PhysicalFilesPage() {
  const files = await prisma.physicalFile.findMany({
    include: {
      plot: true,
      currentLocation: true,
    },
    orderBy: { fileNumber: "asc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Physical Files"
        description="Plot file custody with locker location hierarchy."
      />

      {files.length === 0 ? (
        <EmptyState title="No physical files" description="Plot files will appear here once registered." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>File Number</th>
                <th>Barcode</th>
                <th>QR</th>
                <th>Plot</th>
                <th>Location</th>
                <th>Status</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link
                      href={`/physical-files/${f.id}`}
                      className="font-semibold text-teal-900 hover:underline"
                    >
                      {f.fileNumber}
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{f.barcode}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <QrCodeDisplay barcode={f.barcode} size={64} showUrl={false} />
                      <Link
                        href={getScanPath(f.barcode)}
                        className="text-xs text-teal-800 hover:underline"
                      >
                        View scan
                      </Link>
                    </div>
                  </td>
                  <td>
                    <Link href={`/plots/${f.plotId}`} className="text-teal-900 hover:underline">
                      {f.plot.sector}/{f.plot.block}-{f.plot.plotNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="text-sm">{formatLocation(f.currentLocation)}</div>
                    {f.currentLocation ? (
                      <div className="text-xs text-slate-500">
                        {f.currentLocation.building} / {f.currentLocation.room} / {f.currentLocation.almirah} /{" "}
                        {f.currentLocation.locker}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <Badge status={f.status} />
                  </td>
                  <td>{labelize(f.condition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
