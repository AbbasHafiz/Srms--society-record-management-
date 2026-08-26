import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | { toString(): string } | null | undefined) {
  if (amount === null || amount === undefined) return "Rs. 0";
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return format(new Date(date), "dd-MM-yyyy");
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return format(new Date(date), "dd-MM-yyyy HH:mm");
}

export function relativeTime(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function daysUntil(date: Date | string) {
  return differenceInDays(new Date(date), new Date());
}

export function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (["ACTIVE", "COMPLETED", "VERIFIED", "PAID", "ISSUED", "APPROVED", "PRESENT", "RELEASED", "POSTED"].includes(s)) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (["PENDING", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "PAYMENT_PENDING", "SCHEDULED", "MOVING"].includes(s)) {
    return "bg-amber-100 text-amber-900 border-amber-200";
  }
  if (["REJECTED", "CANCELLED", "EXPIRED", "ABSENT", "OVERDUE", "MISSING", "ACTIVE_MORTGAGE", "VOID"].includes(s)) {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (["TRANSFERRED", "INACTIVE", "DEAD", "SUPERSEDED", "ARCHIVED"].includes(s)) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return "bg-sky-100 text-sky-800 border-sky-200";
}

export function labelize(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
