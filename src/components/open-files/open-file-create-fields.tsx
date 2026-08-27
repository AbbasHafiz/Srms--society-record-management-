"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  OPEN_FILE_CONSIDERATION_METHODS,
  OPEN_FILE_HOLDER_TYPES,
  OPEN_FILE_SUPPORTING_DOC_TYPES,
  holderTypeLabel,
} from "@/lib/open-files-shared";
import { poaKindLabel, poaPurposeLabel } from "@/lib/poa-shared";
import { labelize } from "@/lib/utils";

export type SalePoaOption = {
  id: string;
  poaNumber: string;
  kind: string;
  purpose: string;
  attorneyName: string;
  attorneyCnic: string;
};

type Charge = {
  id: string;
  year: number;
  month: number | null;
  amount: string;
};

export function OpenFileCreateFields({
  salePoas,
  plotId,
  charges,
  isSuperAdmin,
}: {
  salePoas: SalePoaOption[];
  plotId: string;
  charges: Charge[];
  isSuperAdmin: boolean;
}) {
  const [appearance, setAppearance] = useState<"IN_PERSON" | "VIA_ATTORNEY">("IN_PERSON");
  const [holderType, setHolderType] = useState<(typeof OPEN_FILE_HOLDER_TYPES)[number]>("INVESTOR");
  const [method, setMethod] = useState<(typeof OPEN_FILE_CONSIDERATION_METHODS)[number]>("BANK_TRANSFER");

  return (
    <>
      <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">XYZ — investor or dealer who paid the seller</h2>
        <p className="text-xs text-slate-600">
          The seller sold to this person. They are not the eventual end-buyer. End purchaser details stay
          empty until a later buyer purchases the open file.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Type</span>
          <select
            name="holderType"
            value={holderType}
            onChange={(e) => setHolderType(e.target.value as typeof holderType)}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {OPEN_FILE_HOLDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {holderTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">XYZ full name</span>
            <Input name="holderName" required placeholder="Investor or dealer name" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">XYZ CNIC</span>
            <Input name="holderCnic" required placeholder="12345-1234567-1" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contact</span>
            <Input name="holderContact" placeholder="03xx-xxxxxxx" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Address</span>
            <Input name="holderAddress" />
          </label>
        </div>
      </section>

      <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Seller received payment from XYZ</h2>
        <p className="text-xs text-slate-600">
          Private sale consideration between seller and XYZ. Distinct from society fees. A new row is
          recorded; nothing is overwritten.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Amount (PKR)</span>
            <Input name="considerationAmount" type="number" min={1} step="1" required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Date received</span>
            <Input
              name="considerationDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Method</span>
            <select
              name="considerationMethod"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {OPEN_FILE_CONSIDERATION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {labelize(m)}
                </option>
              ))}
            </select>
          </label>
          {method === "OTHER" ? (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Specify method</span>
              <Input name="considerationMethodOther" required />
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Notes (optional)</span>
            <Input name="considerationRemarks" placeholder="e.g. paid at dealer office" />
          </label>
        </div>
      </section>

      <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Documents handed to XYZ</h2>
        <p className="text-xs text-slate-600">
          Real scans only. Allotment letter is required; other plot papers are optional.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Allotment letter scan <span className="text-rose-700">*</span>
          </span>
          <Input
            name="allotmentLetter"
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPEN_FILE_SUPPORTING_DOC_TYPES.map((doc) => (
            <label key={doc.key} className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">{doc.label} (optional)</span>
              <Input name={doc.key} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />
            </label>
          ))}
        </div>
      </section>

      <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Seller clears pending society dues</h2>
        {charges.length === 0 ? (
          <p className="text-sm text-emerald-800">No outstanding plot dues on record for this plot.</p>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              Tick each outstanding due to record payment now. Opening is blocked while dues remain,
              unless a SUPER_ADMIN records an override reason.
            </p>
            <ul className="space-y-2">
              {charges.map((c) => (
                <li key={c.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="clearChargeId" value={c.id} className="mt-1" defaultChecked />
                    <span>
                      {c.year}
                      {c.month ? `-${String(c.month).padStart(2, "0")}` : ""} · PKR {c.amount}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {isSuperAdmin ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  SUPER_ADMIN override reason (if any dues left uncleared)
                </span>
                <Input name="duesOverrideReason" placeholder="Why the file may open with remaining dues" />
              </label>
            ) : (
              <p className="text-xs text-amber-800">
                Leave a charge unticked and the file cannot be opened until it is paid.
              </p>
            )}
          </>
        )}
      </section>

      <section className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">How the seller appears</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sellerAppearance"
            value="IN_PERSON"
            checked={appearance === "IN_PERSON"}
            onChange={() => setAppearance("IN_PERSON")}
            className="mt-1"
          />
          <span>Seller appearing in person at society</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="sellerAppearance"
            value="VIA_ATTORNEY"
            checked={appearance === "VIA_ATTORNEY"}
            onChange={() => setAppearance("VIA_ATTORNEY")}
            className="mt-1"
          />
          <span>Seller appearing via attorney (abroad or unwell)</span>
        </label>
        {appearance === "VIA_ATTORNEY" ? (
          <div className="rounded-md bg-slate-50 p-3">
            {salePoas.length === 0 ? (
              <p className="text-sm text-rose-800">
                No active sale PoA for this plot/owner.{" "}
                <Link href={`/poa/new?plotId=${plotId}`} className="font-medium underline">
                  Register and activate a general / sale PoA
                </Link>{" "}
                first.
              </p>
            ) : (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Active sale PoA</span>
                <select
                  name="powerOfAttorneyId"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Select PoA</option>
                  {salePoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.poaNumber} · {p.attorneyName} · {poaKindLabel(p.kind)} ({poaPurposeLabel(p.purpose)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Attorney identity is taken from the PoA record. Attorney must present identity and plot
                  documents at society.
                </p>
              </label>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
