import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { OfficeRentChargeStatus, OfficePremisesType } from "@/generated/prisma/client";

export function isSocietyLandOffice(premisesType: OfficePremisesType) {
  return premisesType === "SOCIETY_LAND";
}

/** Generate monthly rent charges for society-land offices. Snapshots office rent — never overwrites history. */
export async function generateMonthlyOfficeRentCharges(
  year: number,
  month: number,
  userId?: string
) {
  const offices = await prisma.registeredOffice.findMany({
    where: {
      premisesType: "SOCIETY_LAND",
      status: "ACTIVE",
      rentAmount: { not: null },
    },
  });

  const dueDate = new Date(year, month - 1, 1);
  let created = 0;
  let skipped = 0;

  for (const office of offices) {
    const rate = Number(office.rentAmount);
    if (!rate || rate <= 0) {
      skipped++;
      continue;
    }

    if (office.rentStartDate && office.rentStartDate > dueDate) {
      skipped++;
      continue;
    }

    const existing = await prisma.officeRentCharge.findUnique({
      where: {
        registeredOfficeId_year_month: {
          registeredOfficeId: office.id,
          year,
          month,
        },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.officeRentCharge.create({
      data: {
        registeredOfficeId: office.id,
        year,
        month,
        amountSnapshot: rate,
        amount: rate,
        dueDate,
        status: "PENDING",
      },
    });

    await prisma.registeredOffice.update({
      where: { id: office.id },
      data: { rentStatus: "CURRENT" },
    });

    created++;
  }

  if (userId) {
    await writeAuditLog({
      userId,
      action: "OFFICE_RENT_CHARGES_GENERATED",
      module: "offices",
      newValue: { year, month, created, skipped },
    });
  }

  return { created, skipped };
}

export async function markOfficeRentChargePaid(chargeId: string, userId?: string) {
  const charge = await prisma.officeRentCharge.findUnique({
    where: { id: chargeId },
    include: { registeredOffice: true },
  });
  if (!charge) throw new Error("Rent charge not found");
  if (charge.status === "PAID") throw new Error("Charge already paid");

  const now = new Date();
  const updated = await prisma.officeRentCharge.update({
    where: { id: chargeId },
    data: { status: "PAID", paidAt: now },
  });

  const pending = await prisma.officeRentCharge.count({
    where: {
      registeredOfficeId: charge.registeredOfficeId,
      status: { in: ["PENDING", "OVERDUE"] },
    },
  });

  await prisma.registeredOffice.update({
    where: { id: charge.registeredOfficeId },
    data: { rentStatus: pending > 0 ? "OVERDUE" : "CURRENT" },
  });

  if (userId) {
    await writeAuditLog({
      userId,
      action: "OFFICE_RENT_PAID",
      module: "offices",
      recordId: chargeId,
      oldValue: { status: charge.status },
      newValue: { status: "PAID" as OfficeRentChargeStatus },
    });
  }

  return updated;
}

export async function syncOfficeRentOverdueStatus() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const overdueCharges = await prisma.officeRentCharge.findMany({
    where: {
      status: "PENDING",
      OR: [
        { year: { lt: year } },
        { year, month: { lt: month } },
      ],
    },
    select: { registeredOfficeId: true },
    distinct: ["registeredOfficeId"],
  });

  if (overdueCharges.length === 0) return;

  await prisma.officeRentCharge.updateMany({
    where: {
      status: "PENDING",
      OR: [
        { year: { lt: year } },
        { year, month: { lt: month } },
      ],
    },
    data: { status: "OVERDUE" },
  });

  await prisma.registeredOffice.updateMany({
    where: { id: { in: overdueCharges.map((c) => c.registeredOfficeId) } },
    data: { rentStatus: "OVERDUE" },
  });
}
