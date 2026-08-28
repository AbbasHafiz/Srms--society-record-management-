import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { PRINT_COMPUTER_GENERATED, type SocietyLetterhead } from "@/lib/print-shared";
import { PrintActions } from "@/components/print/print-actions";

export function PrintPageShell({
  backHref,
  backLabel,
  autoPrint,
  paper = "a4",
  children,
}: {
  backHref: string;
  backLabel: string;
  autoPrint?: boolean;
  paper?: "a4" | "a5";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("print-document-page", paper === "a5" && "print-paper-a5")}>
      <PrintActions autoPrint={autoPrint} backHref={backHref} backLabel={backLabel} />
      {paper === "a5" ? (
        <style>{`
          @media print {
            @page { size: A5 portrait; margin: 10mm; }
          }
        `}</style>
      ) : (
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
          }
        `}</style>
      )}
      {children}
    </div>
  );
}

export function PrintLetterhead({
  letterhead,
  title,
  subtitle,
}: {
  letterhead: SocietyLetterhead;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="border-b-2 border-teal-800 pb-4 text-center">
      <p className="font-display text-xl font-semibold tracking-tight text-teal-900">{letterhead.name}</p>
      <p className="mt-1 text-xs text-slate-600">{letterhead.address}</p>
      {letterhead.phone ? <p className="text-xs text-slate-600">{letterhead.phone}</p> : null}
      <h1 className="font-display mt-3 text-lg font-semibold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{subtitle}</p> : null}
    </header>
  );
}

export function PrintMeta({
  serialLabel = "Ref",
  serial,
  date,
  plot,
  parties,
}: {
  serialLabel?: string;
  serial: string;
  date?: Date | string | null;
  plot?: string | null;
  parties?: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="mt-4 grid gap-3 border-b border-slate-200 pb-4 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{serialLabel}</p>
        <p className="font-mono text-lg font-bold tracking-wide text-slate-900">{serial}</p>
      </div>
      <div className="sm:text-right">
        <p className="text-xs uppercase tracking-wide text-slate-500">Date / time</p>
        <p className="font-medium text-slate-900">{formatDateTime(date ?? new Date())}</p>
        {plot ? (
          <>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Plot</p>
            <p className="font-medium text-slate-900">{plot}</p>
          </>
        ) : null}
      </div>
      {parties && parties.length > 0 ? (
        <dl className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
          {parties.map((p) => (
            <div key={p.label}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{p.label}</dt>
              <dd className="font-medium text-slate-900">{p.value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function PrintRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-slate-200 py-2 text-sm last:border-b-0">
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export function PrintSignatures({
  preparedBy,
  receivedBy,
  showStamp = true,
}: {
  preparedBy?: string | null;
  receivedBy?: string | null;
  showStamp?: boolean;
}) {
  return (
    <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-700">
      <div>
        <div className="mb-10 border-b border-slate-400" />
        <p className="font-semibold">Prepared by</p>
        <p className="mt-1">{preparedBy || "Office staff"}</p>
      </div>
      <div>
        <div className="mb-10 border-b border-slate-400" />
        <p className="font-semibold">Received by</p>
        <p className="mt-1">{receivedBy || "Member / payee"}</p>
      </div>
      {showStamp ? (
        <div>
          <div className="mb-10 flex h-16 items-center justify-center rounded-full border border-dashed border-slate-400 text-[10px] uppercase tracking-wide text-slate-400">
            Society stamp
          </div>
          <p className="font-semibold">Society stamp</p>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

export function PrintDisclaimer({ extra }: { extra?: string }) {
  return (
    <footer className="mt-8 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-600">
      {extra ? <p className="mb-1 text-slate-700">{extra}</p> : null}
      <p className="font-medium text-slate-800">{PRINT_COMPUTER_GENERATED}</p>
    </footer>
  );
}

export function PrintDocument({
  letterhead,
  title,
  subtitle,
  serialLabel,
  serial,
  date,
  plot,
  parties,
  children,
  preparedBy,
  receivedBy,
  extraDisclaimer,
  className,
}: {
  letterhead: SocietyLetterhead;
  title: string;
  subtitle?: string;
  serialLabel?: string;
  serial: string;
  date?: Date | string | null;
  plot?: string | null;
  parties?: { label: string; value: React.ReactNode }[];
  children: React.ReactNode;
  preparedBy?: string | null;
  receivedBy?: string | null;
  extraDisclaimer?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "print-document mx-auto max-w-[210mm] rounded-lg border border-slate-300 bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className
      )}
    >
      <PrintLetterhead letterhead={letterhead} title={title} subtitle={subtitle} />
      <PrintMeta
        serialLabel={serialLabel}
        serial={serial}
        date={date}
        plot={plot}
        parties={parties}
      />
      {children}
      <PrintSignatures preparedBy={preparedBy} receivedBy={receivedBy} />
      <PrintDisclaimer extra={extraDisclaimer} />
    </article>
  );
}
