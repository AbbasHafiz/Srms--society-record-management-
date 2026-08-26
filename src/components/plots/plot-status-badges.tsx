import { Badge } from "@/components/ui/badge";
import { plotStatusBadges } from "@/lib/plots";
import type { DevelopmentStatus, PlotType, PossessionStatus } from "@/generated/prisma/client";

export function PlotStatusBadges({
  plot,
  className,
}: {
  plot: {
    plotType: PlotType | string;
    possessionStatus: PossessionStatus | string;
    developmentStatus: DevelopmentStatus | string;
  };
  className?: string;
}) {
  const badges = plotStatusBadges(plot);

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {badges.map((b) => (
        <Badge key={b.key} status={b.status}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}
