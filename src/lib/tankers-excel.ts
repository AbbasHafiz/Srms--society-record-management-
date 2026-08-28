import {
  filterDailyScheduleByTankerType,
  flattenDailyScheduleDeliveries,
  getDailySchedule,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  tankerDestinationLabel,
  TANKER_TYPE_LABELS,
} from "@/lib/tankers";
import { formatDate, labelize } from "@/lib/utils";
import type { ExcelColumn } from "@/lib/excel";

export const TANKER_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Booking Number", key: "bookingNumber", width: 16 },
  { header: "Water Type", key: "tankerType", width: 18 },
  { header: "Date", key: "date", width: 14 },
  { header: "Slot", key: "slot", width: 16 },
  { header: "Destination", key: "destination", width: 28 },
  { header: "Customer", key: "customerName", width: 20 },
  { header: "Booker", key: "bookerName", width: 18 },
  { header: "Contact", key: "bookerContact", width: 16 },
  { header: "Tanker", key: "tanker", width: 12 },
  { header: "Driver", key: "driver", width: 18 },
  { header: "Charges", key: "charges", width: 12 },
  { header: "Payment", key: "paymentStatus", width: 12 },
  { header: "Status", key: "status", width: 14 },
];

export async function loadTankerExcelRows(filters: { date?: string; type?: string }) {
  const scheduleDate = parseTankerScheduleDate(filters.date);
  const typeFilter = parseWaterTypeListFilter(filters.type);
  const schedule = await getDailySchedule(scheduleDate);
  const filtered =
    typeFilter === "all" ? schedule : filterDailyScheduleByTankerType(schedule, typeFilter);
  const deliveries = flattenDailyScheduleDeliveries(filtered);
  return deliveries.map((d) => ({
    bookingNumber: d.bookingNumber,
    tankerType: TANKER_TYPE_LABELS[d.tankerType],
    date: formatDate(d.distributionDate),
    slot: d.slotLabel ?? (d.slotStartTime && d.slotEndTime ? `${d.slotStartTime}–${d.slotEndTime}` : ""),
    destination: tankerDestinationLabel(d),
    customerName: d.customerName ?? "",
    bookerName: d.bookerName ?? "",
    bookerContact: d.bookerContact ?? "",
    tanker: d.tanker?.tankerCode ?? "",
    driver: d.driver?.name ?? "",
    charges: Number(d.charges),
    paymentStatus: labelize(d.paymentStatus),
    status: labelize(d.status),
  }));
}
