import type { DocumentType, HeirRelation } from "@/generated/prisma/client";
import { isRealUploadedDocument } from "@/lib/documents";

export const HEIR_RELATION_LABELS: Record<HeirRelation, string> = {
  WIFE: "Wife",
  HUSBAND: "Husband",
  SON: "Son",
  DAUGHTER: "Daughter",
  MOTHER: "Mother",
  FATHER: "Father",
  BROTHER: "Brother",
  SISTER: "Sister",
  OTHER: "Other",
};

export type DeathDocRequirement = {
  type: DocumentType;
  label: string;
  mandatory: boolean;
  description?: string;
};

/** Mandatory documents for death / succession transfer per Pakistani society-office practice */
export const DEATH_TRANSFER_DOCUMENTS: DeathDocRequirement[] = [
  {
    type: "OLD_ALLOTMENT_LETTER",
    label: "Old Allotment Letter",
    mandatory: true,
    description: "Original allotment letter of the deceased member",
  },
  {
    type: "DECEASED_CNIC",
    label: "Deceased CNIC",
    mandatory: true,
    description: "CNIC copy of the deceased plot owner",
  },
  {
    type: "DEATH_CERTIFICATE",
    label: "Death Certificate",
    mandatory: true,
    description: "NADRA / union council death certificate (ref may be recorded on case)",
  },
  {
    type: "FRC_NADRA",
    label: "FRC (NADRA)",
    mandatory: true,
    description: "Family Registration Certificate from NADRA listing legal heirs",
  },
  {
    type: "LEGAL_HEIR_CERTIFICATE",
    label: "Legal Heir Certificate",
    mandatory: false,
    description: "Court / revenue legal heir certificate if available",
  },
  {
    type: "SUCCESSION_DOCS",
    label: "Succession Documents",
    mandatory: false,
    description: "Affidavit, heir consent, or other succession supporting papers",
  },
  {
    type: "HEIR_CNIC",
    label: "Heir / New Owner CNIC",
    mandatory: true,
    description: "CNIC of each legal heir and primary successor",
  },
];

export const MANDATORY_DEATH_DOC_TYPES = DEATH_TRANSFER_DOCUMENTS.filter(
  (d) => d.mandatory
).map((d) => d.type);

export type DeathTransferDocument = {
  documentType: DocumentType;
  filePath: string;
  fileSize?: number | null;
  fileName?: string;
  documentNumber?: string | null;
  status?: string;
};

function activeRealDocuments(documents: DeathTransferDocument[]) {
  return documents.filter(
    (d) => (d.status == null || d.status === "ACTIVE") && isRealUploadedDocument(d)
  );
}

export function hasRealDeathDocument(
  documents: DeathTransferDocument[],
  type: DocumentType,
  documentNumber?: string | null
): boolean {
  return activeRealDocuments(documents).some(
    (d) =>
      d.documentType === type &&
      (documentNumber == null || d.documentNumber === documentNumber)
  );
}

export function validateDeathTransferReadiness(input: {
  heirs: { name: string; cnic: string; isPrimarySuccessor: boolean }[];
  documents: DeathTransferDocument[];
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.heirs.length === 0) {
    errors.push("At least one legal heir must be recorded");
  }

  const primary = input.heirs.filter((h) => h.isPrimarySuccessor);
  if (primary.length !== 1) {
    errors.push("Exactly one primary successor must be nominated for membership transfer");
  } else if (!primary[0].name?.trim() || !primary[0].cnic?.trim()) {
    errors.push("Primary successor name and CNIC are required");
  }

  for (const req of MANDATORY_DEATH_DOC_TYPES) {
    if (req === "HEIR_CNIC") continue;
    if (!hasRealDeathDocument(input.documents, req)) {
      const doc = DEATH_TRANSFER_DOCUMENTS.find((d) => d.type === req);
      errors.push(`Missing mandatory document scan: ${doc?.label ?? req}`);
    }
  }

  for (const heir of input.heirs) {
    if (!hasRealDeathDocument(input.documents, "HEIR_CNIC", heir.cnic)) {
      errors.push(`Missing CNIC scan for heir: ${heir.name}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function deathDocumentChecklistState(
  documents: DeathTransferDocument[],
  heirs: { name: string; cnic: string }[]
): Record<DocumentType, boolean> {
  const state = {} as Record<DocumentType, boolean>;
  for (const req of DEATH_TRANSFER_DOCUMENTS) {
    if (req.type === "HEIR_CNIC") {
      state[req.type] =
        heirs.length > 0 &&
        heirs.every((h) => hasRealDeathDocument(documents, "HEIR_CNIC", h.cnic));
    } else {
      state[req.type] = hasRealDeathDocument(documents, req.type);
    }
  }
  return state;
}
