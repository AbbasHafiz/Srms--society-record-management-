import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, labelize } from "@/lib/utils";
import type { NotifyOutboxStatus, NotifyRecipientType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: NotifyOutboxStatus[] = ["DRAFT", "LINK_GENERATED", "SENT", "FAILED"];
const RECIPIENT_TYPES: NotifyRecipientType[] = [
  "OWNER",
  "EMPLOYEE",
  "GUARD",
  "DEALER",
  "BOOKER",
  "HEIR",
  "CUSTOM",
  "OTHER",
];

export default async function WhatsAppOutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as NotifyOutboxStatus | undefined;
  const recipientType = sp.type?.trim() as NotifyRecipientType | undefined;
  const q = sp.q?.trim();

  const where = {
    ...(status && STATUSES.includes(status) ? { status } : {}),
    ...(recipientType && RECIPIENT_TYPES.includes(recipientType) ? { recipientType } : {}),
    ...(q
      ? {
          OR: [
            { recipientName: { contains: q, mode: "insensitive" as const } },
            { recipientPhone: { contains: q } },
            { messageBody: { contains: q, mode: "insensitive" as const } },
            { templateKey: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [messages, statusSummary, total] = await Promise.all([
    prisma.whatsAppOutbox.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        plot: { select: { sector: true, block: true, plotNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.whatsAppOutbox.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.whatsAppOutbox.count({ where }),
  ]);

  const linkCount =
    statusSummary.find((s) => s.status === "LINK_GENERATED")?._count ?? 0;
  const sentCount = statusSummary.find((s) => s.status === "SENT")?._count ?? 0;

  return (
    <div>
      <PageHeader
        title="WhatsApp Outbox"
        description="History of WhatsApp notify attempts — deep links, gateway sends, and failures. Status reflects actual delivery method."
        actions={
          <Link href="/notifications" className="text-sm text-teal-800 hover:underline">
            ← In-app notifications
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total (filtered)" value={total} />
        <StatCard label="Link generated" value={linkCount} tone={linkCount ? "warn" : "default"} />
        <StatCard label="Sent via API" value={sentCount} tone={sentCount ? "default" : "default"} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, phone, message…"
          className="h-10 min-w-[200px] rounded-md border border-slate-300 px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{labelize(s)}</option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={recipientType ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All recipient types</option>
          {RECIPIENT_TYPES.map((t) => (
            <option key={t} value={t}>{labelize(t)}</option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {messages.length === 0 ? (
        <EmptyState
          title="No WhatsApp messages"
          description="Use the WhatsApp button on plot profiles, transfers, tankers, and other pages to generate notify links."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Context</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDateTime(m.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{m.recipientName}</p>
                    <p className="text-xs text-slate-500">{m.recipientPhone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{labelize(m.recipientType)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "SENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : m.status === "FAILED"
                            ? "bg-rose-100 text-rose-800"
                            : m.status === "LINK_GENERATED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {labelize(m.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-slate-700" title={m.messageBody}>
                      {m.messageBody}
                    </p>
                    {m.templateKey ? (
                      <p className="text-xs text-slate-400">{m.templateKey}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {m.plot ? (
                      <Link
                        href={`/plots/${m.plotId}`}
                        className="text-teal-800 hover:underline"
                      >
                        {m.plot.sector}/{m.plot.block}-{m.plot.plotNumber}
                      </Link>
                    ) : null}
                    {m.relatedModule && m.relatedRecordId ? (
                      <p className="mt-0.5">{m.relatedModule}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.createdBy?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.deepLinkUrl ? (
                      <a
                        href={m.deepLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-teal-800 hover:underline"
                      >
                        Open
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
