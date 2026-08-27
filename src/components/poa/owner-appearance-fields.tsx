"use client";

import { useState } from "react";
import Link from "next/link";
import { poaKindLabel, poaPurposeLabel } from "@/lib/poa-shared";

export type PoaOption = {
  id: string;
  poaNumber: string;
  kind: string;
  purpose: string;
  attorneyName: string;
  attorneyCnic: string;
  status: string;
};

export function OwnerAppearanceFields({
  poas,
  newPoaHref,
  requiredWhenAbsent = true,
  legend = "Owner appearing",
}: {
  poas: PoaOption[];
  newPoaHref: string;
  requiredWhenAbsent?: boolean;
  legend?: string;
}) {
  const [inPerson, setInPerson] = useState(true);

  return (
    <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">{legend}</legend>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="radio"
          name="ownerAppearingInPerson"
          value="yes"
          checked={inPerson}
          onChange={() => setInPerson(true)}
          className="mt-1"
        />
        <span>Owner appearing in person</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="radio"
          name="ownerAppearingInPerson"
          value="no"
          checked={!inPerson}
          onChange={() => setInPerson(false)}
          className="mt-1"
        />
        <span>Owner represented by attorney</span>
      </label>
      {!inPerson ? (
        poas.length === 0 ? (
          <p className="text-sm text-rose-800">
            No matching active PoA.{" "}
            <Link href={newPoaHref} className="font-medium underline">
              Register a PoA
            </Link>{" "}
            {requiredWhenAbsent ? "before continuing." : "or continue without one if the owner is present later."}
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Active PoA</span>
            <select
              name="powerOfAttorneyId"
              required={requiredWhenAbsent}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">Select PoA</option>
              {poas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poaNumber} · {p.attorneyName} · {poaKindLabel(p.kind)} ({poaPurposeLabel(p.purpose)})
                </option>
              ))}
            </select>
          </label>
        )
      ) : null}
    </fieldset>
  );
}
