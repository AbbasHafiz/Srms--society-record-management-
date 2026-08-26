"use client";

import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { getSignOutPath } from "@/lib/auth-redirect";

export function SignOutButton({ role }: { role: Role }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: getSignOutPath(role) })}
      className="text-xs text-slate-400 underline hover:text-white"
    >
      Sign out
    </button>
  );
}
