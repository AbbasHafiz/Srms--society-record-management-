import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { getSlaStatus } from "@/lib/sla";

export function SlaBadge({
  dueAt,
  completedAt,
  className,
  showDueDate = false,
}: {
  dueAt: Date | string | null | undefined;
  completedAt?: Date | string | null;
  className?: string;
  showDueDate?: boolean;
}) {
  const status = getSlaStatus(dueAt, completedAt);
  if (!status) return null;

  const tone = status.isComplete
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : status.isOverdue
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : status.daysRemaining <= 3
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-sky-100 text-sky-800 border-sky-200";

  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
          tone
        )}
      >
        SLA: {status.label}
      </span>
      {showDueDate ? (
        <span className="text-[10px] text-slate-500">Due {formatDate(status.dueAt)}</span>
      ) : null}
    </span>
  );
}

export function AllotmentSlaBadge({
  dueAt,
  printedAt,
}: {
  dueAt: Date | string | null | undefined;
  printedAt?: Date | string | null;
}) {
  if (printedAt) {
    return <Badge status="ISSUED">Allotment letter printed</Badge>;
  }
  return <SlaBadge dueAt={dueAt} showDueDate />;
}
