import type { Role } from "@/generated/prisma/client";

export function getPostLoginPath(role: Role): string {
  if (role === "TANKER_OPERATOR") return "/tankers";
  return "/dashboard";
}

export function getSignOutPath(role: Role): string {
  if (role === "TANKER_OPERATOR") return "/login/tanker";
  return "/login";
}
