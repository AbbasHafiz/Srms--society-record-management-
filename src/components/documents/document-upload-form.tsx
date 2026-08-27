"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtherSpecify } from "@/components/ui/other-specify";
import { labelize } from "@/lib/utils";
import type { DocumentType } from "@/generated/prisma/client";

const DOC_TYPES: DocumentType[] = [
  "CNIC",
  "ALLOTMENT_LETTER",
  "OLD_ALLOTMENT_LETTER",
  "DECEASED_CNIC",
  "DEATH_CERTIFICATE",
  "FRC_NADRA",
  "LEGAL_HEIR_CERTIFICATE",
  "SUCCESSION_DOCS",
  "HEIR_CNIC",
  "POSSESSION_LETTER",
  "NOC",
  "NEC",
  "TRANSFER_FORM",
  "BANK_LETTER",
  "MORTGAGE_LETTER",
  "BANK_NOC",
  "LOAN_DOCUMENTS",
  "PAYMENT_PO",
  "DEALER_LETTERHEAD",
  "OPEN_FILE_DOCUMENT",
  "SITE_PLAN",
  "PREVIOUS_TRANSFER",
  "POA_INSTRUMENT",
  "POA_TEHSILDAR_CERTIFICATE",
  "POA_FOREIGN_OFFICE_ATTESTATION",
  "POA_ATTORNEY_CNIC",
  "POA_PLOT_DOCUMENTS",
  "SIGNATURE",
  "THUMB_IMPRESSION",
  "OTHER",
];

type OwnershipOption = { id: string; ownerName: string; membershipNumber: string };

export function DocumentUploadForm({
  action,
  plotId,
  ownerships,
  transferId,
  mortgageId,
  openFileId,
  defaultDocumentType,
  compact,
}: {
  action: (formData: FormData) => void | Promise<void>;
  plotId: string;
  ownerships?: OwnershipOption[];
  transferId?: string;
  mortgageId?: string;
  openFileId?: string;
  defaultDocumentType?: DocumentType;
  compact?: boolean;
}) {
  const [documentType, setDocumentType] = useState<DocumentType>(defaultDocumentType ?? "OTHER");

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="font-medium text-slate-900">{compact ? "Upload document" : "Upload new document"}</h3>
      <input type="hidden" name="plotId" value={plotId} />
      {transferId ? <input type="hidden" name="transferId" value={transferId} /> : null}
      {mortgageId ? <input type="hidden" name="mortgageId" value={mortgageId} /> : null}
      {openFileId ? <input type="hidden" name="openFileId" value={openFileId} /> : null}

      {ownerships && ownerships.length > 0 ? (
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Ownership</Label>
          <select
            name="ownershipId"
            defaultValue={ownerships.find((o) => o.id)?.id ?? ""}
            className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {ownerships.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ownerName} ({o.membershipNumber})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Document type</Label>
        <select
          name="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {labelize(t)}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={documentType}
          label="Specify document type"
          placeholder="e.g. Power of attorney, affidavit"
          className="mt-2"
        />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Title</Label>
        <Input name="title" required className="mt-1" placeholder="Document title" />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Document number (optional)</Label>
        <Input name="documentNumber" className="mt-1" />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">File (PDF, JPEG, PNG, WebP — max 10MB)</Label>
        <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" className="mt-1" />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Remarks (optional)</Label>
        <textarea name="remarks" rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      <Button type="submit">Upload</Button>
    </form>
  );
}
