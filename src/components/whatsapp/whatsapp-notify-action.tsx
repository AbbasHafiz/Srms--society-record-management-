import { WhatsAppNotifyButton, type WhatsAppPresetRecipient } from "@/components/whatsapp/whatsapp-notify-button";
import { fetchWhatsAppTemplates } from "@/app/(app)/notifications/whatsapp/actions";
import { canSendWhatsApp } from "@/lib/whatsapp";
import type { Role } from "@/generated/prisma/client";

export async function WhatsAppNotifyAction({
  userRole,
  relatedModule,
  relatedRecordId,
  plotId,
  transferId,
  presets,
  guardEmployees,
  templateVars,
  defaultTemplateKey,
  allowedModes,
  label,
}: {
  userRole: Role;
  relatedModule: string;
  relatedRecordId?: string;
  plotId?: string;
  transferId?: string;
  presets?: WhatsAppPresetRecipient[];
  guardEmployees?: { id: string; name: string; phone: string | null }[];
  templateVars?: Record<string, string>;
  defaultTemplateKey?: string;
  allowedModes?: ("preset" | "custom" | "all_guards" | "multi_guards")[];
  label?: string;
}) {
  const recipientTypes = new Set(
    (presets ?? []).map((p) => p.type).concat(
      guardEmployees?.length ? ["GUARD" as const] : []
    )
  );

  const canNotify =
    recipientTypes.size === 0
      ? true
      : [...recipientTypes].some((t) => canSendWhatsApp(userRole, t)) ||
        allowedModes?.includes("custom");

  if (!canNotify) return null;

  const templates = await fetchWhatsAppTemplates(relatedModule);

  return (
    <WhatsAppNotifyButton
      relatedModule={relatedModule}
      relatedRecordId={relatedRecordId}
      plotId={plotId}
      transferId={transferId}
      presets={presets ?? []}
      guardEmployees={guardEmployees ?? []}
      templates={templates}
      templateVars={templateVars ?? {}}
      defaultTemplateKey={defaultTemplateKey}
      allowedModes={allowedModes}
      label={label}
    />
  );
}
