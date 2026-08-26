"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { canAddFuelLog, canManageFleetRecords } from "@/lib/rbac";
import { nextSequence } from "@/lib/numbering";
import { requireCustomType, requireOtherDetail } from "@/lib/other-specify";
import type { VehicleType, VehicleUsedFor } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export async function createVehicle(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageFleetRecords(session.user.role)) {
    throw new Error("Forbidden");
  }

  const vehicleCode = String(formData.get("vehicleCode") || "").trim();
  const registrationNo = String(formData.get("registrationNo") || "").trim() || null;
  const vehicleType = String(formData.get("vehicleType") || "TRACTOR") as VehicleType;
  const usedFor = String(formData.get("usedFor") || "OTHER") as VehicleUsedFor;
  const customType = requireCustomType(formData, vehicleType, {
    message: "Please specify the vehicle type when Other is selected",
  });
  const otherDetail = requireOtherDetail(formData, usedFor, {
    message: "Please specify usage when Other is selected",
  });
  const driverId = String(formData.get("driverId") || "").trim() || null;
  const waterTankerId = String(formData.get("waterTankerId") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  const code = vehicleCode || (await nextSequence("vehicle", "VEH", 3));

  const vehicle = await prisma.vehicle.create({
    data: {
      vehicleCode: code,
      registrationNo,
      vehicleType,
      customType,
      usedFor,
      otherDetail,
      driverId: driverId ?? undefined,
      remarks,
      ...(waterTankerId
        ? {
            linkedTanker: { connect: { id: waterTankerId } },
          }
        : {}),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "VEHICLE_CREATED",
    module: "vehicles",
    recordId: vehicle.id,
    newValue: { vehicleCode: code, vehicleType, usedFor },
  });

  revalidatePath("/vehicles");
  revalidatePath("/vehicles/fuel");
  redirect(`/vehicles/${vehicle.id}`);
}

export async function addFuelLog(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canAddFuelLog(session.user.role)) {
    throw new Error("Forbidden");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const date = parseDate(String(formData.get("date") || ""));
  const liters = Number(formData.get("liters"));
  const amount = Number(formData.get("amount"));
  const driverId = String(formData.get("driverId") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!vehicleId || !Number.isFinite(liters) || !Number.isFinite(amount)) {
    throw new Error("Vehicle, liters, and amount are required");
  }

  await prisma.fuelLog.create({
    data: {
      vehicleId,
      driverId: driverId ?? undefined,
      date,
      liters,
      amount,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "FUEL_LOG_ADDED",
    module: "vehicles",
    recordId: vehicleId,
    newValue: { date: date.toISOString(), liters, amount },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicles/fuel");
}

export async function addVehicleUsage(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageFleetRecords(session.user.role)) {
    throw new Error("Forbidden");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const date = parseDate(String(formData.get("date") || ""));
  const assignment = String(formData.get("assignment") || "").trim() || null;
  const hoursUsedRaw = String(formData.get("hoursUsed") || "").trim();
  const driverId = String(formData.get("driverId") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const hoursUsed = hoursUsedRaw ? Number(hoursUsedRaw) : null;

  if (!vehicleId) throw new Error("Vehicle is required");

  await prisma.vehicleUsage.create({
    data: {
      vehicleId,
      driverId: driverId ?? undefined,
      date,
      assignment,
      hoursUsed: hoursUsed ?? undefined,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "VEHICLE_USAGE_ADDED",
    module: "vehicles",
    recordId: vehicleId,
    newValue: { date: date.toISOString(), assignment, hoursUsed },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function addMaintenanceLog(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageFleetRecords(session.user.role)) {
    throw new Error("Forbidden");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const date = parseDate(String(formData.get("date") || ""));
  const description = String(formData.get("description") || "").trim();
  const cost = Number(formData.get("cost"));
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!vehicleId || !description || !Number.isFinite(cost)) {
    throw new Error("Vehicle, description, and cost are required");
  }

  await prisma.maintenanceLog.create({
    data: {
      vehicleId,
      date,
      description,
      cost,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "MAINTENANCE_LOG_ADDED",
    module: "vehicles",
    recordId: vehicleId,
    newValue: { date: date.toISOString(), description, cost },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
}
