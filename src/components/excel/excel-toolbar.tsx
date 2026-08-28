"use client";

import { ExcelExportLink } from "@/components/excel/excel-export-link";
import { ExcelImportDialog } from "@/components/excel/excel-import-dialog";
import type { ExcelCommitResult, ExcelPreviewResult } from "@/lib/excel";

export function ExcelToolbar({
  exportHref,
  exportLabel = "Export Excel",
  templateHref,
  templateLabel = "Download import template",
  canImport,
  importTitle,
  importDescription,
  previewAction,
  commitAction,
  appendNote,
}: {
  exportHref: string;
  exportLabel?: string;
  templateHref?: string;
  templateLabel?: string;
  canImport?: boolean;
  importTitle?: string;
  importDescription?: string;
  previewAction?: (formData: FormData) => Promise<ExcelPreviewResult>;
  commitAction?: (formData: FormData) => Promise<ExcelCommitResult>;
  appendNote?: string;
}) {
  return (
    <>
      <ExcelExportLink href={exportHref} label={exportLabel} />
      {templateHref ? <ExcelExportLink href={templateHref} label={templateLabel} /> : null}
      {canImport && templateHref && importTitle && importDescription && previewAction && commitAction ? (
        <ExcelImportDialog
          title={importTitle}
          description={importDescription}
          templateHref={templateHref}
          previewAction={previewAction}
          commitAction={commitAction}
          appendNote={appendNote}
        />
      ) : null}
    </>
  );
}
