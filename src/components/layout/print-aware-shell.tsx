"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { AppSidebar } from "@/components/layout/sidebar";

export function PrintAwareShell({
  userName,
  role,
  children,
}: {
  userName: string;
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPrintRoute = pathname.includes("/print");

  if (isPrintRoute) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar userName={userName} role={role} />
      <main className="safe-pad flex-1 overflow-x-hidden px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
