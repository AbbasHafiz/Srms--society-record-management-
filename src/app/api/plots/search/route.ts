import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plotLabel } from "@/lib/plots";
import { plotDeliveryAddress, searchPlotsForTanker } from "@/lib/tankers";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  const plots = await searchPlotsForTanker(q, limit);

  return NextResponse.json({
    plots: plots.map((plot) => {
      const owner = plot.ownerships[0];
      const address = plotDeliveryAddress(plot);
      return {
        id: plot.id,
        label: plotLabel(plot),
        sector: plot.sector,
        block: plot.block,
        plotNumber: plot.plotNumber,
        street: plot.street,
        ownerName: owner?.ownerName ?? null,
        membershipNumber: owner?.membershipNumber ?? null,
        address,
      };
    }),
  });
}
