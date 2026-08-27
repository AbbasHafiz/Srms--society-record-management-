import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/uploads";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "upload_document")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    const saved = await saveUploadedFile(file);

    return NextResponse.json({
      relativePath: saved.relativePath,
      fileName: saved.storedFileName,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const isTooLarge = message.includes("maximum size");
    return NextResponse.json({ error: message }, { status: isTooLarge ? 413 : 400 });
  }
}
