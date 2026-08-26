"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notification ID required");

  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NOTIFICATION_READ",
    module: "notifications",
    recordId: id,
    plotId: notification.plotId,
  });

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationUnread(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notification ID required");

  await prisma.notification.update({
    where: { id },
    data: { isRead: false, readAt: null },
  });

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const result = await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NOTIFICATIONS_ALL_READ",
    module: "notifications",
    newValue: { count: result.count },
  });

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
