"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@society.local");
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
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #0b1f1c 0%, #115e59 45%, #1e3a4c 100%), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 40%)",
        }}
      />
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-teal-950 to-teal-800 px-6 py-8 text-white">
          <p className="font-display text-2xl font-bold tracking-tight">Society Records</p>
          <p className="mt-1 text-sm text-teal-100/90">
            Property, Plot Transfer &amp; Physical File Management
          </p>
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
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Demo: <strong>admin@society.local</strong> / <strong>password123</strong>
            <br />
            Also: transfer@, finance@, records@, gm@, secretary@, security@society.local
          </p>
        </form>
      </div>
    </div>
  );
}
