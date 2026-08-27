import type {
  PoaExecutionPlace,
  PoaVerificationStepType,
  PowerOfAttorneyKind,
  PowerOfAttorneyPurpose,
  PowerOfAttorneyStatus,
  PrincipalAbsenceReason,
} from "@/generated/prisma/client";

export const POA_KINDS: PowerOfAttorneyKind[] = ["GENERAL_SALE", "SPECIAL"];

export const POA_PURPOSES: PowerOfAttorneyPurpose[] = [
  "SALE_OPEN_FILE_TRANSFER",
  "POSSESSION_CONSTRUCTION",
  "NOC_CERTIFICATE",
  "OTHER",
];

export const POA_STATUSES: PowerOfAttorneyStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "TEHSILDAR_VERIFIED",
  "FOREIGN_OFFICE_VERIFIED",
  "ACCEPTED_BY_SOCIETY",
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
];

export const POA_EXECUTION_PLACES: PoaExecutionPlace[] = ["PAKISTAN", "ABROAD"];

export const PRINCIPAL_ABSENCE_REASONS: PrincipalAbsenceReason[] = ["ABROAD", "UNWELL", "OTHER"];

export const LIVE_POA_STATUSES: PowerOfAttorneyStatus[] = ["ACTIVE"];

export function poaKindLabel(kind: string): string {
  switch (kind) {
    case "GENERAL_SALE":
      return "General / sale PoA";
    case "SPECIAL":
      return "Special PoA";
    default:
      return kind.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function poaPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "SALE_OPEN_FILE_TRANSFER":
      return "Sell, open file, or transfer";
    case "POSSESSION_CONSTRUCTION":
      return "Possession / construction";
    case "NOC_CERTIFICATE":
      return "Apply for NOC and society certificates";
    case "OTHER":
      return "Other special purpose";
    default:
      return purpose.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function poaStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted";
    case "TEHSILDAR_VERIFIED":
      return "Tehsildar verified";
    case "FOREIGN_OFFICE_VERIFIED":
      return "Foreign office verified";
    case "ACCEPTED_BY_SOCIETY":
      return "Accepted by society";
    case "ACTIVE":
      return "Active";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    default:
      return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function poaStepLabel(step: PoaVerificationStepType | string): string {
  switch (step) {
    case "EXECUTED":
      return "Executed by principal";
    case "TEHSILDAR":
      return "Verified by Tehsildar / tehsil office";
    case "FOREIGN_OFFICE":
      return "Verified by Foreign Office / Pakistani mission";
    case "PRESENTED_TO_SOCIETY":
      return "Presented to society";
    case "ACTIVATED":
      return "Activated";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    default:
      return String(step);
  }
}

export function principalAbsenceLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "ABROAD":
      return "Principal is abroad";
    case "UNWELL":
      return "Principal is unwell";
    case "OTHER":
      return "Other reason";
    default:
      return "—";
  }
}

export function foreignOfficeRequired(input: {
  executionPlace?: PoaExecutionPlace | string | null;
  principalAbsenceReason?: PrincipalAbsenceReason | string | null;
}): boolean {
  return input.executionPlace === "ABROAD" || input.principalAbsenceReason === "ABROAD";
}

export function isSalePoa(poa: { kind: string; purpose: string }): boolean {
  return poa.kind === "GENERAL_SALE" || poa.purpose === "SALE_OPEN_FILE_TRANSFER";
}

export function isPossessionPoa(poa: { kind: string; purpose: string }): boolean {
  return poa.purpose === "POSSESSION_CONSTRUCTION" || poa.kind === "GENERAL_SALE";
}

export function isNocPoa(poa: { kind: string; purpose: string }): boolean {
  return poa.purpose === "NOC_CERTIFICATE" || poa.kind === "GENERAL_SALE";
}
