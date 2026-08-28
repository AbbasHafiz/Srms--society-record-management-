"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { AppSidebar } from "@/components/layout/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { isPrintDocumentPath } from "@/lib/print";

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
  const isPrintRoute = isPrintDocumentPath(pathname);

  if (isPrintRoute) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppSidebar userName={userName} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 hidden items-center justify-end border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur lg:flex">
          <SignOutButton role={role} appearance="header" />
        </header>
        <main className="safe-pad flex-1 overflow-x-hidden px-4 py-5 md:px-8 md:py-7">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
