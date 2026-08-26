import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "schedule", label: "Schedule", href: "/tankers" },
  { id: "stock", label: "Bulk stock", href: "/tankers/stock" },
  { id: "fleet", label: "Fleet", href: "/tankers/fleet" },
  { id: "slots", label: "Time slots", href: "/tankers/slots" },
] as const;

export type TankerNavTab = (typeof TABS)[number]["id"];

export function TankerNav({ active }: { active: TankerNavTab }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-teal-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
