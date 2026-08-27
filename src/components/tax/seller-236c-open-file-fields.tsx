"use client";

import { FbrTaxRecordFields } from "@/components/tax/fbr-tax-record-fields";

export function Seller236COpenFileFields({
  dcValueDefault,
  filerRate,
  nonFilerRate,
  sellerName,
}: {
  dcValueDefault?: string;
  filerRate: number;
  nonFilerRate: number;
  sellerName: string;
}) {
  return (
    <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Seller FBR 236C (on DC value)</h2>
      <p className="text-xs text-slate-600">
        Open files record seller 236C only. Purchaser 236K is not assessed yet — the end buyer is empty
        until a later name transfer.
      </p>
      <FbrTaxRecordFields
        taxSection="SECTION_236C"
        dcValueDefault={dcValueDefault}
        filerRate={filerRate}
        nonFilerRate={nonFilerRate}
        partyCaption={sellerName}
      />
    </section>
  );
}
