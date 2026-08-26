"use client";

import { useState } from "react";
import { OtherSpecify } from "@/components/ui/other-specify";
import { HEIR_RELATION_LABELS } from "@/lib/death-transfer";

export function HeirRelationFields({
  defaultRelation = "SON",
  defaultOtherDetail = "",
}: {
  defaultRelation?: string;
  defaultOtherDetail?: string;
}) {
  const [relation, setRelation] = useState(defaultRelation);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">Relation to deceased</label>
      <select
        name="relationToDeceased"
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      >
        {Object.entries(HEIR_RELATION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <OtherSpecify
        selectedValue={relation}
        label="Specify relation"
        placeholder="e.g. Nephew, legal guardian"
        defaultValue={defaultOtherDetail}
        className="mt-2"
      />
    </div>
  );
}
