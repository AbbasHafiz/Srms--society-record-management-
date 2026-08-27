import { prisma } from "@/lib/db";
import type { Prisma, VehicleType } from "@/generated/prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import {
  TANKER_VEHICLE_TYPES,
  VEHICLE_TYPE_OPTIONS,
  VEHICLE_USED_FOR_OPTIONS,
  isTankerVehicleType,
} from "@/lib/vehicles-shared";

export {
  VEHICLE_TYPE_OPTIONS,
  VEHICLE_USED_FOR_OPTIONS,
  TANKER_VEHICLE_TYPES,
  isTankerVehicleType,
} from "@/lib/vehicles-shared";

type FuelReportFilters = {
  from: Date;
  to: Date;
  vehicleType?: VehicleType;
  vehicleId?: string;
  tankerOnly?: boolean;
};

function fuelLogWhere(filters: FuelReportFilters): Prisma.FuelLogWhereInput {
  const dateFilter = { gte: startOfDay(filters.from), lte: endOfDay(filters.to) };
  const vehicleFilter: Prisma.VehicleWhereInput = {};

  if (filters.vehicleId) vehicleFilter.id = filters.vehicleId;
  if (filters.vehicleType) vehicleFilter.vehicleType = filters.vehicleType;
  if (filters.tankerOnly) vehicleFilter.vehicleType = { in: TANKER_VEHICLE_TYPES };

  return {
    date: dateFilter,
    ...(Object.keys(vehicleFilter).length > 0 ? { vehicle: vehicleFilter } : {}),
  };
}

export async function getFuelSpendingSummary(filters: FuelReportFilters) {
  const where = fuelLogWhere(filters);

  const [totals, byVehicle, byType, logs] = await Promise.all([
    prisma.fuelLog.aggregate({
      where,
      _sum: { amount: true, liters: true },
      _count: true,
    }),
    prisma.fuelLog.groupBy({
      by: ["vehicleId"],
      where,
      _sum: { amount: true, liters: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.fuelLog.groupBy({
      by: ["vehicleId"],
      where,
      _sum: { amount: true, liters: true },
      _count: true,
    }).then(async (rows) => {
      const vehicles = await prisma.vehicle.findMany({
        where: { id: { in: rows.map((r) => r.vehicleId) } },
        select: { id: true, vehicleType: true },
      });
      const typeMap = new Map(vehicles.map((v) => [v.id, v.vehicleType]));
      const byTypeAgg = new Map<VehicleType, { amount: number; liters: number; count: number }>();
      for (const row of rows) {
        const type = typeMap.get(row.vehicleId) ?? "OTHER";
        const prev = byTypeAgg.get(type) ?? { amount: 0, liters: 0, count: 0 };
        byTypeAgg.set(type, {
          amount: prev.amount + Number(row._sum.amount ?? 0),
          liters: prev.liters + Number(row._sum.liters ?? 0),
          count: prev.count + row._count,
        });
      }
      return [...byTypeAgg.entries()].sort((a, b) => b[1].amount - a[1].amount);
    }),
    prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: { include: { linkedTanker: true } },
        driver: { select: { id: true, name: true, employeeCode: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  const vehicleIds = byVehicle.map((v) => v.vehicleId);
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    include: { linkedTanker: true, driver: true },
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  return {
    totalAmount: Number(totals._sum.amount ?? 0),
    totalLiters: Number(totals._sum.liters ?? 0),
    logCount: totals._count,
    byVehicle: byVehicle.map((row) => ({
      vehicle: vehicleMap.get(row.vehicleId)!,
      amount: Number(row._sum.amount ?? 0),
      liters: Number(row._sum.liters ?? 0),
      count: row._count,
    })).filter((r) => r.vehicle),
    byType,
    logs,
  };
}

export async function listActiveVehiclesForFuel(tankerOnly = false) {
  return prisma.vehicle.findMany({
    where: {
      isActive: true,
      ...(tankerOnly ? { vehicleType: { in: TANKER_VEHICLE_TYPES } } : {}),
    },
    include: { linkedTanker: true },
    orderBy: { vehicleCode: "asc" },
  });
}

export async function listWaterTankersWithoutVehicle() {
  return prisma.waterTanker.findMany({
    where: { isActive: true, vehicleId: null },
    orderBy: { tankerCode: "asc" },
    select: { id: true, tankerCode: true, capacityLiters: true },
  });
}
