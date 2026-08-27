import { hasPermission } from "@/lib/rbac";
import type { NotifyRecipientType, Role } from "@/generated/prisma/client";

export const WHATSAPP_SETTING_ENABLED = "whatsapp_enabled";
export const WHATSAPP_SETTING_COUNTRY_CODE = "whatsapp_default_country_code";

/** Built-in template keys (also seeded in NotifyTemplate table). */
export const WHATSAPP_TEMPLATE_KEYS = [
  "transfer_seller_verification",
  "transfer_payment_pending",
  "transfer_completed",
  "transfer_death_succession",
  "possession_submitted",
  "possession_issued",
  "possession_sla_reminder",
  "noc_submitted",
  "noc_issued",
  "noc_sla_reminder",
  "nec_submitted",
  "nec_issued",
  "nec_sla_reminder",
  "utility_noc_reminder",
  "open_file_expiry",
  "mortgage_warning",
  "annual_charge_overdue",
  "tanker_confirmed",
  "tanker_assigned_driver",
  "tanker_out_for_delivery",
  "guard_shift_reminder",
  "custom_message",
] as const;

export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];

export type WhatsAppRecipientInput = {
  recipientName: string;
  recipientPhone: string;
  recipientType: NotifyRecipientType;
  recipientEmployeeId?: string | null;
};

/** Normalize phone for wa.me — Pakistan default: digits only, 92… prefix. */
export function normalizePkPhone(phone: string, defaultCountryCode = "92"): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("0") && normalized.length >= 10) {
    normalized = defaultCountryCode + normalized.slice(1);
  } else if (!normalized.startsWith(defaultCountryCode) && normalized.length <= 11) {
    normalized = defaultCountryCode + normalized;
  }

  if (normalized.length < 10) return null;
  return normalized;
}

export function buildWaMeLink(phone: string, text: string): string {
  const normalized = phone.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function buildWaNativeLink(phone: string, text: string): string {
  const normalized = phone.replace(/\D/g, "");
  return `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(text)}`;
}

/** Replace {{placeholders}} in template body. */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    return val === null || val === undefined ? "" : String(val);
  });
}

export function canSendWhatsApp(role: Role, recipientType: NotifyRecipientType): boolean {
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "GM" || role === "SECRETARY") {
    return true;
  }

  if (recipientType === "GUARD" || recipientType === "EMPLOYEE") {
    return role === "SECURITY" || role === "HR_ADMIN" || role === "FINANCE";
  }

  if (
    recipientType === "OWNER" ||
    recipientType === "HEIR" ||
    recipientType === "DEALER" ||
    recipientType === "BOOKER"
  ) {
    return (
      role === "TRANSFER_OFFICER" ||
      role === "ASSOCIATE_TRANSFER_OFFICER" ||
      role === "FINANCE" ||
      role === "RECORD_MANAGER"
    );
  }

  if (recipientType === "CUSTOM" || recipientType === "OTHER") {
    return hasPermission(role, "create");
  }

  return hasPermission(role, "create");
}

export const DEFAULT_TEMPLATE_BODIES: Record<WhatsAppTemplateKey, string> = {
  transfer_seller_verification:
    "Green Valley Society: Transfer {{transferNumber}} for plot {{plotLabel}} — seller identity verification is required. Please visit the transfer office with original CNIC. Ref: {{transferNumber}}",
  transfer_payment_pending:
    "Green Valley Society: Transfer {{transferNumber}} for plot {{plotLabel}} — payment of {{amount}} is pending. Please complete payment to proceed. Ref: {{transferNumber}}",
  transfer_completed:
    "Green Valley Society: Transfer {{transferNumber}} for plot {{plotLabel}} has been completed. New membership {{membershipNumber}}. Welcome to Green Valley!",
  transfer_death_succession:
    "Green Valley Society: Death/succession case {{transferNumber}} for plot {{plotLabel}} — status update. Please contact the transfer office for next steps.",
  possession_submitted:
    "Green Valley Society: Possession application {{applicationNumber}} for plot {{plotLabel}} has been submitted. SLA due: {{dueDate}}.",
  possession_issued:
    "Green Valley Society: Possession letter issued for plot {{plotLabel}}. Application {{applicationNumber}}. Collect from records office.",
  possession_sla_reminder:
    "Green Valley Society: Reminder — possession case {{applicationNumber}} for plot {{plotLabel}} is due by {{dueDate}}. Please follow up.",
  noc_submitted:
    "Green Valley Society: NOC application {{applicationNumber}} for plot {{plotLabel}} ({{purpose}}) has been submitted.",
  noc_issued:
    "Green Valley Society: NOC {{nocNumber}} issued for plot {{plotLabel}}. Purpose: {{purpose}}. Valid until {{expiryDate}}.",
  noc_sla_reminder:
    "Green Valley Society: NOC application {{applicationNumber}} for plot {{plotLabel}} — SLA reminder. Due: {{dueDate}}.",
  nec_submitted:
    "Green Valley Society: NEC application {{applicationNumber}} for plot {{plotLabel}} has been submitted.",
  nec_issued:
    "Green Valley Society: NEC {{necNumber}} issued for plot {{plotLabel}}. Valid until {{expiryDate}}.",
  nec_sla_reminder:
    "Green Valley Society: NEC application {{applicationNumber}} for plot {{plotLabel}} — SLA reminder. Due: {{dueDate}}.",
  utility_noc_reminder:
    "Green Valley Society: Utility connection NOC for plot {{plotLabel}} — please submit required documents. Ref: {{applicationNumber}}.",
  open_file_expiry:
    "Green Valley Society: Dealer open file {{openFileNumber}} for plot {{plotLabel}} expires on {{expiryDate}}. Renew, close in a purchaser's name, or withdraw before expiry.",
  mortgage_warning:
    "Green Valley Society: Active mortgage on plot {{plotLabel}} with {{bankName}}. Transfer/completion blocked until bank clearance.",
  annual_charge_overdue:
    "Green Valley Society: Annual plot charges overdue for plot {{plotLabel}}. Amount due: {{amount}}. Please pay at finance office.",
  tanker_confirmed:
    "Green Valley Society: Water tanker booking {{bookingNumber}} confirmed for {{distributionDate}}. Slot: {{slotLabel}}. Charges: {{amount}}.",
  tanker_assigned_driver:
    "Green Valley Society: Tanker {{bookingNumber}} — driver {{driverName}} assigned for {{distributionDate}}. Slot: {{slotLabel}}.",
  tanker_out_for_delivery:
    "Green Valley Society: Your water tanker ({{bookingNumber}}) is out for delivery. Expected slot: {{slotLabel}} on {{distributionDate}}.",
  guard_shift_reminder:
    "Green Valley Security: Shift reminder — {{shift}} duty on {{date}}. Post: {{post}}. Report on time.",
  custom_message: "{{message}}",
};
