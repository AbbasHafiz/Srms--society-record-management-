import type { VehicleType } from "@/generated/prisma/client";

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "STAFF_PICKUP", label: "Staff pickup" },
  { value: "VAN", label: "Van" },
  { value: "BUS", label: "Bus" },
  { value: "TRACTOR", label: "Tractor" },
  { value: "LOADER", label: "Loader" },
  { value: "WATER_TANKER_VEHICLE", label: "Water tanker vehicle" },
  { value: "OTHER", label: "Other" },
];

export const VEHICLE_USED_FOR_OPTIONS = [
  { value: "STAFF_PICKUP", label: "Staff pickup" },
  { value: "TANKER", label: "Tanker / water delivery" },
  { value: "TRACTOR_WORK", label: "Tractor / works" },
  { value: "OTHER", label: "Other" },
] as const;

export const TANKER_VEHICLE_TYPES: VehicleType[] = ["WATER_TANKER_VEHICLE"];

export function isTankerVehicleType(type: VehicleType) {
  return TANKER_VEHICLE_TYPES.includes(type);
}
