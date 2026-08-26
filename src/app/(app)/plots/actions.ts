"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import {
  ALL_DEVELOPMENT_STATUSES,
  ALL_PLOT_TYPES,
  ALL_POSSESSION_STATUSES,
} from "@/lib/plots";
import type {
  DevelopmentStatus,
  PlotType,
  PossessionStatus,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parsePlotForm(formData: FormData) {
  const plotType = String(formData.get("plotType") || "RESIDENTIAL");
  if (!ALL_PLOT_TYPES.includes(plotType as PlotType)) {
    throw new Error("Invalid property type");
  }

  const possessionStatus = String(formData.get("possessionStatus") || "NOT_APPLIED");
  if (!ALL_POSSESSION_STATUSES.includes(possessionStatus as PossessionStatus)) {
    throw new Error("Invalid possession status");
  }

  const developmentStatus = String(formData.get("developmentStatus") || "DEVELOPED");
  if (!ALL_DEVELOPMENT_STATUSES.includes(developmentStatus as DevelopmentStatus)) {
    throw new Error("Invalid development status");
  }

  const sizeMarla = Number(formData.get("sizeMarla") || 0);
  if (!sizeMarla || sizeMarla <= 0) throw new Error("Size (marla) is required");

  const sizeSqYdRaw = String(formData.get("sizeSqYd") || "").trim();
  const sizeSqYd = sizeSqYdRaw ? Number(sizeSqYdRaw) : null;

  return {
    plotNumber: String(formData.get("plotNumber") || "").trim(),
    sector: String(formData.get("sector") || "").trim(),
    block: String(formData.get("block") || "").trim() || null,
    street: String(formData.get("street") || "").trim() || null,
    sizeMarla,
    sizeSqYd,
    plotType: plotType as PlotType,
    possessionStatus: possessionStatus as PossessionStatus,
    developmentStatus: developmentStatus as DevelopmentStatus,
    remarks: String(formData.get("remarks") || "").trim() || null,
  };
}

export async function createPlot(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "create")) throw new Error("Forbidden");

  const data = parsePlotForm(formData);
  if (!data.plotNumber || !data.sector) {
    throw new Error("Plot number and sector are required");
  }

  const existing = await prisma.plot.findFirst({
    where: {
      sector: data.sector,
      block: data.block,
      plotNumber: data.plotNumber,
    },
  });
  if (existing) {
    throw new Error("A plot with this sector/block/number already exists");
  }

  const plot = await prisma.plot.create({ data });

  await writeAuditLog({
    userId: session.user.id,
    action: "PLOT_CREATED",
    module: "plots",
    recordId: plot.id,
    plotId: plot.id,
    newValue: {
      plotNumber: plot.plotNumber,
      sector: plot.sector,
      block: plot.block,
      plotType: plot.plotType,
      possessionStatus: plot.possessionStatus,
      developmentStatus: plot.developmentStatus,
    },
  });

  revalidatePath("/plots");
  redirect(`/plots/${plot.id}`);
}

export async function assignPlotStaff(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  const roleLabel = String(formData.get("roleLabel") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!plotId || !employeeId) throw new Error("Plot and employee are required");

  const [plot, employee] = await Promise.all([
    prisma.plot.findUnique({ where: { id: plotId } }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
  ]);
  if (!plot) throw new Error("Plot not found");
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "ACTIVE") throw new Error("Employee is not active");

  const existing = await prisma.plotStaffAssignment.findFirst({
    where: { plotId, employeeId, status: "ACTIVE" },
  });
  if (existing) throw new Error("This employee is already assigned to this plot");

  const assignment = await prisma.plotStaffAssignment.create({
    data: {
      plotId,
      employeeId,
      roleLabel: roleLabel || undefined,
      remarks: remarks || undefined,
      startDate: new Date(),
      status: "ACTIVE",
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "PLOT_STAFF_ASSIGNED",
    module: "plots",
    recordId: assignment.id,
    plotId,
    newValue: {
      employeeId,
      employeeName: employee.name,
      roleLabel,
      designation: employee.designation,
    },
  });

  revalidatePath(`/plots/${plotId}`);
}

export async function endPlotStaffAssignment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const assignmentId = String(formData.get("assignmentId") || "");
  const plotId = String(formData.get("plotId") || "");

  const assignment = await prisma.plotStaffAssignment.findUnique({
    where: { id: assignmentId },
    include: { employee: true },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.status !== "ACTIVE") throw new Error("Assignment is not active");

  await prisma.plotStaffAssignment.update({
    where: { id: assignmentId },
    data: { status: "ENDED", endDate: new Date() },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "PLOT_STAFF_ENDED",
    module: "plots",
    recordId: assignmentId,
    plotId: plotId || assignment.plotId,
    oldValue: {
      employeeId: assignment.employeeId,
      employeeName: assignment.employee.name,
      roleLabel: assignment.roleLabel,
    },
    newValue: { status: "ENDED" },
  });

  revalidatePath(`/plots/${plotId || assignment.plotId}`);
}
