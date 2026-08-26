import { updateTankerBookingStatus } from "@/app/(app)/tankers/actions";
import { Button } from "@/components/ui/button";
import type { TankerStatus } from "@/generated/prisma/client";

export function DriverStatusActions({
  bookingId,
  status,
  returnTo,
  canEdit,
}: {
  bookingId: string;
  status: TankerStatus;
  returnTo: string;
  canEdit: boolean;
}) {
  if (!canEdit || status === "CANCELLED" || status === "COMPLETED") {
    return null;
  }

  const actions: { label: string; next: TankerStatus; variant?: "default" | "outline" }[] = [];

  if (status === "SCHEDULED" || status === "ASSIGNED") {
    actions.push({ label: "Start delivery", next: "IN_PROGRESS" });
  }
  if (status === "IN_PROGRESS" || status === "ASSIGNED" || status === "SCHEDULED") {
    actions.push({ label: "Mark completed", next: "COMPLETED", variant: "outline" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((action) => (
        <form key={action.next} action={updateTankerBookingStatus}>
          <input type="hidden" name="id" value={bookingId} />
          <input type="hidden" name="status" value={action.next} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" size="sm" variant={action.variant ?? "default"}>
            {action.label}
          </Button>
        </form>
      ))}
    </div>
  );
}
