"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FILER_STATUSES,
  TAX_FORM_FIELDS,
  TAX_PAYMENT_STATUSES,
  computeTaxAmount,
  filerStatusLabel,
  formatPercent,
  taxSectionLabel,
} from "@/lib/fbr-tax-shared";
import { formatCurrency } from "@/lib/utils";
import type { FilerStatus, TaxPaymentStatus, TaxSection } from "@/generated/prisma/client";

export function FbrTaxRecordFields({
  taxSection,
  dcValueDefault,
  filerRate,
  nonFilerRate,
  partyCaption,
}: {
  taxSection: TaxSection;
  dcValueDefault?: string;
  filerRate: number;
  nonFilerRate: number;
  partyCaption: string;
}) {
  const [filerStatus, setFilerStatus] = useState<FilerStatus>("FILER");
  const [paymentStatus, setPaymentStatus] = useState<TaxPaymentStatus>("UNPAID");
  const [dcValue, setDcValue] = useState(dcValueDefault ?? "");

  const rate = filerStatus === "FILER" ? filerRate : nonFilerRate;
  const amount = useMemo(() => {
    const n = Number(String(dcValue).replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return computeTaxAmount(n, rate);
  }, [dcValue, rate]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={TAX_FORM_FIELDS.taxSection} value={taxSection} />
      <p className="text-sm text-slate-600">
        {taxSectionLabel(taxSection)} for {partyCaption}. Tax is calculated on the society DC value using
        the current {filerStatus === "FILER" ? "filer" : "non-filer"} rate ({formatPercent(rate)}).
      </p>
      <div>
        <Label htmlFor={`${taxSection}-dc`}>DC value (PKR)</Label>
        <Input
          id={`${taxSection}-dc`}
          name={TAX_FORM_FIELDS.dcValue}
          type="number"
          min={1}
          step="1"
          required
          className="mt-1"
          value={dcValue}
          onChange={(e) => setDcValue(e.target.value)}
          placeholder="Deputy Commissioner valuation"
        />
      </div>
      <div>
        <Label htmlFor={`${taxSection}-filer`}>FBR active taxpayer status</Label>
        <select
          id={`${taxSection}-filer`}
          name={TAX_FORM_FIELDS.filerStatus}
          value={filerStatus}
          onChange={(e) => setFilerStatus(e.target.value as FilerStatus)}
          className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {FILER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {filerStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
        <p>
          Rate: <strong>{formatPercent(rate)}</strong>
        </p>
        <p>
          Tax amount: <strong>{amount > 0 ? formatCurrency(amount) : "—"}</strong>
        </p>
      </div>
      <div>
        <Label htmlFor={`${taxSection}-paid`}>Payment status</Label>
        <select
          id={`${taxSection}-paid`}
          name={TAX_FORM_FIELDS.paymentStatus}
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as TaxPaymentStatus)}
          className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {TAX_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "PAID" ? "Paid (challan / CPR on file)" : "Unpaid"}
            </option>
          ))}
        </select>
      </div>
      {paymentStatus === "PAID" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${taxSection}-challan`}>PSID / challan no.</Label>
            <Input id={`${taxSection}-challan`} name={TAX_FORM_FIELDS.challanNumber} className="mt-1" />
          </div>
          <div>
            <Label htmlFor={`${taxSection}-cpr`}>CPR no.</Label>
            <Input id={`${taxSection}-cpr`} name={TAX_FORM_FIELDS.cprNumber} className="mt-1" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Unpaid is stored against this case. Challan / CPR can be recorded later without changing the
          DC snapshot, rate, or amount.
        </p>
      )}
      <div>
        <Label htmlFor={`${taxSection}-remarks`}>Remarks (optional)</Label>
        <Input id={`${taxSection}-remarks`} name={TAX_FORM_FIELDS.remarks} className="mt-1" />
      </div>
    </div>
  );
}
