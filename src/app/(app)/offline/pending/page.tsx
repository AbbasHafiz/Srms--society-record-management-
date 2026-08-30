import { PageHeader } from "@/components/ui/page";
import { OfflineQueueClient } from "@/components/offline/offline-queue-client";

export default function OfflinePendingPage() {
  return (
    <div>
      <PageHeader
        title="Offline queue"
        description="Entries saved on this device while the office was offline. They are not on the society ledger until they sync. Transfers cannot be completed from this queue."
      />
      <OfflineQueueClient />
    </div>
  );
}
