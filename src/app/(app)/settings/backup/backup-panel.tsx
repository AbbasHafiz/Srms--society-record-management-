"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Download, Loader2 } from "lucide-react";
import { looksLikeRejectedUpload, RESTORE_CONFIRM_PHRASE } from "@/lib/backup-shared";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, WarningBanner } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreBackupAction } from "./actions";

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] || fallback;
}

export function BackupPanel({
  lastDownloadLabel,
  toolWarning,
}: {
  lastDownloadLabel: string | null;
  toolWarning: string | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadOk, setDownloadOk] = useState<string | null>(null);

  async function downloadBackup() {
    setDownloading(true);
    setDownloadError(null);
    setDownloadOk(null);
    try {
      const res = await fetch("/settings/backup/download", { method: "GET", cache: "no-store" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || type.includes("application/json")) {
        let message = "Could not create a backup.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          message = res.status === 403 ? "You do not have permission to download a backup." : message;
        }
        setDownloadError(message);
        return;
      }
      const blob = await res.blob();
      const filename = filenameFromDisposition(
        res.headers.get("content-disposition"),
        "srms-backup.zip"
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadOk(`Saved ${filename}. Store a copy off this server.`);
    } catch {
      setDownloadError("Could not create a backup. Check that PostgreSQL is running and pg_dump is installed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Download backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Creates a zip named <span className="font-mono">srms-backup-YYYYMMDD-HHMM.zip</span> with a
            PostgreSQL dump and a copy of uploaded scans (CNIC, allotment letters, POs). Finance Excel
            import is not a backup.
          </p>
          {lastDownloadLabel ? (
            <p className="text-sm text-slate-700">
              Last download from this page: <span className="font-medium">{lastDownloadLabel}</span>
            </p>
          ) : (
            <EmptyState
              title="No download recorded yet"
              description="Nightly VPS cron copies are separate. Use this button when you need a zip now."
            />
          )}
          {toolWarning ? <FormErrorBanner message={toolWarning} /> : null}
          {downloadError ? <FormErrorBanner message={downloadError} /> : null}
          {downloadOk ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            >
              {downloadOk}
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => void downloadBackup()}
            disabled={downloading || Boolean(toolWarning)}
            aria-busy={downloading}
            className="w-full sm:w-auto"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating dump…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download backup
              </>
            )}
          </Button>
          {downloading ? (
            <p className="text-sm text-slate-500" aria-live="polite">
              Dumping the database and packing uploaded files. Keep this tab open until the zip
              downloads.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RestoreCard />
    </div>
  );
}

function RestoreCard() {
  const formId = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [replaceOk, setReplaceOk] = useState(false);
  const [backupOk, setBackupOk] = useState(false);
  const [state, formAction, pending] = useActionState(restoreBackupAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function requestRestore() {
    setFileError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFileError("Choose a backup zip first.");
      return;
    }
    const rejected = looksLikeRejectedUpload(file);
    if (rejected) {
      setFileError(rejected);
      return;
    }
    setOpen(true);
    setPhrase("");
    setReplaceOk(false);
    setBackupOk(false);
  }

  const canSubmit = replaceOk && backupOk && phrase === RESTORE_CONFIRM_PHRASE && !pending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restore</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WarningBanner>
          Restore <strong>replaces</strong> every record and uploaded file on this server. It cannot
          be undone from the app. Only a zip produced by <strong>Download backup</strong> is accepted.
        </WarningBanner>
        <form id={formId} action={formAction} className="space-y-4">
          {state?.ok === false ? <FormErrorBanner message={state.message} /> : null}
          {fileError ? <FormErrorBanner message={fileError} /> : null}
          {state?.ok ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            >
              Restore finished. Sign in again if you are returned to the login page — sessions often
              end when users are replaced.
            </div>
          ) : null}
          <input type="hidden" name="replaceAcknowledged" value={replaceOk ? "on" : ""} />
          <input type="hidden" name="backupAcknowledged" value={backupOk ? "on" : ""} />
          <input type="hidden" name="confirmPhrase" value={phrase} />
          <div>
            <Label htmlFor="backup-file">Backup zip</Label>
            <Input
              id="backup-file"
              ref={fileRef}
              name="file"
              type="file"
              accept=".zip,application/zip"
              required
              className="mt-1"
              disabled={pending}
            />
            <p className="mt-1 text-xs text-slate-500">Spreadsheets and PDFs are rejected.</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={requestRestore}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring…
              </>
            ) : (
              <>
                <ArchiveRestore className="h-4 w-4" />
                Restore from zip
              </>
            )}
          </Button>
        </form>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Replace all Society Records data?</DialogTitle>
              <DialogDescription>
                This restores the database and uploaded scans from the zip. Current plots, transfers,
                users, fees, and files are overwritten. You cannot undo this from the app.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={replaceOk}
                  onChange={(e) => setReplaceOk(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>I understand this replaces all current records and uploaded files.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={backupOk}
                  onChange={(e) => setBackupOk(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>I have a current backup if this zip is the wrong file.</span>
              </label>
              <div>
                <Label htmlFor="confirmPhrase">Type {RESTORE_CONFIRM_PHRASE} to confirm</Label>
                <Input
                  id="confirmPhrase"
                  autoComplete="off"
                  className="mt-1 font-mono"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={RESTORE_CONFIRM_PHRASE}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={formId}
                variant="destructive"
                disabled={!canSubmit}
                onClick={() => {
                  if (canSubmit) setOpen(false);
                }}
              >
                Replace all data
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
