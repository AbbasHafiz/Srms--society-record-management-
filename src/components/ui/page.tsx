import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "success";
}) {
  const tones = {
    default: "from-teal-900/5 to-transparent",
    warn: "from-amber-500/10 to-transparent",
    danger: "from-rose-500/10 to-transparent",
    success: "from-emerald-500/10 to-transparent",
  };
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-gradient-to-br p-4 shadow-sm",
        tones[tone]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span className="mt-0.5 font-bold">⚠</span>
      <div>{children}</div>
    </div>
  );
}
