"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { nextTankerBookingNumber } from "@/lib/numbering";
import { assertSlotCapacity, getActiveTankerPrice } from "@/lib/tankers";
import type { PaymentStatus, TankerStatus, TankerType } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function parseDestination(formData: FormData) {
  const destinationMode = (formData.get("destinationMode") as string) || "house";
  const plotId = (formData.get("plotId") as string)?.trim() || undefined;
  const houseNo = (formData.get("houseNo") as string)?.trim() || undefined;
  const streetNo = (formData.get("streetNo") as string)?.trim() || undefined;
  const streetArea = (formData.get("streetArea") as string)?.trim() || undefined;

  if (destinationMode === "plot") {
    if (!plotId) throw new Error("Select a society plot for plot bookings");
    return { plotId, houseNo, streetNo, streetArea };
  }

  if (!houseNo || !streetNo || !streetArea) {
    throw new Error("House no., street no., and street/area are required for walk-in bookings");
  }

  return { plotId: undefined, houseNo, streetNo, streetArea };
}

function deriveStatus(input: {
  status?: TankerStatus;
  driverId?: string | null;
  tankerId?: string | null;
}): TankerStatus {
  if (input.status === "CANCELLED" || input.status === "COMPLETED" || input.status === "IN_PROGRESS") {
    return input.status;
  }
  if (input.driverId && input.tankerId) return "ASSIGNED";
  return "SCHEDULED";
}

export async function createTankerBooking(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const bookerName = (formData.get("bookerName") as string)?.trim();
  const bookerContact = (formData.get("bookerContact") as string)?.trim() || undefined;
  const { plotId, houseNo, streetNo, streetArea } = parseDestination(formData);
  const tankerType = formData.get("tankerType") as TankerType;
  const distributionDate = parseDate(formData.get("distributionDate") as string);
  const timeSlotId = (formData.get("timeSlotId") as string)?.trim();
  const tankerId = (formData.get("tankerId") as string)?.trim() || undefined;
  const driverId = (formData.get("driverId") as string)?.trim() || undefined;
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!bookerName || !tankerType || !distributionDate || !timeSlotId) {
    throw new Error("Booker name, tanker type, delivery date, and time slot are required");
  }

  const feeConfig = await getActiveTankerPrice(tankerType);
  if (!feeConfig) {
    throw new Error(`No active fee configured for ${tankerType.replace(/_/g, " ").toLowerCase()}`);
  }

  const slot = await assertSlotCapacity({
    distributionDate,
    timeSlotId,
    tankerId,
  });

  const bookingNumber = await nextTankerBookingNumber();
  const charges = Number(feeConfig.amount);
  const status = deriveStatus({ driverId, tankerId });

  const booking = await prisma.tankerDelivery.create({
    data: {
      bookingNumber,
      tankerType,
      bookerName,
      bookerContact,
      customerName: bookerName,
      houseNo,
      streetNo,
      streetArea,
      distributionDate,
      timeSlotId: slot.id,
      slotLabel: slot.label,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      charges,
      feeConfigId: feeConfig.id,
      tankerId,
      driverId,
      plotId,
      bookedById: session.user.id,
      status,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_BOOKING_CREATED",
    module: "tankers",
    recordId: booking.id,
    plotId: plotId ?? undefined,
    newValue: {
      bookingNumber,
      tankerType,
      bookerName,
      houseNo,
      streetNo,
      distributionDate: distributionDate.toISOString(),
      timeSlotId: slot.id,
      slotLabel: slot.label,
      charges,
      driverId,
      tankerId,
      status,
    },
  });

  revalidatePath("/tankers");
  revalidatePath(`/tankers/${booking.id}`);
  redirect(`/tankers/${booking.id}/slip?new=1`);
}

export async function updateTankerBooking(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing booking id");

  const existing = await prisma.tankerDelivery.findUnique({ where: { id } });
  if (!existing) throw new Error("Booking not found");

  const editingDetails = formData.has("destinationMode") || formData.has("bookerName");

  const bookerName = formData.has("bookerName")
    ? ((formData.get("bookerName") as string)?.trim() || null)
    : existing.bookerName;
  const bookerContact = formData.has("bookerContact")
    ? ((formData.get("bookerContact") as string)?.trim() || null)
    : existing.bookerContact;

  let plotId = existing.plotId;
  let houseNo = existing.houseNo;
  let streetNo = existing.streetNo;
  let streetArea = existing.streetArea;

  if (editingDetails) {
    const destination = parseDestination(formData);
    plotId = destination.plotId ?? null;
    houseNo = destination.houseNo ?? null;
    streetNo = destination.streetNo ?? null;
    streetArea = destination.streetArea ?? null;
  }

  const status = (formData.get("status") as TankerStatus) || existing.status;
  const paymentStatus = (formData.get("paymentStatus") as PaymentStatus) || existing.paymentStatus;
  const driverId = formData.has("driverId")
    ? ((formData.get("driverId") as string)?.trim() || null)
    : existing.driverId;
  const tankerId = formData.has("tankerId")
    ? ((formData.get("tankerId") as string)?.trim() || null)
    : existing.tankerId;
  const timeSlotId = formData.has("timeSlotId")
    ? ((formData.get("timeSlotId") as string)?.trim() || null)
    : existing.timeSlotId;
  const distributionDate = formData.has("distributionDate")
    ? parseDate(formData.get("distributionDate") as string)
    : existing.distributionDate;
  const remarks = formData.has("remarks")
    ? ((formData.get("remarks") as string)?.trim() || null)
    : existing.remarks;
  const receiptNumber = formData.has("receiptNumber")
    ? ((formData.get("receiptNumber") as string)?.trim() || null)
    : existing.receiptNumber;

  let slotSnapshot:
    | { slotLabel: string; slotStartTime: string; slotEndTime: string; timeSlotId: string }
    | undefined;

  const slotChanged =
    timeSlotId !== existing.timeSlotId ||
    distributionDate.getTime() !== existing.distributionDate.getTime() ||
    tankerId !== existing.tankerId;

  if (slotChanged && status !== "CANCELLED" && timeSlotId) {
    const slot = await assertSlotCapacity({
      distributionDate,
      timeSlotId,
      tankerId,
      excludeBookingId: id,
    });
    slotSnapshot = {
      timeSlotId: slot.id,
      slotLabel: slot.label,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
    };
  }

  let nextStatus = status;
  if (status !== "CANCELLED" && status !== "COMPLETED" && status !== "IN_PROGRESS") {
    nextStatus = deriveStatus({ driverId, tankerId });
  }

  const updated = await prisma.tankerDelivery.update({
    where: { id },
    data: {
      status: nextStatus,
      paymentStatus,
      driverId,
      tankerId,
      distributionDate,
      timeSlotId: slotSnapshot?.timeSlotId ?? timeSlotId,
      ...(slotSnapshot
        ? {
            slotLabel: slotSnapshot.slotLabel,
            slotStartTime: slotSnapshot.slotStartTime,
            slotEndTime: slotSnapshot.slotEndTime,
          }
        : {}),
      remarks,
      receiptNumber,
      ...(editingDetails
        ? {
            bookerName,
            bookerContact,
            customerName: bookerName,
            plotId,
            houseNo,
            streetNo,
            streetArea,
          }
        : {}),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_BOOKING_UPDATED",
    module: "tankers",
    recordId: id,
    plotId: updated.plotId ?? undefined,
    oldValue: {
      status: existing.status,
      paymentStatus: existing.paymentStatus,
      driverId: existing.driverId,
      tankerId: existing.tankerId,
      timeSlotId: existing.timeSlotId,
      distributionDate: existing.distributionDate.toISOString(),
      bookerName: existing.bookerName,
      bookerContact: existing.bookerContact,
      plotId: existing.plotId,
      houseNo: existing.houseNo,
      streetNo: existing.streetNo,
      streetArea: existing.streetArea,
    },
    newValue: {
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      driverId: updated.driverId,
      tankerId: updated.tankerId,
      timeSlotId: updated.timeSlotId,
      distributionDate: updated.distributionDate.toISOString(),
      bookerName: updated.bookerName,
      bookerContact: updated.bookerContact,
      plotId: updated.plotId,
      houseNo: updated.houseNo,
      streetNo: updated.streetNo,
      streetArea: updated.streetArea,
    },
  });

  revalidatePath("/tankers");
  revalidatePath(`/tankers/${id}`);
}

export async function updateTankerPriceConfig(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const tankerType = formData.get("tankerType") as TankerType;
  const amount = Number(formData.get("amount"));
  const effectiveFrom = parseDate(formData.get("effectiveFrom") as string);
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!tankerType || !amount || Number.isNaN(effectiveFrom.getTime())) {
    throw new Error("Invalid tanker price configuration");
  }

  const name =
    tankerType === "CLEAN_WATER"
      ? "Clean Water Tanker Delivery"
      : "Construction Water Tanker Delivery";

  await prisma.feeConfiguration.updateMany({
    where: {
      feeType: "WATER_TANKER",
      tankerType,
      status: "ACTIVE",
      effectiveUntil: null,
    },
    data: { effectiveUntil: effectiveFrom, status: "SUPERSEDED" },
  });

  const created = await prisma.feeConfiguration.create({
    data: {
      feeType: "WATER_TANKER",
      tankerType,
      name,
      amount,
      effectiveFrom,
      status: "ACTIVE",
      createdById: session.user.id,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_PRICE_CONFIG_CHANGED",
    module: "settings",
    recordId: created.id,
    newValue: {
      tankerType,
      amount,
      effectiveFrom: effectiveFrom.toISOString(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/tankers");
}

export async function createTankerTimeSlot(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const label = (formData.get("label") as string)?.trim();
  const startTime = (formData.get("startTime") as string)?.trim();
  const endTime = (formData.get("endTime") as string)?.trim();
  const maxBookingsPerDay = Number(formData.get("maxBookingsPerDay") ?? 8);
  const maxPerTanker = Number(formData.get("maxPerTanker") ?? 2);
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!label || !startTime || !endTime) {
    throw new Error("Label, start time, and end time are required");
  }

  const created = await prisma.tankerTimeSlot.create({
    data: {
      label,
      startTime,
      endTime,
      maxBookingsPerDay,
      maxPerTanker,
      sortOrder,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_TIME_SLOT_CREATED",
    module: "tankers",
    recordId: created.id,
    newValue: { label, startTime, endTime, maxBookingsPerDay, maxPerTanker },
  });

  revalidatePath("/tankers/slots");
  revalidatePath("/tankers");
  revalidatePath("/settings");
}

export async function updateTankerTimeSlot(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  const maxBookingsPerDay = Number(formData.get("maxBookingsPerDay"));
  const maxPerTanker = Number(formData.get("maxPerTanker"));
  const isActive = formData.get("isActive") === "on";
  const label = formData.has("label") ? (formData.get("label") as string)?.trim() : undefined;
  const startTime = formData.has("startTime") ? (formData.get("startTime") as string)?.trim() : undefined;
  const endTime = formData.has("endTime") ? (formData.get("endTime") as string)?.trim() : undefined;
  const sortOrder = formData.has("sortOrder") ? Number(formData.get("sortOrder")) : undefined;

  if (!id || Number.isNaN(maxBookingsPerDay) || Number.isNaN(maxPerTanker)) {
    throw new Error("Invalid time slot settings");
  }

  const existing = await prisma.tankerTimeSlot.findUnique({ where: { id } });
  if (!existing) throw new Error("Time slot not found");

  const updated = await prisma.tankerTimeSlot.update({
    where: { id },
    data: {
      maxBookingsPerDay,
      maxPerTanker,
      isActive,
      ...(label ? { label } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(sortOrder !== undefined && !Number.isNaN(sortOrder) ? { sortOrder } : {}),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_TIME_SLOT_UPDATED",
    module: "tankers",
    recordId: id,
    oldValue: {
      label: existing.label,
      startTime: existing.startTime,
      endTime: existing.endTime,
      maxBookingsPerDay: existing.maxBookingsPerDay,
      maxPerTanker: existing.maxPerTanker,
      isActive: existing.isActive,
    },
    newValue: {
      label: updated.label,
      startTime: updated.startTime,
      endTime: updated.endTime,
      maxBookingsPerDay: updated.maxBookingsPerDay,
      maxPerTanker: updated.maxPerTanker,
      isActive: updated.isActive,
    },
  });

  revalidatePath("/tankers/slots");
  revalidatePath("/tankers");
  revalidatePath("/settings");
}

export async function createWaterTanker(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const tankerCode = (formData.get("tankerCode") as string)?.trim();
  const capacityLiters = Number(formData.get("capacityLiters"));
  const driverId = (formData.get("driverId") as string)?.trim() || undefined;
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!tankerCode || !capacityLiters) {
    throw new Error("Tanker code and capacity are required");
  }

  const created = await prisma.waterTanker.create({
    data: {
      tankerCode,
      capacityLiters,
      driverId,
      remarks,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "WATER_TANKER_CREATED",
    module: "tankers",
    recordId: created.id,
    newValue: { tankerCode, capacityLiters, driverId },
  });

  revalidatePath("/tankers/fleet");
  revalidatePath("/tankers");
}

export async function updateWaterTanker(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  const tankerCode = (formData.get("tankerCode") as string)?.trim();
  const capacityLiters = Number(formData.get("capacityLiters"));
  const driverId = formData.has("driverId")
    ? ((formData.get("driverId") as string)?.trim() || null)
    : undefined;
  const remarks = formData.has("remarks")
    ? ((formData.get("remarks") as string)?.trim() || null)
    : undefined;
  const isActive = formData.get("isActive") === "on";

  if (!id || !tankerCode || !capacityLiters) {
    throw new Error("Invalid tanker details");
  }

  const existing = await prisma.waterTanker.findUnique({ where: { id } });
  if (!existing) throw new Error("Tanker not found");

  const updated = await prisma.waterTanker.update({
    where: { id },
    data: {
      tankerCode,
      capacityLiters,
      ...(driverId !== undefined ? { driverId } : {}),
      ...(remarks !== undefined ? { remarks } : {}),
      isActive,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "WATER_TANKER_UPDATED",
    module: "tankers",
    recordId: id,
    oldValue: {
      tankerCode: existing.tankerCode,
      capacityLiters: existing.capacityLiters,
      driverId: existing.driverId,
      isActive: existing.isActive,
    },
    newValue: {
      tankerCode: updated.tankerCode,
      capacityLiters: updated.capacityLiters,
      driverId: updated.driverId,
      isActive: updated.isActive,
    },
  });

  revalidatePath("/tankers/fleet");
  revalidatePath("/tankers");
}
