"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlotStatusLookupForm({
  membership,
  cnic,
  q,
}: {
  membership?: string;
  cnic?: string;
  q?: string;
}) {
  const [membershipValue, setMembershipValue] = useState(membership ?? "");
  const [cnicValue, setCnicValue] = useState(cnic ?? "");
  const [codeValue, setCodeValue] = useState(q ?? "");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const canScan = useMemo(() => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia, []);

  async function readQrFromCamera() {
    setCameraError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
      } }).BarcodeDetector;
      if (!Detector) {
        stream.getTracks().forEach((t) => t.stop());
        setCameraError("Camera QR is not supported in this browser — paste the code instead.");
        return;
      }
      const detector = new Detector({ formats: ["qr_code"] });
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          setCodeValue(codes[0].rawValue);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      stream.getTracks().forEach((t) => t.stop());
      setCameraError("No QR detected. Paste the file code or URL.");
    } catch {
      setCameraError("Camera unavailable. Paste the QR URL or file code.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <form method="get" className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
      <div>
        <Label htmlFor="membership">Membership No</Label>
        <Input
          id="membership"
          name="membership"
          className="mt-1"
          placeholder="M-2451 or 21363(i)"
          value={membershipValue}
          onChange={(e) => setMembershipValue(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="cnic">CNIC</Label>
        <Input
          id="cnic"
          name="cnic"
          className="mt-1"
          placeholder="35202-3003003-3"
          value={cnicValue}
          onChange={(e) => setCnicValue(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="q">QR code / file code</Label>
        <Input
          id="q"
          name="q"
          className="mt-1 font-mono text-sm"
          placeholder="Paste /f/PF-E17-3-123 or scan"
          value={codeValue}
          onChange={(e) => setCodeValue(e.target.value)}
        />
        {canScan ? (
          <button
            type="button"
            className="mt-2 text-xs text-teal-800 hover:underline"
            onClick={readQrFromCamera}
            disabled={scanning}
          >
            {scanning ? "Scanning…" : "Use camera"}
          </button>
        ) : null}
        {cameraError ? <p className="mt-1 text-xs text-rose-700">{cameraError}</p> : null}
      </div>
      <div className="md:col-span-3">
        <Button type="submit">Look up plot status</Button>
        <p className="mt-2 text-xs text-slate-500">
          Enter any one field. Physical file QR codes (<code className="font-mono">/f/…</code>) are accepted.
        </p>
      </div>
    </form>
  );
}
