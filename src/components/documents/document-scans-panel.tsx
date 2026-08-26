import type { ScanUploadProps } from "./scan-upload";
import { ScanUpload } from "./scan-upload";

export function DocumentScansPanel({
  heading = "Document Scans",
  description,
  scans,
}: {
  heading?: string;
  description?: string;
  scans: ScanUploadProps[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-slate-900">{heading}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {scans.map((scan) => (
          <ScanUpload key={`${scan.documentType}-${scan.title}-${scan.documentNumber ?? ""}`} {...scan} />
        ))}
      </div>
    </section>
  );
}
