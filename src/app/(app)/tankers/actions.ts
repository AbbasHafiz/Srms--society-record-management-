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
  const houseNo = (formData.get("houseNo") as string)?.trim() || undefined;
  const streetNo = (formData.get("streetNo") as string)?.trim() || undefined;
  const streetArea = (formData.get("streetArea") as string)?.trim() || undefined;
  const tankerType = formData.get("tankerType") as TankerType;
  const distributionDate = parseDate(formData.get("distributionDate") as string);
  const timeSlotId = (formData.get("timeSlotId") as string)?.trim();
  const tankerId = (formData.get("tankerId") as string)?.trim() || undefined;
  const driverId = (formData.get("driverId") as string)?.trim() || undefined;
  const plotId = (formData.get("plotId") as string)?.trim() || undefined;
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
  redirect(`/tankers/${booking.id}`);
}

export async function updateTankerBooking(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing booking id");

  const existing = await prisma.tankerDelivery.findUnique({ where: { id } });
  if (!existing) throw new Error("Booking not found");

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
      slotLabel: slotSnapshot?.slotLabel,
      slotStartTime: slotSnapshot?.slotStartTime,
      slotEndTime: slotSnapshot?.slotEndTime,
      remarks,
      receiptNumber,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_BOOKING_UPDATED",
    module: "tankers",
    recordId: id,
    plotId: existing.plotId ?? undefined,
    oldValue: {
      status: existing.status,
      paymentStatus: existing.paymentStatus,
      driverId: existing.driverId,
      tankerId: existing.tankerId,
      timeSlotId: existing.timeSlotId,
      distributionDate: existing.distributionDate.toISOString(),
    },
    newValue: {
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      driverId: updated.driverId,
      tankerId: updated.tankerId,
      timeSlotId: updated.timeSlotId,
      distributionDate: updated.distributionDate.toISOString(),
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

export async function updateTankerTimeSlot(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  const maxBookingsPerDay = Number(formData.get("maxBookingsPerDay"));
  const maxPerTanker = Number(formData.get("maxPerTanker"));
  const isActive = formData.get("isActive") === "on";

  if (!id || Number.isNaN(maxBookingsPerDay) || Number.isNaN(maxPerTanker)) {
    throw new Error("Invalid time slot settings");
  }

  await prisma.tankerTimeSlot.update({
    where: { id },
    data: {
      maxBookingsPerDay,
      maxPerTanker,
      isActive,
    },
  });

  revalidatePath("/tankers");
  revalidatePath("/settings");
}
