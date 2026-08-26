import Link from "next/link";
import {
  tankerListHref,
  WATER_TYPE_LIST_SECTIONS,
  type WaterTypeListFilter,
} from "@/lib/tankers";
import { cn } from "@/lib/utils";

export function WaterTypeTabs({
  pathname,
  date,
  driverId,
  active,
  counts,
}: {
  pathname: string;
  date?: string;
  driverId?: string | null;
  active: WaterTypeListFilter;
  counts: { CLEAN_WATER: number; CONSTRUCTION_WATER: number };
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Water type">
      {WATER_TYPE_LIST_SECTIONS.map((section) => {
        const isActive = active === section.tankerType;
        const href = tankerListHref(pathname, {
          date,
          driverId,
          type: isActive ? "all" : section.tankerType,
        });
        return (
          <Link
            key={section.tankerType}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              isActive || active === "all" ? section.tabActiveClass : section.tabIdleClass,
              active === "all" && "shadow-sm"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {section.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                isActive || active === "all" ? "bg-white/20" : "bg-slate-100 text-slate-700"
              )}
            >
              {counts[section.tankerType]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function WaterTypeSection({
  tankerType,
  count,
  children,
  compact = false,
  actions,
}: {
  tankerType: "CLEAN_WATER" | "CONSTRUCTION_WATER";
  count: number;
  children: React.ReactNode;
  compact?: boolean;
  actions?: React.ReactNode;
}) {
  const section = WATER_TYPE_LIST_SECTIONS.find((s) => s.tankerType === tankerType)!;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-white",
        section.sectionClass,
        compact ? "print-water-type-section shadow-none" : "shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-end justify-between gap-2 border-b px-5 py-4",
          section.headerClass,
          compact && "px-0"
        )}
      >
        <div>
          <h2 className="font-display text-lg font-semibold">{section.label}</h2>
          <p className="text-sm opacity-80">
            {count} {count === 1 ? "booking" : "bookings"}
            {compact ? " · time slot, destination, booker" : ""}
          </p>
        </div>
        {actions}
      </div>
      <div className={compact ? "pt-4" : "px-5 py-4"}>{children}</div>
    </section>
  );
}
