import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DuesSlipAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  redirect(`/plot-status${params.toString() ? `?${params.toString()}` : ""}`);
}
