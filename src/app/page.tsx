import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPostLoginPath } from "@/lib/auth-redirect";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(getPostLoginPath(session.user.role));
  }
  redirect("/login");
}
