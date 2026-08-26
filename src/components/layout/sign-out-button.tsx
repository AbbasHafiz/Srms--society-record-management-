"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-slate-400 underline hover:text-white"
    >
      Sign out
    </button>
  );
}
