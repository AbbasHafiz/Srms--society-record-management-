import type { Designation } from "@/generated/prisma/client";

export const ALL_DESIGNATIONS: Designation[] = [
  "PRESIDENT",
  "SECRETARY",
  "GM",
  "TRANSFER_OFFICER",
  "ASSOCIATE_TRANSFER_OFFICER",
  "RECORD_MANAGER",
  "FINANCE",
  "COOK",
  "DRIVER",
  "COMPUTER_OPERATOR",
  "ELECTRICIAN",
  "PLUMBER",
  "MALI",
  "SWEEPER",
  "MESS",
  "SECURITY_GUARD",
  "TRACTOR_DRIVER",
  "OTHER",
];

export const MANAGEMENT_DESIGNATIONS: Designation[] = [
  "PRESIDENT",
  "SECRETARY",
  "GM",
  "TRANSFER_OFFICER",
  "ASSOCIATE_TRANSFER_OFFICER",
  "RECORD_MANAGER",
  "FINANCE",
];

export const OPERATIONAL_DESIGNATIONS: Designation[] = ALL_DESIGNATIONS.filter(
  (d) => !MANAGEMENT_DESIGNATIONS.includes(d)
);

/** Quick-filter chips for operational staff on the employees list. */
export const QUICK_FILTER_DESIGNATIONS: Designation[] = [
  "COOK",
  "DRIVER",
  "COMPUTER_OPERATOR",
  "MALI",
  "SWEEPER",
  "SECURITY_GUARD",
  "TRACTOR_DRIVER",
  "MESS",
  "ELECTRICIAN",
  "PLUMBER",
];

export function isManagementDesignation(designation: Designation): boolean {
  return MANAGEMENT_DESIGNATIONS.includes(designation);
}

export function designationBadgeColor(designation: Designation): string {
  if (MANAGEMENT_DESIGNATIONS.includes(designation)) {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  switch (designation) {
    case "COOK":
    case "MESS":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "DRIVER":
    case "TRACTOR_DRIVER":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "COMPUTER_OPERATOR":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "SECURITY_GUARD":
      return "bg-slate-800 text-white border-slate-700";
    case "MALI":
    case "SWEEPER":
      return "bg-lime-100 text-lime-900 border-lime-200";
    case "ELECTRICIAN":
    case "PLUMBER":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
