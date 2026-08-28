import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExcelExportLink({
  href,
  label = "Export Excel",
  size = "default",
}: {
  href: string;
  label?: string;
  size?: "default" | "sm";
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white font-medium hover:bg-slate-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"
      )}
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}
