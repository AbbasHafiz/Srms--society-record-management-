"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createWhatsAppNotify,
  listActiveNotifyTemplates,
  type WhatsAppNotifyResult,
} from "@/lib/whatsapp";
import type { NotifyRecipientType } from "@/generated/prisma/client";

export type WhatsAppTemplateOption = {
  key: string;
  name: string;
  body: string;
};

export async function fetchWhatsAppTemplates(module?: string): Promise<WhatsAppTemplateOption[]> {
  const templates = await listActiveNotifyTemplates(module);
  return templates.map((t) => ({ key: t.key, name: t.name, body: t.body }));
}

export type WhatsAppRecipientPayload = {
  recipientName: string;
  recipientPhone: string;
  recipientType: NotifyRecipientType;
  recipientEmployeeId?: string;
};

export async function sendWhatsAppNotifyAction(payload: {
  recipients: WhatsAppRecipientPayload[];
  messageBody: string;
  templateKey?: string;
  plotId?: string;
  transferId?: string;
  relatedModule?: string;
  relatedRecordId?: string;
}): Promise<WhatsAppNotifyResult[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (!payload.messageBody?.trim()) throw new Error("Message body is required");
  if (!payload.recipients?.length) throw new Error("At least one recipient is required");

  const results = await createWhatsAppNotify({
    userId: session.user.id,
    userRole: session.user.role,
    recipients: payload.recipients,
    messageBody: payload.messageBody.trim(),
    templateKey: payload.templateKey,
    plotId: payload.plotId,
    transferId: payload.transferId,
    relatedModule: payload.relatedModule,
    relatedRecordId: payload.relatedRecordId,
  });

  revalidatePath("/notifications/whatsapp");
  if (payload.plotId) revalidatePath(`/plots/${payload.plotId}`);
  if (payload.transferId) revalidatePath(`/transfers/${payload.transferId}`);
  if (payload.relatedModule && payload.relatedRecordId) {
    revalidatePath(`/${payload.relatedModule}/${payload.relatedRecordId}`);
  }

  return results;
}
