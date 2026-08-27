import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { OfficeForm } from "@/components/offices/office-form";
import { createRegisteredOffice } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/offices");
  }

  return (
    <div>
      <PageHeader
        title="Register Property Office"
        description="Add a private dealer office or a society-land premises with monthly rent."
        actions={
          <Link href="/offices" className="text-sm text-teal-800 hover:underline">
            Back to offices
          </Link>
        }
      />
      {sp.error ? <FormErrorBanner message={sp.error} /> : null}
      <OfficeForm
        action={createRegisteredOffice}
        submitLabel="Register office"
        allowPremisesTypeChange
        showLetterheadUpload
      />
    </div>
  );
}
