import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatTimeSlotLabel, getSlotAvailabilityForDate, getSlotBookingCounts, listActiveTimeSlots } from "@/lib/tankers";
import { parseISO, startOfDay } from "date-fns";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const excludeBookingId = searchParams.get("excludeBookingId") ?? undefined;
  if (!dateParam) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const parsed = parseISO(dateParam);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const slots = await getSlotAvailabilityForDate(startOfDay(parsed));

  if (excludeBookingId) {
    const [activeSlots, counts] = await Promise.all([
      listActiveTimeSlots(),
      getSlotBookingCounts(startOfDay(parsed), excludeBookingId),
    ]);
    const adjusted = activeSlots.map((slot) => {
      const booked = counts.bySlot.get(slot.id) ?? 0;
      const remaining = Math.max(0, slot.maxBookingsPerDay - booked);
      return {
        ...slot,
        booked,
        remaining,
        isFull: remaining <= 0,
      };
    });
    return NextResponse.json({
      slots: adjusted.map((slot) => ({
        id: slot.id,
        label: formatTimeSlotLabel(slot),
        remaining: slot.remaining,
        isFull: slot.isFull,
        maxBookingsPerDay: slot.maxBookingsPerDay,
      })),
    });
  }

  return NextResponse.json({
    slots: slots.map((slot) => ({
      id: slot.id,
      label: formatTimeSlotLabel(slot),
      remaining: slot.remaining,
      isFull: slot.isFull,
      maxBookingsPerDay: slot.maxBookingsPerDay,
    })),
  });
}
