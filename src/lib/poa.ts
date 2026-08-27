import { prisma } from "@/lib/db";
import type { PowerOfAttorney, PowerOfAttorneyStatus, Prisma } from "@/generated/prisma/client";
import {
  foreignOfficeRequired,
  isNocPoa,
  isPossessionPoa,
  isSalePoa,
  LIVE_POA_STATUSES,
} from "@/lib/poa-shared";

export { foreignOfficeRequired, isNocPoa, isPossessionPoa, isSalePoa, LIVE_POA_STATUSES };

const ACTIVE: PowerOfAttorneyStatus[] = ["ACTIVE"];

export type PoaSummary = Pick<
  PowerOfAttorney,
  | "id"
  | "poaNumber"
  | "kind"
  | "purpose"
  | "status"
  | "attorneyName"
  | "attorneyCnic"
  | "attorneyContact"
  | "principalName"
  | "principalCnic"
  | "executionPlace"
  | "principalAbsenceReason"
  | "validUntil"
>;

export async function listActivePoasForPlot(
  plotId: string,
  principalCnic?: string | null
): Promise<PoaSummary[]> {
  return prisma.powerOfAttorney.findMany({
    where: {
      plotId,
      status: { in: ACTIVE },
      ...(principalCnic ? { principalCnic } : {}),
    },
    select: {
      id: true,
      poaNumber: true,
      kind: true,
      purpose: true,
      status: true,
      attorneyName: true,
      attorneyCnic: true,
      attorneyContact: true,
      principalName: true,
      principalCnic: true,
      executionPlace: true,
      principalAbsenceReason: true,
      validUntil: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function poaStillValid(poa: { status: string; validUntil?: Date | string | null }): boolean {
  if (poa.status !== "ACTIVE") return false;
  if (!poa.validUntil) return true;
  const until = poa.validUntil instanceof Date ? poa.validUntil : new Date(poa.validUntil);
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() >= Date.now();
}

export async function requireActiveSalePoa(input: {
  poaId: string;
  plotId: string;
  principalCnic: string;
}) {
  const poa = await prisma.powerOfAttorney.findUnique({ where: { id: input.poaId } });
  if (!poa) throw new Error("Power of attorney not found.");
  if (poa.plotId !== input.plotId) {
    throw new Error("This PoA is for a different plot.");
  }
  if (poa.principalCnic.replace(/\D/g, "") !== input.principalCnic.replace(/\D/g, "")) {
    throw new Error("This PoA is not for the current owner / seller of this plot.");
  }
  if (!poaStillValid(poa)) {
    throw new Error("This PoA is not active. Society must accept and activate it first.");
  }
  if (!isSalePoa(poa)) {
    throw new Error(
      "Open file / sale requires a general sale PoA (or a special PoA whose purpose is sell / open file / transfer)."
    );
  }
  return poa;
}

export async function requireActiveSpecialPoa(input: {
  poaId: string;
  plotId: string;
  principalCnic: string;
  for: "possession" | "noc";
}) {
  const poa = await prisma.powerOfAttorney.findUnique({ where: { id: input.poaId } });
  if (!poa) throw new Error("Power of attorney not found.");
  if (poa.plotId !== input.plotId) {
    throw new Error("This PoA is for a different plot.");
  }
  if (poa.principalCnic.replace(/\D/g, "") !== input.principalCnic.replace(/\D/g, "")) {
    throw new Error("This PoA is not for the current owner of this plot.");
  }
  if (!poaStillValid(poa)) {
    throw new Error("This PoA is not active. Society must accept and activate it first.");
  }
  const ok = input.for === "possession" ? isPossessionPoa(poa) : isNocPoa(poa);
  if (!ok) {
    throw new Error(
      input.for === "possession"
        ? "Possession / construction requires a special PoA for possession, or a general sale PoA."
        : "NOC requires a special PoA for certificates, or a general sale PoA."
    );
  }
  return poa;
}

export type NextPoaAction =
  | "submit"
  | "tehsildar"
  | "foreign_office"
  | "present"
  | "activate"
  | "revoke"
  | null;

export function nextPoaAction(poa: {
  status: PowerOfAttorneyStatus | string;
  executionPlace?: string | null;
  principalAbsenceReason?: string | null;
}): NextPoaAction {
  const abroad = foreignOfficeRequired(poa);
  switch (poa.status) {
    case "DRAFT":
      return "submit";
    case "SUBMITTED":
      return "tehsildar";
    case "TEHSILDAR_VERIFIED":
      return abroad ? "foreign_office" : "present";
    case "FOREIGN_OFFICE_VERIFIED":
      return "present";
    case "ACCEPTED_BY_SOCIETY":
      return "activate";
    case "ACTIVE":
      return "revoke";
    default:
      return null;
  }
}

export async function expireOverduePoas(
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const now = new Date();
  await db.powerOfAttorney.updateMany({
    where: {
      status: "ACTIVE",
      validUntil: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
}
