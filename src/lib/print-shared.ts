/** Fallback letterhead when system settings are empty — matches prisma/seed.ts. */
export const SOCIETY_LETTERHEAD_DEFAULTS = {
  name: "Green Valley Housing Society",
  address: "Main Boulevard, Sector A, Green Valley, Punjab, Pakistan",
  phone: "+92 42 111 000 111",
} as const;

export const PRINT_COMPUTER_GENERATED = "Computer generated — valid with society stamp";

export const PRINT_NOT_TITLE_DEED =
  "This summary is an office record of ownership history and current dues. It is not a legal title deed and does not confer or confirm title.";

export const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type SocietyLetterhead = {
  name: string;
  address: string;
  phone: string | null;
};

export function isPrintDocumentPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.includes("/print") || pathname.includes("/slip");
}

export function formatCalendarPeriod(year: number, month: number): string {
  const label = CALENDAR_MONTHS[month - 1];
  return label ? `${label} ${year}` : `${year}-${String(month).padStart(2, "0")}`;
}

export function formatFileLocation(loc: {
  building: string;
  room: string;
  almirah: string;
  locker: string;
  shelf?: string | null;
  position?: string | null;
  label?: string | null;
} | null | undefined): string {
  if (!loc) return "—";
  const parts = [loc.building, loc.room, loc.almirah, loc.locker];
  if (loc.shelf) parts.push(`Shelf ${loc.shelf}`);
  if (loc.position) parts.push(`Pos ${loc.position}`);
  if (loc.label) parts.push(`(${loc.label})`);
  return parts.join(" › ");
}
