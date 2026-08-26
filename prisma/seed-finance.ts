import type { PrismaClient } from "../src/generated/prisma/client";
import { FINANCE_CATEGORY_SEEDS } from "../src/lib/finance";

type SeedFinanceContext = {
  adminId: string;
  saraId: string;
  plot123Id: string;
  owner3Id: string;
  transferPaymentId: string;
};

export async function seedFinance(prisma: PrismaClient, ctx: SeedFinanceContext) {
  console.log("Seeding finance categories & sample ledger…");

  for (const seed of FINANCE_CATEGORY_SEEDS) {
    await prisma.financeCategory.create({
      data: {
        code: seed.code,
        name: seed.name,
        type: seed.type,
        isSystem: true,
        isActive: true,
        description: seed.description,
        sortOrder: seed.sortOrder,
      },
    });
  }

  const categories = await prisma.financeCategory.findMany();
  const byCode = Object.fromEntries(categories.map((c) => [c.code, c]));

  await prisma.numberSequence.create({
    data: { key: "finance_txn", prefix: "FIN", nextValue: 5, padLength: 4 },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.financeTransaction.createMany({
    data: [
      {
        txnNumber: "FIN-0001",
        categoryId: byCode.REV_TRANSFER_FEES!.id,
        type: "REVENUE",
        amount: 50000,
        txnDate: today,
        paymentMethod: "PO",
        reference: "PO-88991",
        plotId: ctx.plot123Id,
        ownershipId: ctx.owner3Id,
        paymentId: ctx.transferPaymentId,
        description: "Transfer fee — plot E-17/3-123 (pending verification demo)",
        status: "POSTED",
        createdById: ctx.saraId,
      },
      {
        txnNumber: "FIN-0002",
        categoryId: byCode.EXP_SALARIES!.id,
        type: "EXPENSE",
        amount: 385000,
        txnDate: today,
        paymentMethod: "BANK_TRANSFER",
        reference: "SAL-JAN-2026",
        description: "January 2026 staff salaries (13 employees)",
        status: "POSTED",
        createdById: ctx.saraId,
      },
      {
        txnNumber: "FIN-0003",
        categoryId: byCode.EXP_CONTRACTOR!.id,
        type: "EXPENSE",
        amount: 18500,
        txnDate: today,
        paymentMethod: "CHEQUE",
        reference: "CHQ-4421",
        description: "Electrical contractor — street light repairs Block 3",
        status: "POSTED",
        createdById: ctx.saraId,
      },
      {
        txnNumber: "FIN-0004",
        categoryId: byCode.REV_TANKER!.id,
        type: "REVENUE",
        amount: 2500,
        txnDate: today,
        paymentMethod: "CASH",
        reference: "RCPT-00980",
        plotId: ctx.plot123Id,
        description: "Water tanker delivery — E-17 Street 12",
        status: "POSTED",
        createdById: ctx.saraId,
      },
    ],
  });
}
