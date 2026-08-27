import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { NotifyOutboxStatus, Role } from "@/generated/prisma/client";
import {
  WHATSAPP_SETTING_ENABLED,
  WHATSAPP_SETTING_COUNTRY_CODE,
  WHATSAPP_TEMPLATE_KEYS,
  type WhatsAppTemplateKey,
  type WhatsAppRecipientInput,
  normalizePkPhone,
  buildWaMeLink,
  buildWaNativeLink,
  canSendWhatsApp,
  DEFAULT_TEMPLATE_BODIES,
} from "@/lib/whatsapp-shared";

export {
  WHATSAPP_SETTING_ENABLED,
  WHATSAPP_SETTING_COUNTRY_CODE,
  WHATSAPP_TEMPLATE_KEYS,
  type WhatsAppTemplateKey,
  type WhatsAppRecipientInput,
  normalizePkPhone,
  buildWaMeLink,
  buildWaNativeLink,
  renderTemplate,
  canSendWhatsApp,
  DEFAULT_TEMPLATE_BODIES,
} from "@/lib/whatsapp-shared";

export type CreateWhatsAppNotifyInput = {
  userId: string;
  userRole: Role;
  recipients: WhatsAppRecipientInput[];
  messageBody: string;
  templateKey?: string | null;
  plotId?: string | null;
  transferId?: string | null;
  relatedModule?: string | null;
  relatedRecordId?: string | null;
};

export type WhatsAppNotifyResult = {
  id: string;
  recipientName: string;
  recipientPhone: string;
  deepLinkUrl: string;
  deepLinkNative?: string;
  status: NotifyOutboxStatus;
};

export async function isWhatsAppEnabled(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: WHATSAPP_SETTING_ENABLED },
  });
  if (!setting) return true;
  return setting.value === "true" || setting.value === "1";
}

export async function getDefaultCountryCode(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: WHATSAPP_SETTING_COUNTRY_CODE },
  });
  return setting?.value?.replace(/\D/g, "") || "92";
}

async function tryWhatsAppGateway(
  phone: string,
  message: string
): Promise<{ sent: boolean; response?: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL?.trim();
  const apiToken =
    process.env.WHATSAPP_API_TOKEN?.trim() || process.env.WHATSAPP_API_KEY?.trim();

  if (!apiUrl || !apiToken) {
    return { sent: false };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
        "X-API-Key": apiToken,
      },
      body: JSON.stringify({
        phone,
        message,
        text: message,
      }),
    });

    const body = await res.text();
    if (res.ok) {
      return { sent: true, response: body.slice(0, 500) };
    }
    return { sent: false, response: `HTTP ${res.status}: ${body.slice(0, 500)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gateway error";
    return { sent: false, response: msg };
  }
}

export async function createWhatsAppNotify(
  input: CreateWhatsAppNotifyInput
): Promise<WhatsAppNotifyResult[]> {
  if (!(await isWhatsAppEnabled())) {
    throw new Error("WhatsApp notifications are disabled in system settings");
  }

  const countryCode = await getDefaultCountryCode();
  const results: WhatsAppNotifyResult[] = [];

  for (const recipient of input.recipients) {
    if (!canSendWhatsApp(input.userRole, recipient.recipientType)) {
      throw new Error(
        `You do not have permission to notify ${recipient.recipientType} via WhatsApp`
      );
    }

    const normalizedPhone = normalizePkPhone(recipient.recipientPhone, countryCode);
    if (!normalizedPhone) {
      throw new Error(`Invalid phone number for ${recipient.recipientName}`);
    }

    const deepLinkUrl = buildWaMeLink(normalizedPhone, input.messageBody);
    const deepLinkNative = buildWaNativeLink(normalizedPhone, input.messageBody);

    let status: NotifyOutboxStatus = "LINK_GENERATED";
    let providerResponse: string | undefined;

    const gateway = await tryWhatsAppGateway(normalizedPhone, input.messageBody);
    if (gateway.sent) {
      status = "SENT";
      providerResponse = gateway.response;
    } else if (gateway.response && process.env.WHATSAPP_API_URL) {
      status = "FAILED";
      providerResponse = gateway.response;
    } else if (process.env.WHATSAPP_API_URL) {
      status = "LINK_GENERATED";
      providerResponse = "Gateway not configured — deep link generated";
    }

    const outbox = await prisma.whatsAppOutbox.create({
      data: {
        recipientName: recipient.recipientName,
        recipientPhone: normalizedPhone,
        recipientType: recipient.recipientType,
        recipientEmployeeId: recipient.recipientEmployeeId ?? undefined,
        plotId: input.plotId ?? undefined,
        transferId: input.transferId ?? undefined,
        relatedModule: input.relatedModule ?? undefined,
        relatedRecordId: input.relatedRecordId ?? undefined,
        templateKey: input.templateKey ?? undefined,
        messageBody: input.messageBody,
        status,
        deepLinkUrl,
        providerResponse,
        createdById: input.userId,
      },
    });

    await writeAuditLog({
      userId: input.userId,
      action: "WHATSAPP_NOTIFY",
      module: input.relatedModule ?? "whatsapp",
      recordId: outbox.id,
      plotId: input.plotId ?? undefined,
      transferId: input.transferId ?? undefined,
      newValue: {
        recipientName: recipient.recipientName,
        recipientPhone: normalizedPhone,
        recipientType: recipient.recipientType,
        status,
        templateKey: input.templateKey,
        deepLinkOnly: status === "LINK_GENERATED",
      },
    });

    results.push({
      id: outbox.id,
      recipientName: recipient.recipientName,
      recipientPhone: normalizedPhone,
      deepLinkUrl,
      deepLinkNative,
      status,
    });
  }

  return results;
}

export async function listActiveNotifyTemplates(module?: string) {
  return prisma.notifyTemplate.findMany({
    where: {
      isActive: true,
      ...(module ? { OR: [{ module }, { module: null }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
