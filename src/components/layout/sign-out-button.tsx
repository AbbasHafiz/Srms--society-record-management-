"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { getSignOutPath } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  role: Role;
  /** Compact control for the mobile top bar. */
  size?: "default" | "sm";
  /** Light chrome (header) vs dark nav footer. */
  appearance?: "header" | "sidebar";
  className?: string;
};

export function SignOutButton({
  role,
  size = "default",
  appearance = "header",
  className,
}: SignOutButtonProps) {
  const isSidebar = appearance === "sidebar";

  return (
    <Button
      type="button"
      variant={isSidebar ? "outline" : "destructive"}
      size={size}
      aria-label="Log out"
      onClick={() => signOut({ callbackUrl: getSignOutPath(role) })}
      className={cn(
        "font-semibold shadow-sm",
        isSidebar &&
          "w-full border-rose-200 bg-rose-700 text-white hover:bg-rose-800 hover:text-white",
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Log out
    </Button>
  );
}
