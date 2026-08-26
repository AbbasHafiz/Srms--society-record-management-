"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const OTHER_SELECT_VALUE = "OTHER";

type OtherSpecifyProps = {
  selectedValue: string;
  otherValue?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
};

/** Required text input shown when a closed-list value is Other / not listed. */
export function OtherSpecify({
  selectedValue,
  otherValue = OTHER_SELECT_VALUE,
  name = "otherDetail",
  label = "Please specify",
  placeholder,
  defaultValue,
  required = true,
  className,
}: OtherSpecifyProps) {
  if (selectedValue !== otherValue) return null;

  return (
    <label className={cn("block text-sm", className)}>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1"
      />
    </label>
  );
}

type SelectOption = { value: string; label: string };

type SelectWithOtherProps = {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  otherValue?: string;
  otherDetailName?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  otherDefaultValue?: string;
  label?: string;
  required?: boolean;
  className?: string;
  selectClassName?: string;
};

export function SelectWithOther({
  name,
  options,
  defaultValue,
  otherValue = OTHER_SELECT_VALUE,
  otherDetailName = "otherDetail",
  otherLabel = "Please specify",
  otherPlaceholder,
  otherDefaultValue,
  label,
  required = true,
  className,
  selectClassName,
}: SelectWithOtherProps) {
  const initial = defaultValue ?? options[0]?.value ?? "";
  const [value, setValue] = useState(initial);

  return (
    <div className={className}>
      {label ? (
        <Label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      <select
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm",
          selectClassName
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <OtherSpecify
        selectedValue={value}
        otherValue={otherValue}
        name={otherDetailName}
        label={otherLabel}
        placeholder={otherPlaceholder}
        defaultValue={otherDefaultValue}
        required={required}
        className="mt-2"
      />
    </div>
  );
}
