import { designationBadgeColor } from "@/lib/hr";
import { cn, labelize } from "@/lib/utils";
import type { Designation } from "@/generated/prisma/client";

export function DesignationBadge({ designation }: { designation: Designation }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        designationBadgeColor(designation)
      )}
    >
      {labelize(designation)}
    </span>
  );
}
