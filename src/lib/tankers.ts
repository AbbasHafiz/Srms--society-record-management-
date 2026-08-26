import { prisma } from "@/lib/db";
import type { Designation, TankerStatus, TankerType } from "@/generated/prisma/client";
import { parseISO, startOfDay } from "date-fns";

export const TANKER_TYPE_LABELS: Record<TankerType, string> = {
  CLEAN_WATER: "Clean Water",
  CONSTRUCTION_WATER: "Construction Water",
};

export const WATER_TYPE_LIST_SECTIONS = [
  {
    tankerType: "CLEAN_WATER" as const,
    slug: "clean",
    label: "Clean water",
    tabActiveClass: "bg-sky-800 text-white border-sky-800",
    tabIdleClass: "border-sky-200 bg-white text-sky-900 hover:bg-sky-50",
    sectionClass: "border-sky-200",
    headerClass: "border-sky-100 bg-sky-50 text-sky-950",
  },
  {
    tankerType: "CONSTRUCTION_WATER" as const,
    slug: "construction",
    label: "Construction water",
    tabActiveClass: "bg-orange-800 text-white border-orange-800",
    tabIdleClass: "border-orange-200 bg-white text-orange-950 hover:bg-orange-50",
    sectionClass: "border-orange-200",
    headerClass: "border-orange-100 bg-orange-50 text-orange-950",
  },
] as const;

export type WaterTypeListFilter = "all" | TankerType;

export function parseTankerScheduleDate(value?: string | null) {
  if (!value) return startOfDay(new Date());
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

export function parseWaterTypeListFilter(value?: string | null): WaterTypeListFilter {
  if (!value) return "all";
  const v = value.trim().toLowerCase();
  if (v === "clean" || v === "clean_water") return "CLEAN_WATER";
  if (v === "construction" || v === "construction_water") return "CONSTRUCTION_WATER";
  if (value === "CLEAN_WATER" || value === "CONSTRUCTION_WATER") return value;
  return "all";
}

export function waterTypeSlug(type: WaterTypeListFilter): string | undefined {
  if (type === "all") return undefined;
  return type === "CLEAN_WATER" ? "clean" : "construction";
}

export function tankerListHref(
  path: string,
  opts: { date?: string; type?: WaterTypeListFilter | string | null; driverId?: string | null } = {}
) {
  const sp = new URLSearchParams();
  if (opts.date) sp.set("date", opts.date);
  const typeFilter: WaterTypeListFilter =
    opts.type === "CLEAN_WATER" || opts.type === "CONSTRUCTION_WATER" || opts.type === "all"
      ? opts.type
      : parseWaterTypeListFilter(opts.type);
  const slug = waterTypeSlug(typeFilter);
  if (slug) sp.set("type", slug);
  if (opts.driverId && opts.driverId !== "all") sp.set("driverId", opts.driverId);
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}

export function visibleWaterTypeSections(filter: WaterTypeListFilter) {
  if (filter === "all") return [...WATER_TYPE_LIST_SECTIONS];
  return WATER_TYPE_LIST_SECTIONS.filter((s) => s.tankerType === filter);
}

export function tankerDestinationLabel(d: {
  plot?: { sector: string; block: string | null; plotNumber: string; street?: string | null } | null;
  houseNo?: string | null;
  streetNo?: string | null;
  streetArea?: string | null;
}) {
  if (d.plot) {
    const plot = `${d.plot.sector}/${d.plot.block ?? "—"}-${d.plot.plotNumber}`;
    const street = d.plot.street?.trim();
    return street ? `${plot} · ${street}` : plot;
  }
  const parts = [d.houseNo, d.streetNo, d.streetArea].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function tankerBookerLabel(d: { bookerName?: string | null; customerName?: string | null }) {
  return d.bookerName?.trim() || d.customerName?.trim() || "—";
}

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
        plot: { select: { id: true, sector: true, block: true, plotNumber: true, street: true } },
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

export type DailySchedule = Awaited<ReturnType<typeof getDailySchedule>>;
export type DriverRunSheet = Awaited<ReturnType<typeof getDriverRunSheet>>;

export function filterDailyScheduleByTankerType(
  schedule: DailySchedule,
  tankerType: TankerType
): DailySchedule {
  return {
    ...schedule,
    slots: schedule.slots.map((group) => {
      const deliveries = group.deliveries.filter((d) => d.tankerType === tankerType);
      return {
        ...group,
        deliveries,
        booked: deliveries.length,
      };
    }),
    unslotted: schedule.unslotted.filter((d) => d.tankerType === tankerType),
  };
}

export function filterRunSheetByTankerType(sheet: DriverRunSheet, tankerType: TankerType): DriverRunSheet {
  const filterGroups = (groups: DriverRunSheetTankerGroup[]) =>
    groups
      .map((g) => ({
        ...g,
        deliveries: g.deliveries.filter((d) => d.tankerType === tankerType),
      }))
      .filter((g) => g.deliveries.length > 0);

  const slots = sheet.slots.map((s) => {
    const tankerGroups = filterGroups(s.tankerGroups);
    return {
      ...s,
      tankerGroups,
      deliveryCount: tankerGroups.reduce((n, g) => n + g.deliveries.length, 0),
    };
  });
  const deliveries = sheet.deliveries.filter((d) => d.tankerType === tankerType);
  return {
    ...sheet,
    slots,
    unslotted: filterGroups(sheet.unslotted),
    deliveries,
    totalCount: deliveries.length,
  };
}

export function flattenDailyScheduleDeliveries(schedule: DailySchedule) {
  return [...schedule.slots.flatMap((s) => s.deliveries), ...schedule.unslotted];
}

export function waterTypeStatsFromDeliveries(
  deliveries: Array<{
    tankerType: TankerType;
    status: string;
    paymentStatus: string;
    charges: { toString(): string } | number;
  }>
) {
  const forType = (tankerType: TankerType) => {
    const rows = deliveries.filter((d) => d.tankerType === tankerType);
    return {
      total: rows.length,
      scheduled: rows.filter(
        (d) => d.status === "SCHEDULED" || d.status === "ASSIGNED" || d.status === "IN_PROGRESS"
      ).length,
      completed: rows.filter((d) => d.status === "COMPLETED").length,
      collection: rows
        .filter((d) => d.paymentStatus === "PAID" || d.paymentStatus === "VERIFIED")
        .reduce((sum, d) => sum + Number(d.charges), 0),
    };
  };

  return {
    CLEAN_WATER: forType("CLEAN_WATER"),
    CONSTRUCTION_WATER: forType("CONSTRUCTION_WATER"),
  };
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
