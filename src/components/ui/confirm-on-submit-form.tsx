"use client";

import { FormErrorBanner } from "@/components/ui/form-error-banner";

export function ConfirmOnSubmitForm({
  action,
  confirmMessage,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}

export function QueryErrorBanner({ error }: { error?: string | null }) {
  if (!error) return null;
  return <FormErrorBanner message={error} />;
}
