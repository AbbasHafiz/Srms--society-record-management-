import { NextResponse } from "next/server";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessDocumentFile, resolveUploadAbsolutePath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  const relativePath = segments.map(decodeURIComponent).join("/");

  try {
    const absolutePath = resolveUploadAbsolutePath(relativePath);

    const document = await prisma.document.findFirst({
      where: { filePath: relativePath },
      orderBy: { createdAt: "desc" },
      select: { documentType: true },
    });

    if (!canAccessDocumentFile(session.user.role, document?.documentType)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await fs.readFile(absolutePath);
    const ext = relativePath.split(".").pop()?.toLowerCase();
    const mime =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${relativePath.split("/").pop()}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
