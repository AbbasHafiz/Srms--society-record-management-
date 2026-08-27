import { z } from "zod";

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export function softCheckPhone(
  raw: string,
  { required = true }: { required?: boolean } = {}
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (!required) return { ok: true, normalized: "" };
    return { ok: false, message: "Phone number is required" };
  }
  const normalized = normalizePhone(trimmed);
  if (normalized.length < 10 || normalized.length > 11) {
    return { ok: false, message: "Phone should be 10–11 digits (e.g. 03xx-xxxxxxx)" };
  }
  return { ok: true, normalized: trimmed };
}

export function softCheckCnic(
  raw: string,
  { required = true }: { required?: boolean } = {}
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (!required) return { ok: true, normalized: "" };
    return { ok: false, message: "CNIC is required" };
  }
  const dashed = /^\d{5}-\d{7}-\d$/;
  const digits = trimmed.replace(/\D/g, "");
  if (dashed.test(trimmed)) return { ok: true, normalized: trimmed };
  if (/^\d{13}$/.test(digits)) {
    return {
      ok: true,
      normalized: `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`,
    };
  }
  return { ok: false, message: "CNIC should be 13 digits or 12345-1234567-1 format" };
}

export const tankerBookingSchema = z
  .object({
    bookerName: z.string().trim().min(1, "Booker name is required"),
    bookerContact: z.string().trim().optional(),
    tankerType: z.enum(["CLEAN_WATER", "CONSTRUCTION_WATER"]),
    distributionDate: z.string().min(1, "Delivery date is required"),
    timeSlotId: z.string().trim().min(1, "Time slot is required"),
    destinationMode: z.enum(["plot", "house"]).default("house"),
    plotId: z.string().trim().optional(),
    houseNo: z.string().trim().optional(),
    streetNo: z.string().trim().optional(),
    streetArea: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.destinationMode === "plot") {
      if (!data.plotId) {
        ctx.addIssue({
          code: "custom",
          message: "Select a society plot for plot bookings",
          path: ["plotId"],
        });
      }
    } else if (!data.houseNo || !data.streetNo || !data.streetArea) {
      ctx.addIssue({
        code: "custom",
        message: "House no., street no., and street/area are required for walk-in bookings",
        path: ["houseNo"],
      });
    }
  });

export const officeCreateSchema = z.object({
  officeName: z.string().trim().min(1, "Office name is required"),
  ownerName: z.string().trim().min(1, "Owner name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  premisesType: z.enum(["SOCIETY_LAND", "PRIVATE"]),
  rentAmount: z.coerce.number().optional(),
});

export const transferCompleteSchema = z.object({
  id: z.string().trim().min(1, "Transfer ID required"),
});

export const electricityBillSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  dueDate: z.string().min(1, "Due date is required"),
});

export const maintenanceWorkSchema = z.object({
  workType: z.string().trim().min(1, "Maintenance type is required"),
  description: z.string().trim().min(1, "Description is required"),
  cost: z.coerce.number().min(0, "Cost must be zero or greater"),
});

export function zodFieldErrors(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}
