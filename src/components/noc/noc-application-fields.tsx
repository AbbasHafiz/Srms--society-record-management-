"use client";

import { useState } from "react";
import { OtherSpecify } from "@/components/ui/other-specify";
import { labelize } from "@/lib/utils";

const PURPOSES = [
  { value: "CONSTRUCTION", label: "Build house / Construction" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "GENERAL", label: "General" },
  { value: "UTILITY_CONNECTION", label: "Utility connection" },
  { value: "OTHER", label: "Other" },
];

const CONSTRUCTION_TYPES = [
  { value: "HOUSE", label: "House / Residential building" },
  { value: "BOUNDARY_WALL", label: "Boundary wall" },
  { value: "EXTENSION", label: "Extension / additional floor" },
  { value: "COMMERCIAL_BUILDING", label: "Commercial building" },
  { value: "OTHER", label: "Other" },
];

export function NocApplicationFields({
  defaultPurpose = "GENERAL",
  defaultPurposeOther = "",
  defaultConstructionType = "HOUSE",
  defaultConstructionOther = "",
}: {
  defaultPurpose?: string;
  defaultPurposeOther?: string;
  defaultConstructionType?: string;
  defaultConstructionOther?: string;
}) {
  const [purpose, setPurpose] = useState(defaultPurpose);
  const [constructionType, setConstructionType] = useState(defaultConstructionType);

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          NOC purpose
        </label>
        <select
          name="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={purpose}
          name="customType"
          label="Specify NOC purpose"
          defaultValue={defaultPurposeOther}
          className="mt-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Proposed construction type
        </label>
        <select
          name="constructionType"
          value={constructionType}
          onChange={(e) => setConstructionType(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {CONSTRUCTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={constructionType}
          label="Specify construction type"
          defaultValue={defaultConstructionOther}
          className="mt-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Application notes
        </label>
        <textarea
          name="applicationNotes"
          rows={2}
          placeholder="e.g. Single-storey house, covered area details…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>
    </>
  );
}

export function constructionTypeDisplay(
  type: string | null | undefined,
  otherDetail?: string | null
) {
  if (!type) return "—";
  if (type === "OTHER" && otherDetail) return otherDetail;
  return labelize(type);
}
