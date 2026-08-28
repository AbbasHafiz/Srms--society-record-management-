import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatFileLocation, getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatDateTime, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function PhysicalFilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [file, letterhead] = await Promise.all([
    prisma.physicalFile.findUnique({
      where: { id },
      include: {
        plot: true,
        currentLocation: true,
        movements: {
          orderBy: { movedAt: "desc" },
          take: 15,
          include: {
            fromLocation: true,
            toLocation: true,
            movedBy: { select: { name: true } },
            transfer: { select: { transferNumber: true } },
          },
        },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!file) notFound();

  const lastMove = file.movements[0];

  return (
    <PrintPageShell backHref={`/physical-files/${file.id}`} backLabel="Back to file">
      <PrintDocument
        letterhead={letterhead}
        title="Physical File Movement Slip"
        subtitle={`${labelize(file.status)} · ${labelize(file.condition)}`}
        serialLabel="File no."
        serial={file.fileNumber}
        date={lastMove?.movedAt ?? file.updatedAt}
        plot={plotLabel(file.plot)}
        parties={[
          { label: "Barcode", value: file.barcode },
          { label: "Current location", value: formatFileLocation(file.currentLocation) },
        ]}
        preparedBy={lastMove?.movedBy?.name || "Records"}
        receivedBy="File desk"
      >
        <PrintSection title="File">
          <dl>
            <PrintRow label="Status" value={labelize(file.status)} />
            <PrintRow label="Condition" value={labelize(file.condition)} />
            <PrintRow label="Location" value={formatFileLocation(file.currentLocation)} />
            {file.remarks ? <PrintRow label="Remarks" value={file.remarks} /> : null}
          </dl>
        </PrintSection>
        <PrintSection title="Movement history">
          {file.movements.length === 0 ? (
            <p className="text-sm text-slate-700">No movements recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">When</th>
                  <th className="py-1">From</th>
                  <th className="py-1">To</th>
                  <th className="py-1">Reason</th>
                  <th className="py-1">By</th>
                </tr>
              </thead>
              <tbody>
                {file.movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5">{formatDateTime(m.movedAt)}</td>
                    <td className="py-1.5">{formatFileLocation(m.fromLocation)}</td>
                    <td className="py-1.5">{formatFileLocation(m.toLocation)}</td>
                    <td className="py-1.5">
                      {m.reason}
                      {m.transfer ? ` · ${m.transfer.transferNumber}` : ""}
                    </td>
                    <td className="py-1.5">{m.movedBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PrintSection>
      </PrintDocument>
    </PrintPageShell>
  );
}
