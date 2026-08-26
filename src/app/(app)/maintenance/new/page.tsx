import { auth } from "@/lib/auth";
import { canManageMaintenance } from "@/lib/maintenance";
import { PageHeader } from "@/components/ui/page";
import { MaintenanceNewForm } from "@/components/maintenance/maintenance-new-form";

export const dynamic = "force-dynamic";

export default async function NewMaintenancePage() {
  const session = await auth();
  if (!session?.user || !canManageMaintenance(session.user.role)) {
    return (
      <div>
        <PageHeader title="New maintenance job" description="You do not have permission to add jobs." />
      </div>
    );
  }

  return <MaintenanceNewForm />;
}
