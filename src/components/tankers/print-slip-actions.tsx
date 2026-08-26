"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrintSlipActions({
  autoPrint = false,
  backHref,
  backLabel = "Back to booking",
}: {
  autoPrint?: boolean;
  backHref: string;
  backLabel?: string;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-2">
      <Button type="button" onClick={() => window.print()}>
        Print slip
      </Button>
      <Link href={backHref}>
        <Button type="button" variant="outline">
          {backLabel}
        </Button>
      </Link>
    </div>
  );
}
