import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();

  if (!q) {
    return (
      <div>
        <PageHeader
          title="Global Search"
          description="Search plots, ownerships, transfers, open files, NOC, and NEC records."
        />
        <form className="max-w-xl">
          <Input name="q" placeholder="Plot number, CNIC, membership, transfer #, NOC/NEC…" autoFocus />
          <Button type="submit" className="mt-3">
            Search
          </Button>
        </form>
      </div>
    );
  }

  const [plots, ownerships, transfers, openFiles, nocs, necs] = await Promise.all([
    prisma.plot.findMany({
      where: {
        OR: [
          { plotNumber: { contains: q, mode: "insensitive" } },
          { sector: { contains: q, mode: "insensitive" } },
          { street: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { plotNumber: "asc" },
    }),
    prisma.ownership.findMany({
      where: {
        OR: [
          { ownerName: { contains: q, mode: "insensitive" } },
          { membershipNumber: { contains: q, mode: "insensitive" } },
          { cnic: { contains: q } },
        ],
      },
      include: { plot: true },
      take: 10,
    }),
    prisma.transfer.findMany({
      where: {
        OR: [
          { transferNumber: { contains: q, mode: "insensitive" } },
          { trdNumber: { contains: q, mode: "insensitive" } },
          { sellerCnic: { contains: q } },
          { purchaserCnic: { contains: q } },
        ],
      },
      include: { plot: true },
      take: 10,
    }),
    prisma.openFile.findMany({
      where: {
        OR: [
          { openFileNumber: { contains: q, mode: "insensitive" } },
          { sellerCnic: { contains: q } },
          { dealerName: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { plot: true },
      take: 10,
    }),
    prisma.noc.findMany({
      where: {
        OR: [
          { applicationNumber: { contains: q, mode: "insensitive" } },
          { nocNumber: { contains: q, mode: "insensitive" } },
          { applicantName: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { plot: true },
      take: 10,
    }),
    prisma.nec.findMany({
      where: {
        OR: [
          { applicationNumber: { contains: q, mode: "insensitive" } },
          { necNumber: { contains: q, mode: "insensitive" } },
          { applicantName: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { plot: true },
      take: 10,
    }),
  ]);

  const total = plots.length + ownerships.length + transfers.length + openFiles.length + nocs.length + necs.length;

  return (
    <div>
      <PageHeader
        title="Global Search"
        description={total > 0 ? `${total} result(s) for "${q}"` : `No results for "${q}"`}
      />

      <form className="mb-6 max-w-xl">
        <Input name="q" placeholder="Search…" defaultValue={q} />
        <Button type="submit" className="mt-3">
          Search
        </Button>
      </form>

      {total === 0 ? (
        <EmptyState title="No matches" description="Try a different search term or fewer characters." />
      ) : (
        <div className="space-y-8">
          {plots.length > 0 ? (
            <SearchSection title="Plots">
              {plots.map((p) => (
                <SearchRow
                  key={p.id}
                  href={`/plots/${p.id}`}
                  primary={`${p.sector}/${p.block}-${p.plotNumber}`}
                  secondary={p.street ?? labelize(p.plotType)}
                  badge={p.ownershipStatus}
                />
              ))}
            </SearchSection>
          ) : null}

          {ownerships.length > 0 ? (
            <SearchSection title="Ownerships">
              {ownerships.map((o) => (
                <SearchRow
                  key={o.id}
                  href={`/plots/${o.plotId}`}
                  primary={o.ownerName}
                  secondary={`${o.membershipNumber} · ${o.plot.sector}/${o.plot.block}-${o.plot.plotNumber}`}
                  badge={o.status}
                />
              ))}
            </SearchSection>
          ) : null}

          {transfers.length > 0 ? (
            <SearchSection title="Transfers">
              {transfers.map((t) => (
                <SearchRow
                  key={t.id}
                  href={`/transfers/${t.id}`}
                  primary={t.transferNumber}
                  secondary={`${t.plot.sector}/${t.plot.block}-${t.plot.plotNumber} · ${t.sellerName}`}
                  badge={t.status}
                />
              ))}
            </SearchSection>
          ) : null}

          {openFiles.length > 0 ? (
            <SearchSection title="Open Files">
              {openFiles.map((f) => (
                <SearchRow
                  key={f.id}
                  href={`/open-files/${f.id}`}
                  primary={f.openFileNumber}
                  secondary={`${f.plot.sector}/${f.plot.block}-${f.plot.plotNumber} · ${f.dealerName}`}
                  badge={f.status}
                />
              ))}
            </SearchSection>
          ) : null}

          {nocs.length > 0 ? (
            <SearchSection title="NOC">
              {nocs.map((n) => (
                <SearchRow
                  key={n.id}
                  href="/noc"
                  primary={n.nocNumber ?? n.applicationNumber}
                  secondary={`${n.applicantName} · ${n.plot.sector}/${n.plot.block}-${n.plot.plotNumber}`}
                  badge={n.status}
                />
              ))}
            </SearchSection>
          ) : null}

          {necs.length > 0 ? (
            <SearchSection title="NEC">
              {necs.map((n) => (
                <SearchRow
                  key={n.id}
                  href="/nec"
                  primary={n.necNumber ?? n.applicationNumber}
                  secondary={`${n.applicantName} · ${n.plot.sector}/${n.plot.block}-${n.plot.plotNumber}`}
                  badge={n.status}
                />
              ))}
            </SearchSection>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      </div>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function SearchRow({
  href,
  primary,
  secondary,
  badge,
}: {
  href: string;
  primary: string;
  secondary: string;
  badge: string;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
        <div>
          <p className="font-medium text-teal-900">{primary}</p>
          <p className="text-sm text-slate-500">{secondary}</p>
        </div>
        <Badge status={badge} />
      </Link>
    </li>
  );
}
