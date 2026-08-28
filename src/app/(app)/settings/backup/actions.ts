"use server";

import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { canManageBackup } from "@/lib/rbac";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import {
  inspectBackupZip,
  looksLikeRejectedUpload,
  MAX_BACKUP_BYTES,
  publicErrorMessage,
  RESTORE_CONFIRM_PHRASE,
  restoreAppBackup,
  writeUploadedBackup,
} from "@/lib/backup";

export async function restoreBackupAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !canManageBackup(session.user.role)) {
    return actionFail("You do not have permission to restore a backup.");
  }

  const phrase = String(formData.get("confirmPhrase") ?? "").trim();
  const replaceOk = formData.get("replaceAcknowledged") === "on";
  const currentBackupOk = formData.get("backupAcknowledged") === "on";
  if (!replaceOk || !currentBackupOk) {
    return actionFail("Tick both confirmation boxes before restoring.");
  }
  if (phrase !== RESTORE_CONFIRM_PHRASE) {
    return actionFail(`Type ${RESTORE_CONFIRM_PHRASE} in capitals to confirm. This cannot be undone.`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return actionFail("Choose a backup zip downloaded from this page.");
  }
  const rejected = looksLikeRejectedUpload(file);
  if (rejected) return actionFail(rejected);
  if (file.size > MAX_BACKUP_BYTES) {
    return actionFail("Backup file is too large (limit 512 MB). Restore from the VPS cron copy instead.");
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "srms-restore-upload-"));
  const zipPath = path.join(tmpDir, `${randomUUID()}.zip`);

  try {
    await writeUploadedBackup(file, zipPath);
    await inspectBackupZip(zipPath);
    const manifest = await restoreAppBackup(zipPath);

    try {
      await prisma.backupEvent.create({
        data: {
          kind: "RESTORE",
          filename: file.name.slice(0, 200),
          byteSize: file.size > 2147483647 ? null : file.size,
          createdById: session.user.id,
          notes: manifest.createdAt ? `Restored backup created ${manifest.createdAt}` : null,
        },
      });
      await writeAuditLog({
        userId: session.user.id,
        action: "BACKUP_RESTORED",
        module: "settings",
        newValue: { filename: file.name.slice(0, 200), createdAt: manifest.createdAt },
      });
    } catch {
      // Restore already applied. Audit write can fail if sessions/users changed.
    }

    revalidatePath("/", "layout");
    return actionOk();
  } catch (err) {
    return actionFail(publicErrorMessage(err, "Restore failed. The live database was not changed if the dump never ran."));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
