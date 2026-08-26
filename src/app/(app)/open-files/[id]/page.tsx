import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { renewOpenFile } from "@/lib/services";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function renewAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const openFileId = formData.get("openFileId") as string;
  const periods = Number(formData.get("periods") || 1);
  if (!openFileId || periods < 1) throw new Error("Invalid renewal request");

  await renewOpenFile(openFileId, periods, session.user.id);
  revalidatePath(`/open-files/${openFileId}`);
  revalidatePath("/open-files");
  redirect(`/open-files/${openFileId}`);
}

export default async function OpenFileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const openFile = await prisma.openFile.findUnique({
    where: { id },
    include: {
      plot: true,
      ownership: true,
      renewals: { orderBy: { renewalDate: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!openFile) notFound();

  const days = daysUntil(openFile.expiryDate);
  const expiringSoon = openFile.status === "ACTIVE" && days <= 30;

  return (
    <div>
      <PageHeader
        title={openFile.openFileNumber}
        description={`Dealer open file · ${openFile.dealerName}`}
        actions={
          <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
            ← Back to list
          </Link>
        }
      />

      {expiringSoon ? (
        <div className="mb-4">
          <WarningBanner>
            This open file expires in <strong>{days <= 0 ? "0 (overdue)" : days}</strong> day
            {days === 1 ? "" : "s"}. Renew before expiry to maintain dealer registration.
          </WarningBanner>
        </div>
      ) : null}

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
                  <Link href={`/plots/${openFile.plotId}`} className="font-medium text-teal-900 hover:underline">
                    {openFile.plot.sector}/{openFile.plot.block}-{openFile.plot.plotNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Status</dt>
                <dd>
                  <Badge status={openFile.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Seller</dt>
                <dd>{openFile.sellerName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Seller CNIC</dt>
                <dd>{openFile.sellerCnic}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Dealer</dt>
                <dd>{openFile.dealerName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">TRD Number</dt>
                <dd>{openFile.trdNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Opened</dt>
                <dd>{formatDate(openFile.openingDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Expiry</dt>
                <dd>{formatDate(openFile.expiryDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Total Fee</dt>
                <dd>{formatCurrency(openFile.feeAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Payment</dt>
                <dd>
                  <Badge status={openFile.paymentStatus} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {openFile.status === "ACTIVE" ? (
          <Card>
            <CardHeader>
              <CardTitle>Renew Open File</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={renewAction} className="space-y-4">
                <input type="hidden" name="openFileId" value={openFile.id} />
                <div>
                  <Label htmlFor="periods">Periods to renew</Label>
                  <Input
                    id="periods"
                    name="periods"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={1}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Each period extends by the configured open-file fee period (typically 3 months).
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Renew &amp; Create Payment
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {openFile.renewals.length > 0 ? (
        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Renewal History</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Previous Expiry</th>
                <th>New Expiry</th>
                <th>Periods</th>
                <th>Fee</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {openFile.renewals.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.renewalDate)}</td>
                  <td>{formatDate(r.previousExpiry)}</td>
                  <td>{formatDate(r.newExpiry)}</td>
                  <td>{r.periods}</td>
                  <td>{formatCurrency(r.feeAmount)}</td>
                  <td>
                    <Badge status={r.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
