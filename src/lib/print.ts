import { getSystemSetting } from "@/lib/system-settings";
import {
  SOCIETY_LETTERHEAD_DEFAULTS,
  type SocietyLetterhead,
} from "@/lib/print-shared";

export {
  SOCIETY_LETTERHEAD_DEFAULTS,
  PRINT_COMPUTER_GENERATED,
  PRINT_NOT_TITLE_DEED,
  CALENDAR_MONTHS,
  isPrintDocumentPath,
  formatCalendarPeriod,
  formatFileLocation,
} from "@/lib/print-shared";
export type { SocietyLetterhead } from "@/lib/print-shared";

export async function getSocietyLetterhead(): Promise<SocietyLetterhead> {
  const [name, address, phone] = await Promise.all([
    getSystemSetting("society_name"),
    getSystemSetting("society_address"),
    getSystemSetting("society_phone"),
  ]);
  return {
    name: name?.trim() || SOCIETY_LETTERHEAD_DEFAULTS.name,
    address: address?.trim() || SOCIETY_LETTERHEAD_DEFAULTS.address,
    phone: phone?.trim() || SOCIETY_LETTERHEAD_DEFAULTS.phone,
  };
}
