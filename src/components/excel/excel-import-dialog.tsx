"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/page";
import type { ExcelCommitResult, ExcelPreviewResult } from "@/lib/excel";
import { cn } from "@/lib/utils";

type PreviewAction = (formData: FormData) => Promise<ExcelPreviewResult>;
type CommitAction = (formData: FormData) => Promise<ExcelCommitResult>;

export function ExcelImportDialog({
  title,
  description,
  templateHref,
  previewAction,
  commitAction,
  triggerLabel = "Import Excel",
}: {
  title: string;
  description: string;
  templateHref: string;
  previewAction: PreviewAction;
  commitAction: CommitAction;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelPreviewResult | null>(null);
  const [result, setResult] = useState<ExcelCommitResult | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setAllowDuplicates(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setResult(null);
    setAllowDuplicates(false);
  }

  function withFile(action: PreviewAction | CommitAction, extras?: Record<string, string>) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    if (extras) {
      for (const [key, value] of Object.entries(extras)) formData.set(key, value);
    }
    startTransition(async () => {
      const next = await action(formData);
      if ("imported" in next) {
        setResult(next);
        if (next.ok) router.refresh();
      } else {
        setPreview(next);
        setResult(null);
      }
    });
  }

  const importable =
    (preview?.validCount ?? 0) + (allowDuplicates ? preview?.duplicateCount ?? 0 : 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Upload className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(100vw-1.5rem,52rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={templateHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download import template
          </a>
          <p className="text-xs text-slate-500">
            Append-only. Existing payments and posted amounts are never overwritten.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center hover:bg-slate-50">
          <FileSpreadsheet className="h-8 w-8 text-teal-800" />
          <span className="text-sm font-medium text-slate-800">
            {file ? file.name : "Choose an .xlsx or CSV file"}
          </span>
          <span className="text-xs text-slate-500">
            Works on phone and desktop. Preview runs before anything is saved.
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => withFile(previewAction)} disabled={pending}>
              {pending && !preview && !result ? "Reading spreadsheet…" : "Preview rows"}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              Clear file
            </Button>
          </div>
        ) : null}

        {pending && !preview && !result ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Reading spreadsheet…
          </p>
        ) : null}

        {preview?.fileError ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {preview.fileError}
          </p>
        ) : null}

        {preview && !preview.fileError ? (
          <PreviewTable
            preview={preview}
            pending={pending}
            allowDuplicates={allowDuplicates}
            onAllowDuplicates={setAllowDuplicates}
            importable={importable}
            onImport={() => withFile(commitAction, { allowDuplicates: allowDuplicates ? "1" : "0" })}
          />
        ) : null}

        {result ? (
          <div
            role="status"
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-900"
            )}
          >
            <p className="font-medium">{result.message}</p>
            {result.errors.length ? (
              <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {result.errors.slice(0, 20).map((err) => (
                  <li key={`${err.rowNumber}-${err.message}`}>
                    Row {err.rowNumber}: {err.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PreviewTable({
  preview,
  pending,
  allowDuplicates,
  onAllowDuplicates,
  importable,
  onImport,
}: {
  preview: ExcelPreviewResult;
  pending: boolean;
  allowDuplicates: boolean;
  onAllowDuplicates: (value: boolean) => void;
  importable: number;
  onImport: () => void;
}) {
  if (preview.rows.length === 0) {
    return (
      <EmptyState
        title="No data rows"
        description="The file only has headers, or every row is blank. Fill the template and try again."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {preview.validCount} ready to import
          {preview.duplicateCount ? ` · ${preview.duplicateCount} possible duplicate${preview.duplicateCount === 1 ? "" : "s"}` : ""}
          {" · "}
          {preview.errorCount} with errors
        </p>
        <Button type="button" onClick={onImport} disabled={pending || importable === 0}>
          {pending
            ? "Importing…"
            : importable === 0
              ? "Nothing to import"
              : `Import ${importable} valid row${importable === 1 ? "" : "s"}`}
        </Button>
      </div>
      {(preview.duplicateCount ?? 0) > 0 ? (
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-300"
            checked={allowDuplicates}
            onChange={(event) => onAllowDuplicates(event.target.checked)}
          />
          <span>
            Post duplicates anyway. Same ref + date + amount already exists on the ledger. Leave this
            unticked to skip those rows.
          </span>
        </label>
      ) : null}
      {preview.errorCount > 0 ? (
        <p className="text-xs text-slate-600">
          Rows with errors will not be imported. Fix them in the spreadsheet and upload again, or continue
          with the valid rows only.
        </p>
      ) : null}
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                key={row.rowNumber}
                className={
                  row.errors.length ? "bg-rose-50/70" : row.duplicate ? "bg-amber-50/70" : "bg-white"
                }
              >
                <td className="px-3 py-2 align-top font-mono text-xs">{row.rowNumber}</td>
                <td className="px-3 py-2">{row.summary}</td>
                <td className="px-3 py-2">
                  {row.errors.length || row.warnings?.length ? (
                    <ul className="list-disc pl-4 text-xs">
                      {row.errors.map((err) => (
                        <li key={err} className="text-rose-800">
                          {err}
                        </li>
                      ))}
                      {row.warnings?.map((warn) => (
                        <li key={warn} className="text-amber-900">
                          {warn}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs font-medium text-emerald-800">Ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
