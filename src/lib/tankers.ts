import { prisma } from "@/lib/db";
import type { Designation, TankerStatus, TankerType } from "@/generated/prisma/client";
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

export type DriverRunSheetDelivery = {
  id: string;
  bookingNumber: string;
  bookerName: string | null;
  bookerContact: string | null;
  plotHouse: string;
  street: string;
  block: string;
  tankerType: TankerType;
  status: TankerStatus;
  charges: number;
  tanker: { id: string; tankerCode: string; capacityLiters: number } | null;
  driver: { id: string; name: string; employeeCode: string } | null;
};

export type DriverRunSheetTankerGroup = {
  tanker: { id: string; tankerCode: string; capacityLiters: number } | null;
  deliveries: DriverRunSheetDelivery[];
};

export type DriverRunSheetSlotGroup = {
  slot: Awaited<ReturnType<typeof listActiveTimeSlots>>[number];
  tankerGroups: DriverRunSheetTankerGroup[];
  deliveryCount: number;
};

function mapDeliveryToRunSheetRow(
  d: {
    id: string;
    bookingNumber: string;
    bookerName: string | null;
    bookerContact: string | null;
    customerName: string | null;
    houseNo: string | null;
    streetNo: string | null;
    streetArea: string | null;
    tankerType: TankerType;
    status: TankerStatus;
    charges: { toString(): string };
    tanker: { id: string; tankerCode: string; capacityLiters: number } | null;
    driver: { id: string; name: string; employeeCode: string } | null;
    plot: { sector: string; block: string | null; plotNumber: string; street: string | null } | null;
  }
): DriverRunSheetDelivery {
  const plotHouse = d.plot
    ? `${d.plot.sector}/${d.plot.block ?? "—"}-${d.plot.plotNumber}`
    : d.houseNo ?? "—";

  const street = d.plot?.street?.trim() || d.streetArea?.trim() || d.streetNo?.trim() || "—";
  const block = d.plot?.block?.trim() || d.streetNo?.trim() || "—";

  return {
    id: d.id,
    bookingNumber: d.bookingNumber,
    bookerName: d.bookerName ?? d.customerName,
    bookerContact: d.bookerContact,
    plotHouse,
    street,
    block,
    tankerType: d.tankerType,
    status: d.status,
    charges: Number(d.charges),
    tanker: d.tanker,
    driver: d.driver,
  };
}

function groupDeliveriesByTanker(
  deliveries: DriverRunSheetDelivery[]
): DriverRunSheetTankerGroup[] {
  const groups = new Map<string, DriverRunSheetTankerGroup>();

  for (const delivery of deliveries) {
    const key = delivery.tanker?.id ?? "__unassigned__";
    const existing = groups.get(key);
    if (existing) {
      existing.deliveries.push(delivery);
      continue;
    }
    groups.set(key, {
      tanker: delivery.tanker,
      deliveries: [delivery],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const codeA = a.tanker?.tankerCode ?? "ZZZ";
    const codeB = b.tanker?.tankerCode ?? "ZZZ";
    return codeA.localeCompare(codeB);
  });
}

export async function getDriverRunSheet(distributionDate: Date, driverId?: string | null) {
  const day = startOfDay(distributionDate);
  const slots = await listActiveTimeSlots();

  const deliveries = await prisma.tankerDelivery.findMany({
    where: {
      distributionDate: day,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      ...(driverId ? { driverId } : {}),
    },
    include: {
      tanker: { select: { id: true, tankerCode: true, capacityLiters: true } },
      driver: { select: { id: true, name: true, employeeCode: true } },
      plot: { select: { sector: true, block: true, plotNumber: true, street: true } },
      timeSlot: true,
    },
    orderBy: [{ timeSlot: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });

  const rows = deliveries.map(mapDeliveryToRunSheetRow);
  const slotted = deliveries.filter((d) => d.timeSlotId);
  const unslotted = deliveries.filter((d) => !d.timeSlotId);

  const slotGroups: DriverRunSheetSlotGroup[] = slots.map((slot) => {
    const slotDeliveries = slotted
      .filter((d) => d.timeSlotId === slot.id)
      .map(mapDeliveryToRunSheetRow);
    return {
      slot,
      tankerGroups: groupDeliveriesByTanker(slotDeliveries),
      deliveryCount: slotDeliveries.length,
    };
  });

  const unslottedGroups = groupDeliveriesByTanker(
    unslotted.map(mapDeliveryToRunSheetRow)
  );

  return {
    day,
    slots: slotGroups,
    unslotted: unslottedGroups,
    totalCount: rows.length,
    deliveries: rows,
  };
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

export type TankerDestinationMode = "plot" | "house";

export function plotDeliveryAddress(plot: {
  sector: string;
  block?: string | null;
  plotNumber: string;
  street?: string | null;
}) {
  const streetArea =
    plot.street?.trim() ||
    [plot.sector, plot.block ? `Block ${plot.block}` : null, `Plot ${plot.plotNumber}`]
      .filter(Boolean)
      .join(" · ");

  return {
    houseNo: plot.plotNumber,
    streetNo: plot.block ?? "",
    streetArea,
  };
}

export async function searchPlotsForTanker(q: string, limit = 20) {
  const query = q.trim();
  if (!query) return [];

  return prisma.plot.findMany({
    where: {
      OR: [
        { plotNumber: { contains: query, mode: "insensitive" } },
        { sector: { contains: query, mode: "insensitive" } },
        { block: { contains: query, mode: "insensitive" } },
        { street: { contains: query, mode: "insensitive" } },
        {
          ownerships: {
            some: {
              status: "ACTIVE",
              OR: [
                { ownerName: { contains: query, mode: "insensitive" } },
                { membershipNumber: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
    },
    take: limit,
    orderBy: [{ sector: "asc" }, { plotNumber: "asc" }],
  });
}

export async function listAllTimeSlots() {
  return prisma.tankerTimeSlot.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function listAllTankers() {
  return prisma.waterTanker.findMany({
    include: { driver: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { tankerCode: "asc" },
  });
}

export async function listDistributionTankers() {
  return prisma.waterTanker.findMany({
    where: { isActive: true, tankerClass: "DISTRIBUTION" },
    include: { driver: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { tankerCode: "asc" },
  });
}

export async function listBulkMotherTankers() {
  return prisma.waterTanker.findMany({
    where: { isActive: true, tankerClass: "BULK" },
    include: { driver: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { tankerCode: "asc" },
  });
}

export function computePurchaseRemaining(volumeLiters: number, filledLiters: number) {
  return Math.max(0, volumeLiters - filledLiters);
}

export async function getPurchaseFilledLiters(purchaseId: string) {
  const agg = await prisma.tankerFill.aggregate({
    where: { purchaseId },
    _sum: { volumeLiters: true },
  });
  return agg._sum.volumeLiters ?? 0;
}

export async function getPurchaseRemainingLiters(purchaseId: string) {
  const purchase = await prisma.tankerBulkPurchase.findUnique({
    where: { id: purchaseId },
    select: { volumeLiters: true },
  });
  if (!purchase) return 0;
  const filled = await getPurchaseFilledLiters(purchaseId);
  return computePurchaseRemaining(purchase.volumeLiters, filled);
}

export async function listBulkPurchasesWithRemaining() {
  const purchases = await prisma.tankerBulkPurchase.findMany({
    include: {
      motherTanker: { select: { id: true, tankerCode: true, capacityLiters: true } },
      createdBy: { select: { id: true, name: true } },
      fills: { select: { volumeLiters: true } },
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });

  return purchases.map((p) => {
    const filledLiters = p.fills.reduce((sum, f) => sum + f.volumeLiters, 0);
    const remainingLiters = computePurchaseRemaining(p.volumeLiters, filledLiters);
    return {
      ...p,
      filledLiters,
      remainingLiters,
    };
  });
}

export async function getTotalBulkStockRemaining() {
  const purchases = await listBulkPurchasesWithRemaining();
  return purchases.reduce((sum, p) => sum + p.remainingLiters, 0);
}

export async function listRecentTankerFills(limit = 20) {
  return prisma.tankerFill.findMany({
    take: limit,
    include: {
      purchase: { select: { id: true, purchaseNumber: true, sourceVendor: true } },
      toTanker: { select: { id: true, tankerCode: true, capacityLiters: true } },
      filledBy: { select: { id: true, name: true } },
    },
    orderBy: { filledAt: "desc" },
  });
}
