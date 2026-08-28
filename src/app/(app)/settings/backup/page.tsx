import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBackup } from "@/lib/rbac";
import { getBackupToolStatus } from "@/lib/backup";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { BackupPanel } from "./backup-panel";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function BackupSettingsPage() {
  const session = await auth();
  if (!session?.user || !canManageBackup(session.user.role)) {
    redirect("/settings");
  }

  const [lastDownload, tools] = await Promise.all([
    prisma.backupEvent.findFirst({
      where: { kind: "DOWNLOAD" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, filename: true },
    }),
    getBackupToolStatus(),
  ]);

  const missing: string[] = [];
  if (!tools.pgDump) missing.push("pg_dump");
  if (!tools.pgRestore) missing.push("pg_restore");
  if (!tools.zip) missing.push("zip");
  if (!tools.unzip) missing.push("unzip");
  const toolWarning =
    missing.length > 0
      ? `Missing on this server: ${missing.join(", ")}. Install postgresql-client (and zip/unzip) so backup and restore can run.`
      : null;

  const lastDownloadLabel = lastDownload
    ? `${formatDateTime(lastDownload.createdAt)} (${relativeTime(lastDownload.createdAt)})`
    : null;

  return (
    <div>
      <PageHeader
        title="Backup & restore"
        description="Download a full copy of the database and uploaded files, or replace this server from a zip produced here. Super Admin and GM only."
        actions={
          <Link href="/settings" className="text-sm text-teal-800 hover:underline">
            Back to settings
          </Link>
        }
      />
      <BackupPanel lastDownloadLabel={lastDownloadLabel} toolWarning={toolWarning} />
    </div>
  );
}
