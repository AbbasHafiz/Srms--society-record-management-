import type { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_PLOT_DUES_HEADS } from "../src/lib/plot-dues-shared";

const DEMO_MEMBERSHIP = "21363(i)";
const DEMO_CNIC = "35202-2136321-3";
const DEMO_BARCODE = "PF-E16-3-15C";

export async function seedPlotDuesCatalog(prisma: PrismaClient) {
  for (const head of DEFAULT_PLOT_DUES_HEADS) {
    await prisma.plotDuesHead.upsert({
      where: { code: head.code },
      create: {
        code: head.code,
        name: head.name,
        sortOrder: head.sortOrder,
        showUptoDate: head.showUptoDate ?? false,
        showInDeposited: head.showInDeposited ?? true,
        showInOutstanding: head.showInOutstanding ?? true,
        isExtraFee: head.isExtraFee ?? false,
      },
      update: {
        name: head.name,
        sortOrder: head.sortOrder,
        showUptoDate: head.showUptoDate ?? false,
        showInDeposited: head.showInDeposited ?? true,
        showInOutstanding: head.showInOutstanding ?? true,
        isExtraFee: head.isExtraFee ?? false,
        isActive: true,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "society_ntn" },
    create: { key: "society_ntn", value: "3557812-2", label: "Society NTN" },
    update: { value: "3557812-2", label: "Society NTN" },
  });
  await prisma.systemSetting.upsert({
    where: { key: "dues_slip_due_days" },
    create: { key: "dues_slip_due_days", value: "11", label: "Plot dues slip due days from issue" },
    update: { value: "11" },
  });
  await prisma.systemSetting.upsert({
    where: { key: "dues_slip_taxation_officer_fee" },
    create: {
      key: "dues_slip_taxation_officer_fee",
      value: "20000",
      label: "Default taxation officer fee (PKR)",
    },
    update: { value: "20000" },
  });
}

export async function seedPlotDuesDemo(prisma: PrismaClient, adminId: string) {
  await seedPlotDuesCatalog(prisma);

  const heads = await prisma.plotDuesHead.findMany();
  const byCode = Object.fromEntries(heads.map((h) => [h.code, h]));

  let loc = await prisma.fileLocation.findFirst({ where: { isActive: true } });
  if (!loc) {
    loc = await prisma.fileLocation.create({
      data: {
        building: "Admin Block",
        room: "Record Room 1",
        almirah: "A-3",
        locker: "L-20",
        label: "Sector E-16",
      },
    });
  }

  let plot = await prisma.plot.findFirst({
    where: { sector: "E-16/3", plotNumber: "15-C" },
  });
  if (!plot) {
    plot = await prisma.plot.create({
      data: {
        plotNumber: "15-C",
        sector: "E-16/3",
        block: "3",
        street: "3-A",
        sizeMarla: 8,
        sizeSqYd: 200,
        plotType: "RESIDENTIAL",
        ownershipStatus: "ACTIVE",
        possessionStatus: "NOT_APPLIED",
        developmentStatus: "DEVELOPED",
        annualChargesStatus: "PENDING",
        remarks: "Demo plot for dues ledger slip (membership 21363(i))",
      },
    });
  }

  let owner = await prisma.ownership.findUnique({ where: { membershipNumber: DEMO_MEMBERSHIP } });
  if (!owner) {
    owner = await prisma.ownership.create({
      data: {
        plotId: plot.id,
        ownerName: "Member 21363(i)",
        cnic: DEMO_CNIC,
        contact: "0300-2136321",
        address: "Islamabad",
        membershipNumber: DEMO_MEMBERSHIP,
        allotmentNumber: "AL-21363",
        startDate: new Date("2019-04-01"),
        status: "ACTIVE",
      },
    });
  }

  const existingFile = await prisma.physicalFile.findFirst({
    where: { OR: [{ barcode: DEMO_BARCODE }, { plotId: plot.id }] },
  });
  if (!existingFile) {
    await prisma.physicalFile.create({
      data: {
        fileNumber: "PF-15C",
        barcode: DEMO_BARCODE,
        plotId: plot.id,
        currentLocationId: loc.id,
        status: "IN_LOCKER",
        condition: "GOOD",
      },
    });
  }

  const asOf = new Date("2026-08-31");
  const due = new Date("2026-09-08");
  const existing = await prisma.plotDuesEntry.count({ where: { plotId: plot.id } });
  if (existing === 0) {
    const rows: Array<{ code: string; kind: "DEPOSITED" | "OUTSTANDING"; amount: number; asOfDate?: Date }> = [
      { code: "COST_OF_LAND", kind: "DEPOSITED", amount: 550000 },
      { code: "DEVELOPMENT", kind: "DEPOSITED", amount: 185000 },
      { code: "SERVICE_CHARGES", kind: "DEPOSITED", amount: 12000 },
      { code: "GRID_SHARING", kind: "OUTSTANDING", amount: 11000 },
      { code: "BOUNDARY_WALL", kind: "OUTSTANDING", amount: 4000 },
      { code: "POSSESSION", kind: "OUTSTANDING", amount: 80000 },
      { code: "MASJID_FUND", kind: "OUTSTANDING", amount: 10000 },
      { code: "POSSESSION_FORM_FEE", kind: "OUTSTANDING", amount: 500 },
      { code: "SERVICE_CHARGES", kind: "OUTSTANDING", amount: 220903, asOfDate: asOf },
      { code: "INDEPENDENT_FEEDER", kind: "OUTSTANDING", amount: 14000 },
      { code: "RO_CHARGES", kind: "OUTSTANDING", amount: 0, asOfDate: asOf },
      { code: "TAXATION_OFFICER", kind: "OUTSTANDING", amount: 20000 },
    ];

    await prisma.plotDuesEntry.createMany({
      data: rows
        .filter((row) => byCode[row.code])
        .map((row) => ({
          plotId: plot!.id,
          ownershipId: owner!.id,
          headId: byCode[row.code].id,
          kind: row.kind,
          amount: row.amount,
          asOfDate: row.asOfDate ?? null,
          dueDate: row.kind === "OUTSTANDING" ? due : null,
          remarks: "Seeded from CDECHS plot-status slip sample",
          createdById: adminId,
        })),
    });
  }

  const plot123 = await prisma.plot.findFirst({
    where: { sector: "E-17", plotNumber: "123" },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (plot123 && (await prisma.plotDuesEntry.count({ where: { plotId: plot123.id } })) === 0) {
    const owner123 = plot123.ownerships[0];
    await prisma.plotDuesEntry.createMany({
      data: [
        { code: "COST_OF_LAND", kind: "DEPOSITED" as const, amount: 800000 },
        { code: "DEVELOPMENT", kind: "DEPOSITED" as const, amount: 150000 },
        { code: "SERVICE_CHARGES", kind: "OUTSTANDING" as const, amount: 18000, asOfDate: asOf },
      ]
        .filter((row) => byCode[row.code])
        .map((row) => ({
          plotId: plot123.id,
          ownershipId: owner123?.id ?? null,
          headId: byCode[row.code].id,
          kind: row.kind,
          amount: row.amount,
          asOfDate: "asOfDate" in row ? row.asOfDate : null,
          remarks: "Seeded showcase plot dues",
          createdById: adminId,
        })),
    });
  }
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { config } = await import("dotenv");
  config();
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    if (!admin) throw new Error("Run the main seed first (no SUPER_ADMIN user).");
    await seedPlotDuesDemo(prisma, admin.id);
    console.log("Plot dues heads and demo ledger seeded.");
    console.log(`Lookup: membership ${DEMO_MEMBERSHIP}, CNIC ${DEMO_CNIC}, QR ${DEMO_BARCODE}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("seed-plot-dues")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
