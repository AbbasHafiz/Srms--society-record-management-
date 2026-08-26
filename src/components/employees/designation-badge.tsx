import { resolveEmployeeRoleDisplay } from "@/lib/hr";
import { cn } from "@/lib/utils";
import type { Designation, OrgRoleCategory } from "@/generated/prisma/client";

type RoleBadgeProps = {
  orgRole?: { name: string; category: OrgRoleCategory; code: string } | null;
  designation?: Designation | null;
};

export function RoleBadge({ orgRole, designation }: RoleBadgeProps) {
  const display = resolveEmployeeRoleDisplay({ orgRole, designation });
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        display.colorClass
      )}
    >
      {display.label}
    </span>
  );
}

/** @deprecated Use RoleBadge — kept for gradual migration */
export function DesignationBadge({ designation }: { designation: Designation | null }) {
  return <RoleBadge designation={designation} />;
}
