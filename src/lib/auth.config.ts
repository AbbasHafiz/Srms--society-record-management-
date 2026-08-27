import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

/** Edge-safe NextAuth config (no Prisma / Node-only imports). */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.employeeId = token.employeeId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
