import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { ChargePeriodStatus } from "@/generated/prisma/client";

/** Active annual plot charge fee config at a point in time (never mutates historical snapshots). */
export async function getActiveAnnualFeeConfig(asOf = new Date()) {
  return prisma.feeConfiguration.findFirst({
    where: {
      feeType: "ANNUAL_PLOT_CHARGE",
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: asOf } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

/**
 * Generate monthly plot charges for all plots with active ownership.
 * Snapshots the current fee rate — historical PlotCharge.rateSnapshot is immutable.
 */
export async function generateMonthlyPlotCharges(
  year: number,
  month: number,
  userId?: string
) {
  const feeConfig = await getActiveAnnualFeeConfig();
  if (!feeConfig) throw new Error("No active annual plot charge fee configuration found");

  const rate = Number(feeConfig.amount);
  const dueDate = new Date(year, month - 1, 1);

  const plots = await prisma.plot.findMany({
    where: { ownershipStatus: "ACTIVE" },
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const plot of plots) {
    const owner = plot.ownerships[0];
    if (!owner) {
      skipped++;
      continue;
    }

    const existing = await prisma.plotCharge.findUnique({
      where: { plotId_year_month: { plotId: plot.id, year, month } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.plotCharge.create({
      data: {
        plotId: plot.id,
        ownershipId: owner.id,
        feeConfigId: feeConfig.id,
        year,
        month,
        rateSnapshot: rate,
        amount: rate,
        dueDate,
        status: "BILLED",
      },
    });

    await prisma.plot.update({
      where: { id: plot.id },
      data: { annualChargesStatus: "BILLED" },
    });

    created++;
  }

  if (userId) {
    await writeAuditLog({
      userId,
      action: "ANNUAL_CHARGES_GENERATED",
      module: "annual-charges",
      newValue: { year, month, created, skipped, rateSnapshot: rate },
    });
  }

  return { created, skipped, rate };
}

/** Mark a charge paid without altering rateSnapshot. */
export async function markPlotChargePaid(chargeId: string, userId?: string) {
  const charge = await prisma.plotCharge.findUnique({
    where: { id: chargeId },
    include: { plot: true },
  });
  if (!charge) throw new Error("Charge not found");
  if (charge.status === "PAID") throw new Error("Charge already paid");
  if (charge.status === "WAIVED") throw new Error("Charge was waived");

  const now = new Date();
  const updated = await prisma.plotCharge.update({
    where: { id: chargeId },
    data: { status: "PAID", paidAt: now },
  });

  const pending = await prisma.plotCharge.count({
    where: {
      plotId: charge.plotId,
      status: { in: ["PENDING", "BILLED", "OVERDUE"] },
    },
  });

  await prisma.plot.update({
    where: { id: charge.plotId },
    data: {
      annualChargesStatus: pending > 0 ? "BILLED" : "PAID",
    },
  });

  if (userId) {
    await writeAuditLog({
      userId,
      action: "ANNUAL_CHARGE_PAID",
      module: "annual-charges",
      recordId: chargeId,
      plotId: charge.plotId,
      oldValue: { status: charge.status },
      newValue: { status: "PAID" as ChargePeriodStatus },
    });
  }

  return updated;
}
