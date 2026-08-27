import type { VehicleType } from "@/generated/prisma/client";

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "MOTORCYCLE", label: "Motorcycle / motorbike" },
  { value: "CAR", label: "Car" },
  { value: "RICKSHAW", label: "Rickshaw / Qingqi" },
  { value: "STAFF_PICKUP", label: "Staff pickup" },
  { value: "PICKUP_TRUCK", label: "Pickup / truck" },
  { value: "VAN", label: "Van" },
  { value: "TOYOTA_HIACE", label: "Toyota HiAce" },
  { value: "COASTER", label: "Coaster" },
  { value: "BUS", label: "Bus" },
  { value: "AMBULANCE", label: "Ambulance" },
  { value: "TRACTOR", label: "Tractor" },
  { value: "LOADER", label: "Loader" },
  { value: "EXCAVATOR", label: "Excavator" },
  { value: "WATER_TANKER_VEHICLE", label: "Water tanker / bowser" },
  { value: "OTHER", label: "Other" },
];

export const VEHICLE_TYPE_GROUPS: {
  label: string;
  options: { value: VehicleType; label: string }[];
}[] = [
  {
    label: "Passenger & light vehicles",
    options: VEHICLE_TYPE_OPTIONS.filter((o) =>
      (
        [
          "MOTORCYCLE",
          "CAR",
          "RICKSHAW",
          "STAFF_PICKUP",
          "PICKUP_TRUCK",
          "VAN",
          "TOYOTA_HIACE",
          "COASTER",
          "BUS",
          "AMBULANCE",
        ] as VehicleType[]
      ).includes(o.value)
    ),
  },
  {
    label: "Plant & works",
    options: VEHICLE_TYPE_OPTIONS.filter((o) =>
      (["TRACTOR", "LOADER", "EXCAVATOR", "WATER_TANKER_VEHICLE"] as VehicleType[]).includes(o.value)
    ),
  },
  {
    label: "Other",
    options: VEHICLE_TYPE_OPTIONS.filter((o) => o.value === "OTHER"),
  },
];

export const VEHICLE_USED_FOR_OPTIONS = [
  { value: "STAFF_PICKUP", label: "Staff pickup" },
  { value: "TANKER", label: "Tanker / water delivery" },
  { value: "TRACTOR_WORK", label: "Tractor / works" },
  { value: "OTHER", label: "Other" },
] as const;

export const TANKER_VEHICLE_TYPES: VehicleType[] = ["WATER_TANKER_VEHICLE"];

const VEHICLE_TYPE_LABELS = new Map(VEHICLE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function isTankerVehicleType(type: VehicleType) {
  return TANKER_VEHICLE_TYPES.includes(type);
}

export function isVehicleType(value: string): value is VehicleType {
  return VEHICLE_TYPE_LABELS.has(value as VehicleType);
}

export function vehicleTypeLabel(type: VehicleType, customType?: string | null) {
  const base = VEHICLE_TYPE_LABELS.get(type) ?? type.replace(/_/g, " ");
  return customType ? `${base} (${customType})` : base;
}
