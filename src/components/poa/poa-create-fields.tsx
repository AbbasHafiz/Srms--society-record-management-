"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  POA_EXECUTION_PLACES,
  POA_KINDS,
  POA_PURPOSES,
  PRINCIPAL_ABSENCE_REASONS,
  poaKindLabel,
  poaPurposeLabel,
  principalAbsenceLabel,
} from "@/lib/poa-shared";
import { labelize } from "@/lib/utils";
import type { PowerOfAttorneyKind, PowerOfAttorneyPurpose } from "@/generated/prisma/client";

export function PoaCreateFields() {
  const [kind, setKind] = useState<PowerOfAttorneyKind>("GENERAL_SALE");
  const [purpose, setPurpose] = useState<PowerOfAttorneyPurpose>("SALE_OPEN_FILE_TRANSFER");
  const [place, setPlace] = useState<(typeof POA_EXECUTION_PLACES)[number]>("PAKISTAN");
  const [absence, setAbsence] = useState<(typeof PRINCIPAL_ABSENCE_REASONS)[number]>("ABROAD");

  const purposes = useMemo(() => {
    if (kind === "GENERAL_SALE") return POA_PURPOSES.filter((p) => p === "SALE_OPEN_FILE_TRANSFER");
    return POA_PURPOSES;
  }, [kind]);

  return (
    <>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Kind</span>
        <select
          name="kind"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as PowerOfAttorneyKind;
            setKind(next);
            if (next === "GENERAL_SALE") setPurpose("SALE_OPEN_FILE_TRANSFER");
          }}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {POA_KINDS.map((k) => (
            <option key={k} value={k}>
              {poaKindLabel(k)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          General / sale PoA: attorney may appear to sell, open-file, or transfer because the principal is
          abroad or unwell. Special PoA: limited to possession / construction, NOC, or another stated
          purpose.
        </p>
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Purpose</span>
        <select
          name="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as PowerOfAttorneyPurpose)}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {purposes.map((p) => (
            <option key={p} value={p}>
              {poaPurposeLabel(p)}
            </option>
          ))}
        </select>
      </label>

      {purpose === "OTHER" ? (
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Describe the special purpose</span>
          <Input name="purposeNotes" required placeholder="e.g. apply for electricity connection" />
        </label>
      ) : (
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Purpose notes (optional)</span>
          <Input name="purposeNotes" />
        </label>
      )}

      {(kind === "GENERAL_SALE" || absence) && (
        <>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Why the principal cannot appear</span>
            <select
              name="principalAbsenceReason"
              value={absence}
              onChange={(e) => setAbsence(e.target.value as typeof absence)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {PRINCIPAL_ABSENCE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {principalAbsenceLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Absence notes</span>
            <Input name="principalAbsenceNotes" placeholder="e.g. working in Dubai, hospitalised" />
          </label>
        </>
      )}

      <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
        <p className="mb-3 text-sm font-medium text-slate-800">Attorney holder</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Full name</span>
            <Input name="attorneyName" required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">CNIC</span>
            <Input name="attorneyCnic" required placeholder="12345-1234567-1" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contact</span>
            <Input name="attorneyContact" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Address</span>
            <Input name="attorneyAddress" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">CNIC front scan</span>
            <Input
              name="attorneyCnicFront"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">CNIC back scan</span>
            <Input
              name="attorneyCnicBack"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            />
          </label>
        </div>
      </div>

      <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
        <p className="mb-3 text-sm font-medium text-slate-800">Executed by principal</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Execution date</span>
            <Input name="executedAt" type="date" required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Place</span>
            <select
              name="executionPlace"
              value={place}
              onChange={(e) => setPlace(e.target.value as typeof place)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {POA_EXECUTION_PLACES.map((p) => (
                <option key={p} value={p}>
                  {labelize(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              {place === "ABROAD" ? "City / country" : "City / tehsil"}
            </span>
            <Input name="executionCity" placeholder={place === "ABROAD" ? "e.g. Dubai, UAE" : "e.g. Islamabad"} />
          </label>
          {place === "ABROAD" || absence === "ABROAD" ? (
            <p className="sm:col-span-2 text-xs text-amber-800">
              Principal is abroad — after Tehsildar verification, Foreign Office / Pakistani mission
              attestation is required before society can accept this PoA.
            </p>
          ) : null}
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Valid until (optional)</span>
            <Input name="validUntil" type="date" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Executed PoA instrument scan <span className="text-rose-700">*</span>
            </span>
            <Input
              name="instrument"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            />
          </label>
        </div>
      </div>
    </>
  );
}
