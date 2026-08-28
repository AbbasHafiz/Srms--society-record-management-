import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewPlotDues, getPlotDuesLedger } from "@/lib/plot-dues";
import { PrintPageShell } from "@/components/print/print-document";
import { DuesLedgerSlip } from "@/components/plot-status/dues-ledger-slip";

export const dynamic = "force-dynamic";

export default async function PlotStatusPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canViewPlotDues(session.user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const ledger = await getPlotDuesLedger(id);
  if (!ledger) notFound();

  return (
    <PrintPageShell backHref={`/plot-status?q=${encodeURIComponent(ledger.owner?.membershipNumber || id)}`} backLabel="Back to plot status">
      <DuesLedgerSlip ledger={ledger} />
    </PrintPageShell>
  );
}
