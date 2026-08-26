import {
  EMPLOYMENT_TYPES,
  CONTRACTOR_TRADES,
  employmentTypeBadgeColor,
} from "@/lib/hr";
import { cn, labelize } from "@/lib/utils";
import type { EmploymentType } from "@/generated/prisma/client";

export function EmploymentTypeBadge({ type }: { type: EmploymentType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        employmentTypeBadgeColor(type)
      )}
    >
      {labelize(type)}
    </span>
  );
}

export { CONTRACTOR_TRADES, EMPLOYMENT_TYPES };
