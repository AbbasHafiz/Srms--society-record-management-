import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessModule } from "@/lib/rbac";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessModule(session.user.role, "offices")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const offices = await prisma.registeredOffice.findMany({
    where: {
      ...(activeOnly ? { status: "ACTIVE" } : {}),
      ...(q
        ? {
            OR: [
              { officeName: { contains: q, mode: "insensitive" } },
              { ownerName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { licenseNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      officeName: true,
      ownerName: true,
      phone: true,
      address: true,
      premisesType: true,
      status: true,
      licenseNumber: true,
      expiryDate: true,
    },
    orderBy: { officeName: "asc" },
    take: 25,
  });

  return NextResponse.json(offices);
}
