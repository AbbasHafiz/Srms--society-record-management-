"use client";

import { useEffect, useState } from "react";

export type RegisteredOfficeOption = {
  id: string;
  officeName: string;
  ownerName: string;
  phone: string;
  address: string | null;
  premisesType: string;
  status: string;
  licenseNumber: string | null;
  expiryDate: string | null;
};

type Props = {
  name?: string;
  defaultValue?: string;
  onSelect?: (office: RegisteredOfficeOption | null) => void;
  className?: string;
};

export function RegisteredOfficeSelect({
  name = "registeredOfficeId",
  defaultValue = "",
  onSelect,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [options, setOptions] = useState<RegisteredOfficeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!defaultValue) return;
    fetch(`/api/offices/search?q=&activeOnly=true`)
      .then((r) => r.json())
      .then((data: RegisteredOfficeOption[]) => {
        const match = data.find((o) => o.id === defaultValue);
        if (match) {
          setQuery(match.officeName);
          onSelect?.(match);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/offices/search?q=${encodeURIComponent(query)}&activeOnly=true`)
        .then((r) => r.json())
        .then((data: RegisteredOfficeOption[]) => setOptions(data))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(office: RegisteredOfficeOption) {
    setSelectedId(office.id);
    setQuery(office.officeName);
    setOptions([]);
    onSelect?.(office);
  }

  function clear() {
    setSelectedId("");
    setQuery("");
    onSelect?.(null);
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={selectedId} />
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedId) {
              setSelectedId("");
              onSelect?.(null);
            }
          }}
          placeholder="Search registered dealer / office…"
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          autoComplete="off"
        />
        {selectedId ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        ) : null}
        {!selectedId && options.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{o.officeName}</span>
                  <span className="block text-xs text-slate-500">
                    {o.ownerName} · {o.phone}
                    {o.licenseNumber ? ` · ${o.licenseNumber}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {loading ? <p className="mt-1 text-xs text-slate-400">Searching…</p> : null}
    </div>
  );
}
