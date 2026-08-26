import { auth } from "@/lib/auth";
import { PrintAwareShell } from "@/components/layout/print-aware-shell";
import { Providers } from "@/components/providers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Providers>
      <PrintAwareShell userName={session.user.name} role={session.user.role}>
        {children}
      </PrintAwareShell>
    </Providers>
  );
}
