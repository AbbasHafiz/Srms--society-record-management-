"use client";

import { useState } from "react";
import type { RegisteredOfficeOption } from "@/components/offices/registered-office-select";
import { RegisteredOfficeSelect } from "@/components/offices/registered-office-select";

type Props = {
  defaultDealerName?: string;
  defaultDealerOffice?: string;
};

export function OpenFileDealerFields({ defaultDealerName = "", defaultDealerOffice = "" }: Props) {
  const [dealerName, setDealerName] = useState(defaultDealerName);
  const [dealerOffice, setDealerOffice] = useState(defaultDealerOffice);

  function handleOfficeSelect(office: RegisteredOfficeOption | null) {
    if (office) {
      setDealerName(office.officeName);
      setDealerOffice(office.address ?? office.ownerName);
    }
  }

  return (
    <>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Registered office (letterhead source)</span>
        <RegisteredOfficeSelect onSelect={handleOfficeSelect} />
        <p className="mt-1 text-xs text-slate-500">
          Selecting a registered office fills dealer name from the society register and links letterhead.
        </p>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Dealer name (snapshot)</span>
        <input
          name="dealerName"
          value={dealerName}
          onChange={(e) => setDealerName(e.target.value)}
          required
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Dealer office / address</span>
        <input
          name="dealerOffice"
          value={dealerOffice}
          onChange={(e) => setDealerOffice(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
      </label>
    </>
  );
}
