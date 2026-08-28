"use client";

import { useActionState } from "react";
import { bindFormAction } from "@/lib/action-result";
import { markFbrTaxPaid, recordFbrTaxAssessment } from "@/app/(app)/tax/actions";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/page";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { FbrTaxRecordFields } from "@/components/tax/fbr-tax-record-fields";
import { TAX_FORM_FIELDS } from "@/lib/fbr-tax-shared";
import {
  filerStatusLabel,
  formatPercent,
  taxPartyRoleLabel,
  taxSectionLabel,
  taxSectionShort,
} from "@/lib/fbr-tax-shared";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/print/print-button";
import type { FilerStatus, TaxPartyRole, TaxPaymentStatus, TaxSection } from "@/generated/prisma/client";

export type TaxAssessmentRow = {
  id: string;
  assessmentNumber: string;
  taxSection: TaxSection;
  partyRole: TaxPartyRole;
  filerStatus: FilerStatus;
  dcValueSnapshot: string;
  ratePercent: string;
  amount: string;
  paymentStatus: TaxPaymentStatus;
  challanNumber: string | null;
  cprNumber: string | null;
  paidAt: Date | string | null;
  partyName: string;
  partyCnic: string | null;
  createdAt: Date | string;
};

export function FbrTaxAssessmentsPanel({
  assessments,
  plotId,
  transferId,
  openFileId,
  dcValueDefault,
  rates,
  sellerName,
  purchaserName,
  canRecord,
  canMarkPaid,
  allow236C,
  allow236K,
  emptyTitle,
  emptyDescription,
}: {
  assessments: TaxAssessmentRow[];
  plotId: string;
  transferId?: string | null;
  openFileId?: string | null;
  dcValueDefault?: string;
  rates: { cFiler: number; cNonFiler: number; kFiler: number; kNonFiler: number };
  sellerName: string;
  purchaserName?: string | null;
  canRecord: boolean;
  canMarkPaid: boolean;
  allow236C: boolean;
  allow236K: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const hasC = assessments.some((a) => a.taxSection === "SECTION_236C");
  const hasK = assessments.some((a) => a.taxSection === "SECTION_236K");
  const showCForm = canRecord && allow236C && !hasC;
  const showKForm = canRecord && allow236K && !hasK && !!purchaserName;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">FBR 236C / 236K tax</h2>
      <p className="mt-1 text-sm text-slate-600">
        Withholding is assessed on the society DC value. Each row is a snapshot (DC, rate, filer status,
        amount). Figures are not overwritten.
      </p>

      {assessments.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {assessments.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {a.assessmentNumber} · {taxSectionLabel(a.taxSection)}
                </span>
                <Badge status={a.paymentStatus} />
              </div>
              <p className="mt-1 text-slate-700">
                {taxPartyRoleLabel(a.partyRole)} {a.partyName}
                {a.partyCnic ? ` · ${a.partyCnic}` : ""}
              </p>
              <p className="mt-1 text-slate-600">
                DC {formatCurrency(a.dcValueSnapshot)} · {filerStatusLabel(a.filerStatus)} ·{" "}
                {formatPercent(a.ratePercent)} · {formatCurrency(a.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Recorded {formatDate(a.createdAt)}
                {a.paymentStatus === "PAID"
                  ? ` · challan ${a.challanNumber || "—"} · CPR ${a.cprNumber || "—"}`
                  : ""}
              </p>
              <div className="mt-2">
                <PrintButton href={`/tax/${a.id}/print`} label="Print tax slip" size="sm" />
              </div>
              {a.paymentStatus === "UNPAID" && canMarkPaid ? (
                <ConfirmActionForm
                  action={bindFormAction(markFbrTaxPaid)}
                  confirmTitle={`Mark ${taxSectionShort(a.taxSection)} paid?`}
                  confirmDescription="This records challan/CPR against the existing snapshot. DC value, rate, and amount will not change."
                  submitLabel="Record FBR payment"
                  size="sm"
                  variant="outline"
                  className="mt-3 space-y-2"
                >
                  <input type="hidden" name="assessmentId" value={a.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`challan-${a.id}`}>PSID / challan</Label>
                      <Input id={`challan-${a.id}`} name="challanNumber" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor={`cpr-${a.id}`}>CPR</Label>
                      <Input id={`cpr-${a.id}`} name="cprNumber" className="mt-1" />
                    </div>
                  </div>
                </ConfirmActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {showCForm ? (
        <TaxRecordForm
          plotId={plotId}
          transferId={transferId}
          openFileId={openFileId}
          taxSection="SECTION_236C"
          dcValueDefault={dcValueDefault}
          filerRate={rates.cFiler}
          nonFilerRate={rates.cNonFiler}
          partyCaption={sellerName}
          submitLabel="Record seller 236C"
        />
      ) : null}

      {showKForm ? (
        <TaxRecordForm
          plotId={plotId}
          transferId={transferId}
          taxSection="SECTION_236K"
          dcValueDefault={dcValueDefault}
          filerRate={rates.kFiler}
          nonFilerRate={rates.kNonFiler}
          partyCaption={purchaserName ?? "purchaser"}
          submitLabel="Record purchaser 236K"
        />
      ) : null}

      {canRecord && allow236K && !hasK && !purchaserName ? (
        <p className="mt-4 text-sm text-amber-800">
          Purchaser 236K is recorded when the buyer is named on the sale transfer — not while the open
          file purchaser is empty.
        </p>
      ) : null}
    </section>
  );
}

function TaxRecordForm({
  plotId,
  transferId,
  openFileId,
  taxSection,
  dcValueDefault,
  filerRate,
  nonFilerRate,
  partyCaption,
  submitLabel,
}: {
  plotId: string;
  transferId?: string | null;
  openFileId?: string | null;
  taxSection: TaxSection;
  dcValueDefault?: string;
  filerRate: number;
  nonFilerRate: number;
  partyCaption: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(bindFormAction(recordFbrTaxAssessment), null);

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      {state?.ok === false ? <FormErrorBanner message={state.message} /> : null}
      <input type="hidden" name={TAX_FORM_FIELDS.plotId} value={plotId} />
      {transferId ? <input type="hidden" name={TAX_FORM_FIELDS.transferId} value={transferId} /> : null}
      {openFileId ? <input type="hidden" name={TAX_FORM_FIELDS.openFileId} value={openFileId} /> : null}
      <FbrTaxRecordFields
        taxSection={taxSection}
        dcValueDefault={dcValueDefault}
        filerRate={filerRate}
        nonFilerRate={nonFilerRate}
        partyCaption={partyCaption}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
