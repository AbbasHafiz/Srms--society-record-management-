/** Shared helpers for dropdown + "Other (specify)" form patterns. */

export const OTHER_SELECT_VALUE = "OTHER";

export const OTHER_TRIGGER_VALUES = ["OTHER", "CUSTOM"] as const;

export type OtherTriggerValue = (typeof OTHER_TRIGGER_VALUES)[number];

export function isOtherSelection(
  value: string,
  triggerValues: readonly string[] = OTHER_TRIGGER_VALUES
) {
  return triggerValues.includes(value);
}

/** Require `otherDetail` when the selected enum/value is Other. */
export function requireOtherDetail(
  formData: FormData,
  selectedValue: string,
  options?: {
    otherFieldName?: string;
    otherValue?: string;
    message?: string;
  }
): string | null {
  const otherValue = options?.otherValue ?? OTHER_SELECT_VALUE;
  const fieldName = options?.otherFieldName ?? "otherDetail";
  if (selectedValue !== otherValue) return null;
  const detail = String(formData.get(fieldName) || "").trim();
  if (!detail) throw new Error(options?.message ?? "Please specify");
  return detail;
}

/** Require `customType` when the selected enum/value is Other. */
export function requireCustomType(
  formData: FormData,
  selectedValue: string,
  options?: {
    customFieldName?: string;
    otherValue?: string;
    message?: string;
  }
): string | null {
  const otherValue = options?.otherValue ?? OTHER_SELECT_VALUE;
  const fieldName = options?.customFieldName ?? "customType";
  if (selectedValue !== otherValue) return null;
  const detail = String(formData.get(fieldName) || "").trim();
  if (!detail) throw new Error(options?.message ?? "Please specify");
  return detail;
}

export function resolveOtherValue(
  formData: FormData,
  selectName: string,
  specifyName: string,
  options?: {
    triggerValues?: readonly string[];
    fieldLabel?: string;
  }
): string {
  const selected = String(formData.get(selectName) || "").trim();
  const specify = String(formData.get(specifyName) || "").trim();
  const triggers = options?.triggerValues ?? OTHER_TRIGGER_VALUES;
  const label = options?.fieldLabel ?? specifyName;

  if (isOtherSelection(selected, triggers)) {
    if (!specify) throw new Error(`Please specify ${label}`);
    return specify;
  }

  return selected;
}

export function resolveCustomWorkType(formData: FormData): string {
  return resolveOtherValue(formData, "workType", "customType", {
    fieldLabel: "maintenance type",
  });
}

export function resolveOtherOrNull(
  formData: FormData,
  selectName: string,
  specifyName: string,
  options?: {
    triggerValues?: readonly string[];
    fieldLabel?: string;
  }
): string | null {
  const raw = String(formData.get(selectName) || "").trim();
  if (!raw) return null;
  const triggers = options?.triggerValues ?? OTHER_TRIGGER_VALUES;
  if (!isOtherSelection(raw, triggers)) return raw;
  const specify = String(formData.get(specifyName) || "").trim();
  if (!specify) throw new Error(`Please specify ${options?.fieldLabel ?? specifyName}`);
  return specify;
}

export function appendOtherNote(
  base: string | null | undefined,
  label: string,
  otherText: string | null | undefined
): string | null {
  const trimmed = otherText?.trim();
  if (!trimmed) return base?.trim() || null;
  const note = `${label}: ${trimmed}`;
  const existing = base?.trim();
  return existing ? `${existing} · ${note}` : note;
}
