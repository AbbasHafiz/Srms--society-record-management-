import type { DevelopmentStatus, PlotType, PossessionStatus } from "@/generated/prisma/client";
import { possessionLabel, isNonPossession } from "@/lib/plot-scan";

export const ALL_PLOT_TYPES: PlotType[] = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "FLAT",
  "SHOP",
  "AMENITY",
  "PARK",
  "MOSQUE",
  "SCHOOL",
  "OTHER",
];

export const ALL_POSSESSION_STATUSES: PossessionStatus[] = [
  "NOT_APPLIED",
  "APPLIED",
  "PENDING",
  "APPROVED",
  "ISSUED",
  "REJECTED",
];

export const ALL_DEVELOPMENT_STATUSES: DevelopmentStatus[] = [
  "DEVELOPED",
  "UNDER_CONSTRUCTION",
  "UNDEVELOPED",
  "VACANT",
];

const PLOT_TYPE_LABELS: Record<PlotType, string> = {
  RESIDENTIAL: "Plot",
  COMMERCIAL: "Commercial",
  FLAT: "Flat",
  SHOP: "Shop",
  AMENITY: "Amenity",
  PARK: "Park",
  MOSQUE: "Masjid",
  SCHOOL: "School",
  OTHER: "Other",
};

export function plotTypeLabel(type: PlotType | string): string {
  return PLOT_TYPE_LABELS[type as PlotType] ?? String(type).replace(/_/g, " ");
}

export function possessionBadgeText(
  possessionStatus: PossessionStatus | string,
  developmentStatus: DevelopmentStatus | string
): string {
  if (developmentStatus === "UNDEVELOPED" || developmentStatus === "VACANT") {
    return developmentStatus === "UNDEVELOPED" ? "Undeveloped" : "Vacant";
  }
  if (possessionStatus === "NOT_APPLIED" || possessionStatus === "REJECTED") {
    return "No Possession";
  }
  if (possessionStatus === "ISSUED") {
    return "Possession Issued";
  }
  return possessionLabel(possessionStatus);
}

export function plotStatusBadges(plot: {
  plotType: PlotType | string;
  possessionStatus: PossessionStatus | string;
  developmentStatus: DevelopmentStatus | string;
}) {
  const badges: Array<{ key: string; label: string; status: string }> = [
    { key: "type", label: plotTypeLabel(plot.plotType), status: "INFO" },
  ];

  if (plot.developmentStatus === "UNDEVELOPED" || plot.developmentStatus === "VACANT") {
    badges.push({
      key: "development",
      label: plot.developmentStatus === "UNDEVELOPED" ? "Undeveloped" : "Vacant",
      status: plot.developmentStatus,
    });
  } else if (plot.developmentStatus === "UNDER_CONSTRUCTION") {
    badges.push({ key: "development", label: "Under Construction", status: "UNDER_CONSTRUCTION" });
  }

  if (isNonPossession(plot.possessionStatus, plot.developmentStatus)) {
    if (plot.possessionStatus !== "ISSUED" || plot.developmentStatus !== "DEVELOPED") {
      badges.push({
        key: "possession",
        label: possessionBadgeText(plot.possessionStatus, plot.developmentStatus),
        status:
          plot.possessionStatus === "NOT_APPLIED" || plot.possessionStatus === "REJECTED"
            ? "NOT_APPLIED"
            : plot.possessionStatus,
      });
    }
  } else {
    badges.push({ key: "possession", label: "Possession Issued", status: "ISSUED" });
  }

  return badges;
}

export function isAmenityPlotType(type: PlotType | string): boolean {
  return ["PARK", "MOSQUE", "SCHOOL", "AMENITY"].includes(type);
}

export function plotLabel(plot: {
  sector: string;
  block?: string | null;
  plotNumber: string;
}): string {
  const block = plot.block ? `${plot.block}-` : "";
  return `${plot.sector}/${block}${plot.plotNumber}`;
}
