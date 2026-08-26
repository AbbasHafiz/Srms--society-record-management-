import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  userId?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  plotId?: string | null;
  transferId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Immutable audit trail — never update or delete these records in app code. */
export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      action: input.action,
      module: input.module,
      recordId: input.recordId ?? undefined,
      plotId: input.plotId ?? undefined,
      transferId: input.transferId ?? undefined,
      oldValue: input.oldValue,
      newValue: input.newValue,
      reason: input.reason ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
}
