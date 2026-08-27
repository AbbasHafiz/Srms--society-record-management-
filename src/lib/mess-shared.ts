import type { MealType } from "@/generated/prisma/client";

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "TEA", label: "Tea / snacks" },
  { value: "OTHER", label: "Other" },
];
