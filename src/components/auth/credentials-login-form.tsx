"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPostLoginPath } from "@/lib/auth-redirect";

type LoginVariant = "main" | "tanker";

const VARIANTS: Record<
  LoginVariant,
  {
    title: string;
    subtitle: string;
    defaultEmail: string;
    demoHint: React.ReactNode;
    footerLink?: { href: string; label: string };
    gradient: string;
    headerClass: string;
  }
> = {
  main: {
    title: "Society Records",
    subtitle: "Property, Plot Transfer & Physical File Management",
    defaultEmail: "admin@society.local",
    demoHint: (
      <>
        Demo: <strong>admin@society.local</strong> / <strong>password123</strong>
        <br />
        Also: transfer@, finance@, records@, gm@, secretary@, security@society.local
      </>
    ),
    footerLink: { href: "/login/tanker", label: "Tanker staff sign in" },
    gradient: "linear-gradient(135deg, #0b1f1c 0%, #115e59 45%, #1e3a4c 100%)",
    headerClass: "from-teal-950 to-teal-800",
  },
  tanker: {
    title: "Tanker Desk",
    subtitle: "Water Tanker Booking & Daily Schedule",
    defaultEmail: "tanker@society.local",
    demoHint: (
      <>
        Demo: <strong>tanker@society.local</strong> / <strong>password123</strong>
        <br />
        Driver desk: <strong>driver@society.local</strong> / <strong>password123</strong>
      </>
    ),
    footerLink: { href: "/login", label: "Society admin sign in" },
    gradient: "linear-gradient(135deg, #0c2340 0%, #1d4ed8 45%, #0e7490 100%)",
    headerClass: "from-blue-950 to-cyan-800",
  },
};

export function CredentialsLoginForm({ variant }: { variant: LoginVariant }) {
  const router = useRouter();
  const config = VARIANTS[variant];
  const [email, setEmail] = useState(config.defaultEmail);
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    const session = await getSession();
    const destination = getPostLoginPath(session?.user?.role ?? "VIEWER");

    router.push(destination);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `${config.gradient}, radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 40%)`,
        }}
      />
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className={`bg-gradient-to-r px-6 py-8 text-white ${config.headerClass}`}>
          <p className="font-display text-2xl font-bold tracking-tight">{config.title}</p>
          <p className="mt-1 text-sm text-white/90">{config.subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{config.demoHint}</p>
          {config.footerLink ? (
            <p className="text-center text-sm text-slate-600">
              <Link href={config.footerLink.href} className="font-medium text-teal-800 hover:underline">
                {config.footerLink.label}
              </Link>
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
