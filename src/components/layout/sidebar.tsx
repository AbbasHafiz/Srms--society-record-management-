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
  CircleDollarSign,
  Archive,
  UserCog,
  CalendarCheck,
  Droplets,
  Trash2,
  Truck,
  BarChart3,
  ClipboardList,
  Settings,
  Search,
  Menu,
  X,
  Bell,
  IdCard,
  MessageCircle,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { Role } from "@/generated/prisma/client";
import { canAccessModule } from "@/lib/rbac";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/notifications", label: "Notifications", icon: Bell, module: "notifications" },
  { href: "/notifications/whatsapp", label: "WhatsApp Outbox", icon: MessageCircle, module: "notifications/whatsapp" },
  { href: "/plots", label: "Plots", icon: MapPinned, module: "plots" },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight, module: "transfers" },
  { href: "/owners", label: "Ownership", icon: Users, module: "plots" },
  { href: "/memberships", label: "Memberships", icon: IdCard, module: "memberships" },
  { href: "/documents", label: "Documents", icon: FileText, module: "documents" },
  { href: "/possession", label: "Possession", icon: Home, module: "possession" },
  { href: "/noc", label: "NOC", icon: ShieldCheck, module: "documents" },
  { href: "/nec", label: "NEC", icon: ScrollText, module: "documents" },
  { href: "/mortgages", label: "Bank / Mortgage", icon: Landmark, module: "mortgages" },
  { href: "/open-files", label: "Open Files", icon: FolderOpen, module: "open-files" },
  { href: "/payments", label: "Payments", icon: Wallet, module: "payments" },
  { href: "/annual-charges", label: "Annual Charges", icon: Receipt, module: "annual-charges" },
  { href: "/finance", label: "Revenue & Expenses", icon: CircleDollarSign, module: "finance" },
  { href: "/physical-files", label: "Physical Files", icon: Archive, module: "physical-files" },
  { href: "/employees", label: "Employees", icon: UserCog, module: "employees" },
  { href: "/hr", label: "HR", icon: Users, module: "hr" },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, module: "attendance" },
  { href: "/tankers", label: "Water Tankers", icon: Droplets, module: "tankers" },
  { href: "/garbage", label: "Garbage Collection", icon: Trash2, module: "garbage" },
  { href: "/vehicles", label: "Vehicles", icon: Truck, module: "vehicles" },
  { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { href: "/audit", label: "Audit Logs", icon: ClipboardList, module: "audit" },
  { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

const TANKER_NAV_HREFS = new Set(["/dashboard", "/tankers", "/garbage"]);

function navForRole(role: Role) {
  if (role === "TANKER_OPERATOR") {
    return NAV.filter((item) => TANKER_NAV_HREFS.has(item.href));
  }
  return NAV.filter((item) => canAccessModule(role, item.module));
}

export function AppSidebar({ userName, role }: { userName: string; role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navForRole(role);
  const isTankerPortal = role === "TANKER_OPERATOR";

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
      {items.map((item) => {
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
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="font-display text-sm font-semibold text-teal-900">
            {isTankerPortal ? "Tanker Desk" : "Society Records"}
          </p>
          <p className="text-xs text-slate-500">
            {isTankerPortal ? "Water tanker booking" : "Property & Transfers"}
          </p>
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
            <SidebarBrand isTankerPortal={isTankerPortal} />
            {nav}
            <SidebarUser name={userName} role={role} />
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-white lg:flex">
        <SidebarBrand isTankerPortal={isTankerPortal} />
        {nav}
        <SidebarUser name={userName} role={role} />
      </aside>
    </>
  );
}

function SidebarBrand({ isTankerPortal }: { isTankerPortal: boolean }) {
  return (
    <div className="border-b border-white/10 px-5 py-5">
      <p className="font-display text-lg font-semibold tracking-tight text-white">
        {isTankerPortal ? "Tanker Desk" : "Society Records"}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        {isTankerPortal ? "Booking · Schedule · Dispatch" : "Plot · Transfer · File History"}
      </p>
      {!isTankerPortal ? (
        <Link
          href="/search"
          className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/15"
        >
          <Search className="h-3.5 w-3.5" />
          Global search
        </Link>
      ) : null}
    </div>
  );
}

function SidebarUser({ name, role }: { name: string; role: Role }) {
  return (
    <div className="border-t border-white/10 px-4 py-4">
      <p className="truncate text-sm font-medium text-white">{name}</p>
      <p className="truncate text-xs text-slate-400">{role.replace(/_/g, " ")}</p>
      <div className="mt-2">
        <SignOutButton role={role} />
      </div>
    </div>
  );
}
