import { cn, statusColor, labelize } from "@/lib/utils";

export function Badge({
  children,
  status,
  className,
}: {
  children?: React.ReactNode;
  status?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        status ? statusColor(status) : "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      {children ?? (status ? labelize(status) : null)}
    </span>
  );
}
