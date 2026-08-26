"use client";

import { useMemo, useState } from "react";
import {
  ALL_DEVELOPMENT_STATUSES,
  ALL_PLOT_TYPES,
  ALL_POSSESSION_STATUSES,
  plotTypeLabel,
} from "@/lib/plots";
import { OtherSpecify } from "@/components/ui/other-specify";
import { labelize } from "@/lib/utils";

type SizeOption = {
  id: string;
  propertyType: string;
  label: string;
  sizeValue: string;
  unit: string;
  sizeMarla: string | null;
};

export function PlotPropertyDetailsFields({
  sizeOptions,
  defaultPlotType = "RESIDENTIAL",
  defaultOtherDetail = "",
}: {
  sizeOptions: SizeOption[];
  defaultPlotType?: string;
  defaultOtherDetail?: string;
}) {
  const [plotType, setPlotType] = useState(defaultPlotType);
  const [catalogId, setCatalogId] = useState("");
  const [sizeMarla, setSizeMarla] = useState("");
  const [sizeSqYd, setSizeSqYd] = useState("");

  const filtered = useMemo(
    () => sizeOptions.filter((o) => o.propertyType === plotType),
    [sizeOptions, plotType]
  );

  function onPlotTypeChange(type: string) {
    setPlotType(type);
    setCatalogId("");
  }

  function applyCatalog(id: string) {
    setCatalogId(id);
    if (!id) return;
    const option = sizeOptions.find((o) => o.id === id);
    if (!option) return;

    const value = Number(option.sizeValue);
    if (option.unit === "SQ_YD") {
      setSizeSqYd(String(value));
      setSizeMarla(
        option.sizeMarla
          ? String(Number(option.sizeMarla))
          : String(Math.round((value / 25) * 100) / 100)
      );
    } else {
      setSizeSqYd("");
      setSizeMarla(
        option.sizeMarla ? String(Number(option.sizeMarla)) : String(Math.max(1, value / 225))
      );
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Property type
        </label>
        <select
          name="plotType"
          value={plotType}
          onChange={(e) => onPlotTypeChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {ALL_PLOT_TYPES.map((t) => (
            <option key={t} value={t}>
              {plotTypeLabel(t)}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={plotType}
          label="Specify property type"
          placeholder="e.g. Community centre, graveyard"
          defaultValue={defaultOtherDetail}
          className="mt-2"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Standard size (catalog)
        </label>
        <select
          value={catalogId}
          onChange={(e) => applyCatalog(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Custom size — enter below</option>
          {filtered.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Select a society standard size or override with custom marla / sq yd values.
        </p>
      </div>

      <Field
        label="Size (marla)"
        name="sizeMarla"
        type="number"
        required
        step="0.01"
        value={sizeMarla}
        onChange={setSizeMarla}
        placeholder="10"
      />
      <Field
        label="Size (sq yd)"
        name="sizeSqYd"
        type="number"
        step="0.01"
        value={sizeSqYd}
        onChange={setSizeSqYd}
        placeholder="250"
      />

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Possession status
        </label>
        <select
          name="possessionStatus"
          defaultValue="NOT_APPLIED"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {ALL_POSSESSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "NOT_APPLIED" ? "No possession / Not applied" : labelize(s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Development status
        </label>
        <select
          name="developmentStatus"
          defaultValue="DEVELOPED"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {ALL_DEVELOPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  step,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      />
    </div>
  );
}
