import { createReadStream } from "fs";
import { Readable } from "stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { canManageBackup } from "@/lib/rbac";
import { createAppBackup, publicErrorMessage } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return jsonError("Sign in to download a backup.", 401);
  }
  if (!canManageBackup(session.user.role)) {
    return jsonError("Only a Super Admin or GM can download a full backup.", 403);
  }

  let backup: Awaited<ReturnType<typeof createAppBackup>> | undefined;
  try {
    backup = await createAppBackup();

    try {
      await prisma.backupEvent.create({
        data: {
          kind: "DOWNLOAD",
          filename: backup.filename,
          byteSize: backup.byteSize > 2147483647 ? null : backup.byteSize,
          createdById: session.user.id,
        },
      });
      await writeAuditLog({
        userId: session.user.id,
        action: "BACKUP_DOWNLOADED",
        module: "settings",
        newValue: { filename: backup.filename, byteSize: backup.byteSize },
      });
    } catch {
      // Download should still succeed if the event row cannot be written.
    }

    const nodeStream = createReadStream(backup.zipPath);
    const cleanup = backup.cleanup;
    const finish = () => {
      nodeStream.close();
      void cleanup();
    };
    nodeStream.on("error", finish);
    nodeStream.on("close", () => {
      void cleanup();
    });

    const webStream = Readable.toWeb(nodeStream) as unknown as BodyInit;
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "Content-Length": String(backup.byteSize),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (backup) await backup.cleanup();
    return jsonError(publicErrorMessage(err, "Could not create a backup."), 500);
  }
}
