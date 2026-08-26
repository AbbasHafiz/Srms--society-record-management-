"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPinned,
  ArrowLeftRight,
  Users,
  FileText,
  Home,
  ShieldCheck,
  ScrollText,
  Landmark,
  FolderOpen,
  Wallet,
  Archive,
  UserCog,
  CalendarCheck,
  Droplets,
  Truck,
  BarChart3,
  ClipboardList,
  Settings,
  Search,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plots", label: "Plots", icon: MapPinned },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/owners", label: "Owners", icon: Users },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/possession", label: "Possession", icon: Home },
  { href: "/noc", label: "NOC", icon: ShieldCheck },
  { href: "/nec", label: "NEC", icon: ScrollText },
  { href: "/mortgages", label: "Bank / Mortgage", icon: Landmark },
  { href: "/open-files", label: "Open Files", icon: FolderOpen },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/physical-files", label: "Physical Files", icon: Archive },
  { href: "/employees", label: "Employees", icon: UserCog },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/tankers", label: "Water Tankers", icon: Droplets },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit", label: "Audit Logs", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-teal-800 text-white shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <SessionProvider>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="font-display text-sm font-semibold text-teal-900">Society Records</p>
          <p className="text-xs text-slate-500">Property & Transfers</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-200 p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-72 flex-col bg-slate-950 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarBrand />
            {nav}
            <SidebarUser name={userName} role={role} />
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-white lg:flex">
        <SidebarBrand />
        {nav}
        <SidebarUser name={userName} role={role} />
      </aside>
    </SessionProvider>
  );
}

function SidebarBrand() {
  return (
    <div className="border-b border-white/10 px-5 py-5">
      <p className="font-display text-lg font-semibold tracking-tight text-white">Society Records</p>
      <p className="mt-0.5 text-xs text-slate-400">Plot · Transfer · File History</p>
      <Link
        href="/search"
        className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/15"
      >
        <Search className="h-3.5 w-3.5" />
        Global search
      </Link>
    </div>
  );
}

function SidebarUser({ name, role }: { name: string; role: string }) {
  return (
    <div className="border-t border-white/10 px-4 py-4">
      <p className="truncate text-sm font-medium text-white">{name}</p>
      <p className="truncate text-xs text-slate-400">{role.replace(/_/g, " ")}</p>
      <div className="mt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
