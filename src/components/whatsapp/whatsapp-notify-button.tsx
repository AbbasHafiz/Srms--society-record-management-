"use client";

import { useCallback, useMemo, useState } from "react";
import { MessageCircle, Copy, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  sendWhatsAppNotifyAction,
  type WhatsAppRecipientPayload,
  type WhatsAppTemplateOption,
} from "@/app/(app)/notifications/whatsapp/actions";
import type { NotifyRecipientType } from "@/generated/prisma/client";
import type { WhatsAppNotifyResult } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/whatsapp";

export type WhatsAppPresetRecipient = {
  key: string;
  label: string;
  name: string;
  phone: string | null;
  type: NotifyRecipientType;
  employeeId?: string;
};

type AudienceMode = "preset" | "custom" | "all_guards" | "multi_guards";

export function WhatsAppNotifyButton({
  relatedModule,
  relatedRecordId,
  plotId,
  transferId,
  presets = [],
  guardEmployees = [],
  templates,
  templateVars = {},
  defaultTemplateKey,
  allowedModes = ["preset", "custom"],
  label = "WhatsApp",
  size = "sm",
}: {
  relatedModule: string;
  relatedRecordId?: string;
  plotId?: string;
  transferId?: string;
  presets?: WhatsAppPresetRecipient[];
  guardEmployees?: { id: string; name: string; phone: string | null }[];
  templates: WhatsAppTemplateOption[];
  templateVars?: Record<string, string>;
  defaultTemplateKey?: string;
  allowedModes?: AudienceMode[];
  label?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AudienceMode>(
    allowedModes.includes("preset") && presets.length ? "preset" : allowedModes[0] ?? "custom"
  );
  const [selectedPresetKey, setSelectedPresetKey] = useState(presets[0]?.key ?? "");
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [templateKey, setTemplateKey] = useState(
    defaultTemplateKey ?? templates[0]?.key ?? "custom_message"
  );
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WhatsAppNotifyResult[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const applyTemplate = useCallback(
    (key: string) => {
      const tmpl = templates.find((t) => t.key === key);
      if (tmpl) {
        setMessageBody(renderTemplate(tmpl.body, templateVars));
      }
    },
    [templates, templateVars]
  );

  const presetsWithPhone = useMemo(
    () => presets.filter((p) => p.phone && p.phone.trim()),
    [presets]
  );

  const openDialog = () => {
    setError(null);
    setResults(null);
    const key = defaultTemplateKey ?? templates[0]?.key ?? "custom_message";
    setTemplateKey(key);
    applyTemplate(key);
    if (presetsWithPhone.length) {
      setSelectedPresetKey(presetsWithPhone[0].key);
    }
    setOpen(true);
  };

  const buildRecipients = (): WhatsAppRecipientPayload[] => {
    if (mode === "custom") {
      if (!customName.trim() || !customPhone.trim()) {
        throw new Error("Enter recipient name and phone number");
      }
      return [
        {
          recipientName: customName.trim(),
          recipientPhone: customPhone.trim(),
          recipientType: "CUSTOM",
        },
      ];
    }

    if (mode === "all_guards") {
      const guards = guardEmployees.filter((g) => g.phone?.trim());
      if (!guards.length) throw new Error("No guards with phone numbers found");
      return guards.map((g) => ({
        recipientName: g.name,
        recipientPhone: g.phone!,
        recipientType: "GUARD" as NotifyRecipientType,
        recipientEmployeeId: g.id,
      }));
    }

    if (mode === "multi_guards") {
      const guards = guardEmployees.filter(
        (g) => selectedGuardIds.includes(g.id) && g.phone?.trim()
      );
      if (!guards.length) throw new Error("Select at least one guard with a phone number");
      return guards.map((g) => ({
        recipientName: g.name,
        recipientPhone: g.phone!,
        recipientType: "GUARD" as NotifyRecipientType,
        recipientEmployeeId: g.id,
      }));
    }

    const preset = presetsWithPhone.find((p) => p.key === selectedPresetKey);
    if (!preset?.phone) throw new Error("Selected recipient has no phone number");
    return [
      {
        recipientName: preset.name,
        recipientPhone: preset.phone,
        recipientType: preset.type,
        recipientEmployeeId: preset.employeeId,
      },
    ];
  };

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const recipients = buildRecipients();
      const res = await sendWhatsAppNotifyAction({
        recipients,
        messageBody,
        templateKey,
        plotId,
        transferId,
        relatedModule,
        relatedRecordId,
      });
      setResults(res);
      if (res.length === 1 && res[0].status === "LINK_GENERATED") {
        window.open(res[0].deepLinkUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasAnyRecipient =
    presetsWithPhone.length > 0 ||
    guardEmployees.some((g) => g.phone?.trim()) ||
    allowedModes.includes("custom");

  if (!hasAnyRecipient && !templates.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size} onClick={openDialog}>
          <MessageCircle className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send via WhatsApp</DialogTitle>
          <DialogDescription>
            Opens WhatsApp with a prefilled message. Delivery is via deep link unless an API gateway is
            configured.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {results.length} message{results.length === 1 ? "" : "s"} queued. Status reflects
              link generation or gateway delivery — not SMS.
            </p>
            <ul className="space-y-2">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{r.recipientName}</p>
                    <p className="text-xs text-slate-500">{r.recipientPhone}</p>
                    <p className="mt-1 text-xs font-medium text-teal-800">{r.status.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={r.deepLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open WhatsApp
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copyLink(r.id, r.deepLinkUrl)}
                    >
                      {copiedId === r.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy link
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {allowedModes.length > 1 ? (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Audience
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AudienceMode)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {allowedModes.includes("preset") && presetsWithPhone.length ? (
                    <option value="preset">Single recipient</option>
                  ) : null}
                  {allowedModes.includes("all_guards") && guardEmployees.length ? (
                    <option value="all_guards">All active guards</option>
                  ) : null}
                  {allowedModes.includes("multi_guards") && guardEmployees.length ? (
                    <option value="multi_guards">Selected guards</option>
                  ) : null}
                  {allowedModes.includes("custom") ? (
                    <option value="custom">Custom number</option>
                  ) : null}
                </select>
              </div>
            ) : null}

            {mode === "preset" && presetsWithPhone.length ? (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Recipient
                </label>
                <select
                  value={selectedPresetKey}
                  onChange={(e) => setSelectedPresetKey(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {presetsWithPhone.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} — {p.phone}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === "multi_guards" ? (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Select guards
                </label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {guardEmployees.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedGuardIds.includes(g.id)}
                        disabled={!g.phone?.trim()}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGuardIds((ids) => [...ids, g.id]);
                          } else {
                            setSelectedGuardIds((ids) => ids.filter((id) => id !== g.id));
                          }
                        }}
                      />
                      <span>
                        {g.name}
                        {g.phone ? ` (${g.phone})` : " — no phone"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {mode === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Name
                  </label>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Recipient name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Phone
                  </label>
                  <input
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="03xx-xxxxxxx"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Template
              </label>
              <select
                value={templateKey}
                onChange={(e) => {
                  setTemplateKey(e.target.value);
                  applyTemplate(e.target.value);
                }}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Message (editable)
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={loading || !messageBody.trim()} onClick={handleSend}>
                {loading ? "Saving…" : "Generate & open"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
