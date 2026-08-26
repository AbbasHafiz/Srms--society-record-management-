"use client";

import { useState } from "react";
import { MEAL_TYPE_OPTIONS } from "@/lib/mess";
import { OtherSpecify } from "@/components/ui/other-specify";

export function MessMealTypeFields({
  defaultMealType = "LUNCH",
  defaultOtherDetail = "",
}: {
  defaultMealType?: string;
  defaultOtherDetail?: string;
}) {
  const [mealType, setMealType] = useState(defaultMealType);

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Meal type *</span>
      <select
        name="mealType"
        value={mealType}
        onChange={(e) => setMealType(e.target.value)}
        required
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      >
        {MEAL_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <OtherSpecify
        selectedValue={mealType}
        label="Specify meal type"
        placeholder="e.g. Iftar, special event catering"
        defaultValue={defaultOtherDetail}
        className="mt-2"
      />
    </label>
  );
}
