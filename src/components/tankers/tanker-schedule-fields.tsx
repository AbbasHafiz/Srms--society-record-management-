"use client";

import { useEffect, useState } from "react";

type SlotOption = {
  id: string;
  label: string;
  remaining: number;
  isFull: boolean;
  maxBookingsPerDay: number;
};

type Props = {
  initialDate: string;
  initialTimeSlotId?: string | null;
  excludeBookingId?: string;
  dateFieldName?: string;
  slotFieldName?: string;
  onDateChange?: (date: string) => void;
};

export function TankerScheduleFields({
  initialDate,
  initialTimeSlotId,
  excludeBookingId,
  dateFieldName = "distributionDate",
  slotFieldName = "timeSlotId",
  onDateChange,
}: Props) {
  const [date, setDate] = useState(initialDate);
  const [timeSlotId, setTimeSlotId] = useState(initialTimeSlotId ?? "");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setTimeSlotId(initialTimeSlotId ?? "");
  }, [initialTimeSlotId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!date) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ date });
        if (excludeBookingId) params.set("excludeBookingId", excludeBookingId);
        const res = await fetch(`/api/tankers/slots?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { slots: SlotOption[] };
        if (!cancelled) {
          setSlots(data.slots);
          if (timeSlotId && !data.slots.some((s) => s.id === timeSlotId && !s.isFull)) {
            const current = data.slots.find((s) => s.id === timeSlotId);
            if (current?.isFull) {
              setTimeSlotId("");
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [date, timeSlotId, excludeBookingId]);

  return (
    <>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Delivery date *</span>
        <input
          name={dateFieldName}
          type="date"
          required
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            onDateChange?.(e.target.value);
          }}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Delivery time slot *</span>
        <select
          name={slotFieldName}
          required
          value={timeSlotId}
          onChange={(e) => setTimeSlotId(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">{loading ? "Loading slots…" : "Select slot…"}</option>
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id} disabled={slot.isFull && slot.id !== timeSlotId}>
              {slot.label}
              {slot.isFull && slot.id !== timeSlotId
                ? " (full)"
                : ` — ${slot.remaining} left`}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

type AvailabilityListProps = {
  initialDate: string;
};

export function TankerSlotAvailabilityList({ initialDate }: AvailabilityListProps) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotOption[]>([]);

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/tankers/slots?date=${encodeURIComponent(date)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { slots: SlotOption[] };
      if (!cancelled) setSlots(data.slots);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <h2 className="font-display mb-3 font-semibold text-slate-900">Slot availability</h2>
      <p className="mb-3 text-slate-600">
        For {new Date(`${date}T12:00:00`).toLocaleDateString("en-GB")}:
      </p>
      <ul className="space-y-2">
        {slots.map((slot) => (
          <li key={slot.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="font-medium">{slot.label}</div>
            <div className={slot.isFull ? "text-rose-700" : "text-emerald-700"}>
              {slot.isFull
                ? "Full"
                : `${slot.remaining} of ${slot.maxBookingsPerDay} available`}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
