import { prisma } from "@/lib/db";
import type { Designation, TankerType } from "@/generated/prisma/client";
import { startOfDay } from "date-fns";

export const TANKER_TYPE_LABELS: Record<TankerType, string> = {
  CLEAN_WATER: "Clean Water",
  CONSTRUCTION_WATER: "Construction Water",
};

export const TANKER_DRIVER_DESIGNATIONS: Designation[] = ["DRIVER", "TRACTOR_DRIVER"];

export const TANKER_DRIVER_ORG_CODES = ["DRIVER", "TRACTOR_DRIVER"];

export const GARBAGE_COLLECTOR_DESIGNATIONS: Designation[] = ["GARBAGE_COLLECTOR", "SWEEPER"];

export const GARBAGE_COLLECTOR_ORG_CODES = ["GARBAGE_COLLECTOR", "SWEEPER"];

const ACTIVE_BOOKING_STATUSES = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "UNPAID"] as const;

/** Active fee config for a tanker type — used only when creating a booking (price is snapshotted). */
export async function getActiveTankerPrice(tankerType: TankerType) {
  const config = await prisma.feeConfiguration.findFirst({
    where: {
      feeType: "WATER_TANKER",
      tankerType,
      status: "ACTIVE",
      effectiveUntil: null,
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (config) return config;

  return prisma.feeConfiguration.findFirst({
    where: {
      feeType: "WATER_TANKER",
      tankerType: null,
      status: "ACTIVE",
      effectiveUntil: null,
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function getTankerPriceMap() {
  const [clean, construction] = await Promise.all([
    getActiveTankerPrice("CLEAN_WATER"),
    getActiveTankerPrice("CONSTRUCTION_WATER"),
  ]);
  return {
    CLEAN_WATER: clean ? Number(clean.amount) : 0,
    CONSTRUCTION_WATER: construction ? Number(construction.amount) : 0,
  };
}

export async function listActiveTimeSlots() {
  return prisma.tankerTimeSlot.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function formatTimeSlotWindow(startTime: string, endTime: string) {
  return `${startTime}–${endTime}`;
}

export function formatTimeSlotLabel(slot: { label: string; startTime: string; endTime: string }) {
  return `${slot.label} (${formatTimeSlotWindow(slot.startTime, slot.endTime)})`;
}

export async function getSlotBookingCounts(distributionDate: Date, excludeBookingId?: string) {
  const day = startOfDay(distributionDate);
  const bookings = await prisma.tankerDelivery.findMany({
    where: {
      distributionDate: day,
      status: { not: "CANCELLED" },
      timeSlotId: { not: null },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { timeSlotId: true, tankerId: true },
  });

  const bySlot = new Map<string, number>();
  const bySlotTanker = new Map<string, number>();

  for (const b of bookings) {
    if (!b.timeSlotId) continue;
    bySlot.set(b.timeSlotId, (bySlot.get(b.timeSlotId) ?? 0) + 1);
    if (b.tankerId) {
      const key = `${b.timeSlotId}:${b.tankerId}`;
      bySlotTanker.set(key, (bySlotTanker.get(key) ?? 0) + 1);
    }
  }

  return { bySlot, bySlotTanker };
}

export async function assertSlotCapacity(input: {
  distributionDate: Date;
  timeSlotId: string;
  tankerId?: string | null;
  excludeBookingId?: string;
}) {
  const slot = await prisma.tankerTimeSlot.findUnique({ where: { id: input.timeSlotId } });
  if (!slot || !slot.isActive) {
    throw new Error("Selected delivery time slot is not available");
  }

  const day = startOfDay(input.distributionDate);
  const { bySlot, bySlotTanker } = await getSlotBookingCounts(day, input.excludeBookingId);
  const slotCount = bySlot.get(slot.id) ?? 0;

  if (slotCount >= slot.maxBookingsPerDay) {
    throw new Error(
      `${formatTimeSlotLabel(slot)} is fully booked for ${day.toLocaleDateString("en-GB")} (${slot.maxBookingsPerDay} max)`
    );
  }

  if (input.tankerId) {
    const tankerCount = bySlotTanker.get(`${slot.id}:${input.tankerId}`) ?? 0;
    if (tankerCount >= slot.maxPerTanker) {
      throw new Error(
        `This tanker already has ${slot.maxPerTanker} deliveries in ${formatTimeSlotLabel(slot)} on that date`
      );
    }
  }

  return slot;
}

export async function getSlotAvailabilityForDate(distributionDate: Date) {
  const [slots, counts] = await Promise.all([
    listActiveTimeSlots(),
    getSlotBookingCounts(distributionDate),
  ]);

  return slots.map((slot) => {
    const booked = counts.bySlot.get(slot.id) ?? 0;
    const remaining = Math.max(0, slot.maxBookingsPerDay - booked);
    return {
      ...slot,
      booked,
      remaining,
      isFull: remaining <= 0,
    };
  });
}

export async function getDailySchedule(distributionDate: Date) {
  const day = startOfDay(distributionDate);
  const [slots, deliveries] = await Promise.all([
    listActiveTimeSlots(),
    prisma.tankerDelivery.findMany({
      where: {
        distributionDate: day,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
      include: {
        tanker: { select: { id: true, tankerCode: true, capacityLiters: true } },
        driver: { select: { id: true, name: true, employeeCode: true } },
        plot: { select: { id: true, sector: true, block: true, plotNumber: true } },
        timeSlot: true,
      },
      orderBy: [{ timeSlot: { sortOrder: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  const unslotted = deliveries.filter((d) => !d.timeSlotId);
  const bySlot = slots.map((slot) => {
    const slotDeliveries = deliveries.filter((d) => d.timeSlotId === slot.id);
    return {
      slot,
      deliveries: slotDeliveries,
      booked: slotDeliveries.filter((d) => d.status !== "CANCELLED").length,
      remaining: Math.max(0, slot.maxBookingsPerDay - slotDeliveries.filter((d) => d.status !== "CANCELLED").length),
    };
  });

  return { day, slots: bySlot, unslotted };
}

export async function listTankerDrivers() {
  return prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { designation: { in: TANKER_DRIVER_DESIGNATIONS } },
        { orgRole: { code: { in: TANKER_DRIVER_ORG_CODES }, category: "OPERATIONAL" } },
      ],
    },
    include: { orgRole: true },
    orderBy: { name: "asc" },
  });
}

export async function listGarbageCollectors() {
  return prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { designation: { in: GARBAGE_COLLECTOR_DESIGNATIONS } },
        { orgRole: { code: { in: GARBAGE_COLLECTOR_ORG_CODES }, category: "OPERATIONAL" } },
      ],
    },
    include: { orgRole: true },
    orderBy: { name: "asc" },
  });
}

export async function listActiveTankers() {
  return prisma.waterTanker.findMany({
    where: { isActive: true },
    include: { driver: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { tankerCode: "asc" },
  });
}

export function tankerTypeBadgeClass(tankerType: TankerType) {
  return tankerType === "CLEAN_WATER"
    ? "bg-sky-100 text-sky-800 border-sky-200"
    : "bg-orange-100 text-orange-800 border-orange-200";
}
