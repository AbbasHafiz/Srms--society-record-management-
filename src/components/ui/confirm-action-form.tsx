"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BoundAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function ConfirmActionForm({
  action,
  confirmTitle,
  confirmDescription,
  submitLabel,
  className,
  children,
  disabled,
  buttonClassName,
  variant = "default",
  size,
}: {
  action: BoundAction;
  confirmTitle: string;
  confirmDescription: string;
  submitLabel: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  buttonClassName?: string;
  variant?: "default" | "outline" | "destructive";
  size?: "default" | "sm" | "lg";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <>
      <form ref={formRef} action={formAction} className={className}>
        {state?.ok === false ? <FormErrorBanner message={state.message} /> : null}
        {children}
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(buttonClassName)}
          disabled={disabled || pending}
          onClick={() => setOpen(true)}
        >
          {pending ? "Working…" : submitLabel}
        </Button>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => {
                setOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
