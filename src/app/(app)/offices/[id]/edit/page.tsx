import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { plotLabel } from "@/lib/plots";
import { PageHeader } from "@/components/ui/page";
import { OfficeForm } from "@/components/offices/office-form";
import { updateRegisteredOffice } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditOfficePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || (!hasPermission(session.user.role, "edit") && !hasPermission(session.user.role, "create"))) {
    redirect(`/offices/${id}`);
  }

  const office = await prisma.registeredOffice.findUnique({
    where: { id },
    include: { plot: true },
  });
  if (!office) notFound();

  return (
    <div>
      <PageHeader
        title={`Edit — ${office.officeName}`}
        description="Update office contact details and rent or license information."
        actions={
          <Link href={`/offices/${office.id}`} className="text-sm text-teal-800 hover:underline">
            Back to office
          </Link>
        }
      />
      <OfficeForm
        action={updateRegisteredOffice}
        officeId={office.id}
        submitLabel="Save changes"
        allowPremisesTypeChange={false}
        initial={{
          officeName: office.officeName,
          ownerName: office.ownerName,
          phone: office.phone,
          email: office.email,
          address: office.address,
          premisesType: office.premisesType,
          plotId: office.plotId,
          plotLabel: office.plot ? plotLabel(office.plot) : null,
          rentAmount: office.rentAmount != null ? Number(office.rentAmount) : null,
          rentStartDate: office.rentStartDate,
          licenseNumber: office.licenseNumber,
          registrationDate: office.registrationDate,
          expiryDate: office.expiryDate,
          status: office.status,
          remarks: office.remarks,
        }}
      />
    </div>
  );
}
