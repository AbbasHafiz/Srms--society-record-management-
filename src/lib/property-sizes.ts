import type { PlotType, PropertySizeUnit } from "@/generated/prisma/client";

export const ALL_SIZE_UNITS: PropertySizeUnit[] = ["SQ_YD", "SQ_FT"];

export function formatPropertySize(option: {
  sizeValue: { toString(): string } | number;
  unit: PropertySizeUnit | string;
  sizeMarla?: { toString(): string } | number | null;
}): string {
  const value = Number(option.sizeValue);
  const unitLabel = option.unit === "SQ_FT" ? "Sq Ft" : "Sq Yd";
  const marla =
    option.sizeMarla != null && Number(option.sizeMarla) > 0
      ? ` (${Number(option.sizeMarla)} Marla)`
      : "";
  return `${value.toLocaleString("en-PK")} ${unitLabel}${marla}`;
}

export function sizeToPlotFields(option: {
  sizeValue: { toString(): string } | number;
  unit: PropertySizeUnit | string;
  sizeMarla?: { toString(): string } | number | null;
}): { sizeMarla: number; sizeSqYd: number | null } {
  const value = Number(option.sizeValue);
  const marla =
    option.sizeMarla != null && Number(option.sizeMarla) > 0
      ? Number(option.sizeMarla)
      : option.unit === "SQ_YD"
        ? Math.round((value / 25) * 100) / 100
        : 0;

  return {
    sizeMarla: marla > 0 ? marla : value > 0 && option.unit === "SQ_YD" ? value / 25 : 1,
    sizeSqYd: option.unit === "SQ_YD" ? value : null,
  };
}

export function plotSizeDisplay(plot: {
  sizeMarla: { toString(): string } | number;
  sizeSqYd?: { toString(): string } | number | null;
  plotType?: PlotType | string;
}): string {
  const marla = Number(plot.sizeMarla);
  const sqYd = plot.sizeSqYd != null ? Number(plot.sizeSqYd) : null;
  if (sqYd) {
    return `${sqYd.toLocaleString("en-PK")} Sq Yd (${marla} Marla)`;
  }
  return `${marla} Marla`;
}

export const NOC_PURPOSE_LABELS: Record<string, string> = {
  CONSTRUCTION: "Construction / Build House",
  TRANSFER: "Transfer",
  GENERAL: "General",
  OTHER: "Other",
};

export const CONSTRUCTION_TYPE_LABELS: Record<string, string> = {
  HOUSE: "House / Residential Building",
  BOUNDARY_WALL: "Boundary Wall",
  EXTENSION: "Extension / Additional Floor",
  COMMERCIAL_BUILDING: "Commercial Building",
  OTHER: "Other",
};
