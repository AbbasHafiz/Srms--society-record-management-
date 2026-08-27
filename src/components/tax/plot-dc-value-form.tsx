"use client";

import { bindFormAction } from "@/lib/action-result";
import { updatePlotDcValue } from "@/app/(app)/tax/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { useActionState } from "react";

export function PlotDcValueForm({
  plotId,
  currentDcValue,
}: {
  plotId: string;
  currentDcValue?: string | null;
}) {
  const [state, action, pending] = useActionState(bindFormAction(updatePlotDcValue), null);

  return (
    <form action={action} className="space-y-3">
      {state?.ok === false ? <FormErrorBanner message={state.message} /> : null}
      <input type="hidden" name="plotId" value={plotId} />
      <div>
        <Label htmlFor="dcValue">DC value (PKR)</Label>
        <Input
          id="dcValue"
          name="dcValue"
          type="number"
          min={1}
          step="1"
          required
          className="mt-1"
          defaultValue={currentDcValue ?? ""}
          placeholder="Deputy Commissioner valuation"
        />
        <p className="mt-1 text-xs text-slate-500">
          Society-set figure used for FBR 236C (seller) and 236K (purchaser). Changing it does not
          rewrite tax already snapped against a transfer or open file.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save DC value"}
      </Button>
    </form>
  );
}
