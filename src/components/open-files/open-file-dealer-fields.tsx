"use client";

import { useState } from "react";
import Link from "next/link";
import type { RegisteredOfficeOption } from "@/components/offices/registered-office-select";
import { RegisteredOfficeSelect } from "@/components/offices/registered-office-select";

type Props = {
  required?: boolean;
};

export function OpenFileDealerFields({ required = true }: Props) {
  const [office, setOffice] = useState<RegisteredOfficeOption | null>(null);

  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          Registered dealer <span className="text-rose-700">*</span>
        </span>
        <RegisteredOfficeSelect onSelect={setOffice} />
        <p className="mt-1 text-xs text-slate-500">
          The dealer must already be on the society register (active office).{" "}
          <Link href="/offices/new" className="text-teal-800 hover:underline">
            Register a dealer office
          </Link>{" "}
          first if they are not listed. Their letterhead must state the file should be made open
          transfer. Upload that scan on this form.
        </p>
      </label>
      {required ? (
        <input type="hidden" name="dealerRequired" value="1" />
      ) : null}
      {office ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Dealer / office</dt>
            <dd className="font-medium text-slate-900">{office.officeName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Owner / proprietor</dt>
            <dd>{office.ownerName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Licence</dt>
            <dd>{office.licenseNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Address</dt>
            <dd>{office.address ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-amber-800">Select a registered dealer to continue.</p>
      )}
    </div>
  );
}
