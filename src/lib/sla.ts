import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import type { TransferCaseType } from "@/generated/prisma/client";

export const SLA_SETTING_KEYS = {
  transferAllotment: "sla_transfer_allotment_days",
  possession: "sla_possession_days",
  deathCase: "sla_death_case_days",
  noc: "sla_noc_days",
  nec: "sla_nec_days",
  utilityNoc: "sla_utility_noc_days",
} as const;

export const SLA_DEFAULTS: Record<string, { value: string; label: string }> = {
  [SLA_SETTING_KEYS.transferAllotment]: {
    value: "14",
    label: "Transfer → allotment letter printing (days)",
  },
  [SLA_SETTING_KEYS.possession]: {
    value: "21",
    label: "Possession case completion (days)",
  },
  [SLA_SETTING_KEYS.deathCase]: {
    value: "30",
    label: "Death / succession case completion (days)",
  },
  [SLA_SETTING_KEYS.noc]: {
    value: "7",
    label: "NOC issuance (days)",
  },
  [SLA_SETTING_KEYS.nec]: {
    value: "7",
    label: "NEC issuance (days)",
  },
  [SLA_SETTING_KEYS.utilityNoc]: {
    value: "7",
    label: "Utility connection NOC (days)",
  },
};

const cache = new Map<string, number>();

export async function getSlaDays(key: string, fallback?: number): Promise<number> {
  if (cache.has(key)) return cache.get(key)!;

  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  const parsed = setting ? Number(setting.value) : NaN;
  const days =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : (fallback ?? Number(SLA_DEFAULTS[key]?.value ?? 7));

  cache.set(key, days);
  return days;
}

export function clearSlaCache() {
  cache.clear();
}

export function computeDueDate(startDate: Date | string, slaDays: number): Date {
  return addDays(new Date(startDate), slaDays);
}

export async function computeTransferSlaDue(
  transferType: TransferCaseType,
  startDate: Date
): Promise<Date> {
  if (transferType === "DEATH_SUCCESSION") {
    const days = await getSlaDays(SLA_SETTING_KEYS.deathCase, 30);
    return computeDueDate(startDate, days);
  }
  const days = await getSlaDays(SLA_SETTING_KEYS.transferAllotment, 14);
  return computeDueDate(startDate, days);
}

export async function computeAllotmentLetterDue(completedAt: Date): Promise<Date> {
  const days = await getSlaDays(SLA_SETTING_KEYS.transferAllotment, 14);
  return computeDueDate(completedAt, days);
}

export async function computePossessionSlaDue(applicationDate: Date): Promise<Date> {
  const days = await getSlaDays(SLA_SETTING_KEYS.possession, 21);
  return computeDueDate(applicationDate, days);
}

export async function computeNocSlaDue(
  applicationDate: Date,
  purpose: string
): Promise<Date> {
  const key =
    purpose === "UTILITY_CONNECTION"
      ? SLA_SETTING_KEYS.utilityNoc
      : SLA_SETTING_KEYS.noc;
  const fallback = purpose === "UTILITY_CONNECTION" ? 7 : 7;
  const days = await getSlaDays(key, fallback);
  return computeDueDate(applicationDate, days);
}

export async function computeNecSlaDue(applicationDate: Date): Promise<Date> {
  const days = await getSlaDays(SLA_SETTING_KEYS.nec, 7);
  return computeDueDate(applicationDate, days);
}

export type SlaStatus = {
  dueAt: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isComplete: boolean;
  label: string;
};

export function getSlaStatus(
  dueAt: Date | string | null | undefined,
  completedAt?: Date | string | null
): SlaStatus | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isComplete = !!completedAt;
  const isOverdue = !isComplete && daysRemaining < 0;

  let label: string;
  if (isComplete) {
    label = "Completed";
  } else if (isOverdue) {
    label = `${Math.abs(daysRemaining)}d overdue`;
  } else if (daysRemaining === 0) {
    label = "Due today";
  } else {
    label = `${daysRemaining}d remaining`;
  }

  return { dueAt: due, daysRemaining, isOverdue, isComplete, label };
}

export function resolveSlaDueAt(
  stored: Date | string | null | undefined,
  fallbackStart: Date | string,
  slaDays: number
): Date {
  if (stored) return new Date(stored);
  return computeDueDate(fallbackStart, slaDays);
}
