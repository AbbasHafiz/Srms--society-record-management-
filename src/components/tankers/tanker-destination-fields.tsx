"use client";

import { useEffect, useMemo, useState } from "react";
import { plotLabel } from "@/lib/plots";
import type { TankerDestinationMode } from "@/lib/tankers";

type PlotResult = {
  id: string;
  label: string;
  sector: string;
  block: string | null;
  plotNumber: string;
  street: string | null;
  ownerName: string | null;
  membershipNumber: string | null;
  address: {
    houseNo: string;
    streetNo: string;
    streetArea: string;
  };
};

export type TankerDestinationValues = {
  destinationMode: TankerDestinationMode;
  plotId: string;
  houseNo: string;
  streetNo: string;
  streetArea: string;
};

type Props = {
  initialMode?: TankerDestinationMode;
  initialPlotId?: string | null;
  initialPlotLabel?: string | null;
  initialHouseNo?: string | null;
  initialStreetNo?: string | null;
  initialStreetArea?: string | null;
};

export function TankerDestinationFields({
  initialMode,
  initialPlotId,
  initialPlotLabel,
  initialHouseNo,
  initialStreetNo,
  initialStreetArea,
}: Props) {
  const resolvedMode: TankerDestinationMode =
    initialMode ?? (initialPlotId ? "plot" : "house");

  const [mode, setMode] = useState<TankerDestinationMode>(resolvedMode);
  const [plotQuery, setPlotQuery] = useState("");
  const [plotId, setPlotId] = useState(initialPlotId ?? "");
  const [plotLabelText, setPlotLabelText] = useState(initialPlotLabel ?? "");
  const [houseNo, setHouseNo] = useState(initialHouseNo ?? "");
  const [streetNo, setStreetNo] = useState(initialStreetNo ?? "");
  const [streetArea, setStreetArea] = useState(initialStreetArea ?? "");
  const [results, setResults] = useState<PlotResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const plotRequired = mode === "plot";
  const houseRequired = mode === "house";

  useEffect(() => {
    if (mode !== "plot" || plotQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/plots/search?q=${encodeURIComponent(plotQuery.trim())}&limit=15`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { plots: PlotResult[] };
        setResults(data.plots);
        setShowResults(true);
      } catch {
        // ignore aborted / network errors
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, plotQuery]);

  const selectedPlotSummary = useMemo(() => {
    if (!plotId) return null;
    if (plotLabelText) return plotLabelText;
    const match = results.find((p) => p.id === plotId);
    return match?.label ?? plotId;
  }, [plotId, plotLabelText, results]);

  function selectPlot(plot: PlotResult) {
    setPlotId(plot.id);
    setPlotLabelText(plot.label);
    setHouseNo(plot.address.houseNo);
    setStreetNo(plot.address.streetNo);
    setStreetArea(plot.address.streetArea);
    setPlotQuery(plot.label);
    setShowResults(false);
  }

  function clearPlot() {
    setPlotId("");
    setPlotLabelText("");
    setPlotQuery("");
    setResults([]);
  }

  function switchMode(next: TankerDestinationMode) {
    setMode(next);
    if (next === "house") {
      clearPlot();
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Delivery destination *</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchMode("plot")}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              mode === "plot"
                ? "border-teal-700 bg-teal-800 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Society plot
          </button>
          <button
            type="button"
            onClick={() => switchMode("house")}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              mode === "house"
                ? "border-teal-700 bg-teal-800 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            House / walk-in
          </button>
        </div>
        <input type="hidden" name="destinationMode" value={mode} />
      </div>

      {mode === "plot" ? (
        <div className="space-y-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Plot *</span>
            <div className="relative">
              <input
                value={plotQuery}
                onChange={(e) => {
                  setPlotQuery(e.target.value);
                  if (plotId && e.target.value !== plotLabelText) {
                    setPlotId("");
                    setPlotLabelText("");
                  }
                }}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="Search plot no., sector, owner…"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                autoComplete="off"
              />
              {searching ? (
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">Searching…</span>
              ) : null}
              {showResults && results.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {results.map((plot) => (
                    <li key={plot.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                        onClick={() => selectPlot(plot)}
                      >
                        <div className="font-medium text-slate-900">{plot.label}</div>
                        <div className="text-xs text-slate-500">
                          {plot.ownerName
                            ? `${plot.ownerName}${plot.membershipNumber ? ` · ${plot.membershipNumber}` : ""}`
                            : "No active owner"}
                          {plot.street ? ` · ${plot.street}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </label>
          <input type="hidden" name="plotId" value={plotId} required={plotRequired} />
          {selectedPlotSummary ? (
            <p className="text-xs text-teal-800">
              Linked plot: <strong>{selectedPlotSummary}</strong>{" "}
              <button type="button" className="underline" onClick={clearPlot}>
                Clear
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">Type at least 2 characters to search society plots.</p>
          )}
        </div>
      ) : (
        <input type="hidden" name="plotId" value="" />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            House no.{houseRequired ? " *" : ""}
          </span>
          <input
            name="houseNo"
            value={houseNo}
            onChange={(e) => setHouseNo(e.target.value)}
            required={houseRequired}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Street no.{houseRequired ? " *" : ""}
          </span>
          <input
            name="streetNo"
            value={streetNo}
            onChange={(e) => setStreetNo(e.target.value)}
            required={houseRequired}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">
            Street / area{houseRequired ? " *" : ""}
          </span>
          <input
            name="streetArea"
            value={streetArea}
            onChange={(e) => setStreetArea(e.target.value)}
            required={houseRequired}
            placeholder="e.g. E-17 Street 12"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
      </div>

      {mode === "plot" ? (
        <p className="text-xs text-slate-500">
          Address fields auto-fill from the selected plot but can be overridden for gate/house delivery notes.
        </p>
      ) : (
        <p className="text-xs text-slate-500">Walk-in bookings are not linked to a society plot record.</p>
      )}
    </div>
  );
}

export function plotLabelFromParts(plot: {
  sector: string;
  block?: string | null;
  plotNumber: string;
}) {
  return plotLabel(plot);
}
