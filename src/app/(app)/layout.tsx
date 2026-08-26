import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar userName={session.user.name} role={session.user.role} />
      <main className="safe-pad flex-1 overflow-x-hidden px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
