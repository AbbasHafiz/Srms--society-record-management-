"use client";

import { useMemo, useState } from "react";
import { OtherSpecify } from "@/components/ui/other-specify";
import { labelize } from "@/lib/utils";

type OrgRoleOption = { id: string; name: string; category: string; code: string };

export function EmployeeOrgRoleFields({
  orgRoles,
  defaultOrgRoleId = "",
  defaultOtherDetail = "",
}: {
  orgRoles: OrgRoleOption[];
  defaultOrgRoleId?: string;
  defaultOtherDetail?: string;
}) {
  const [orgRoleId, setOrgRoleId] = useState(defaultOrgRoleId);

  const rolesByCategory = useMemo(
    () =>
      orgRoles.reduce<Record<string, OrgRoleOption[]>>((acc, role) => {
        (acc[role.category] ??= []).push(role);
        return acc;
      }, {}),
    [orgRoles]
  );

  const selectedRole = orgRoles.find((r) => r.id === orgRoleId);
  const isOtherRole = selectedRole?.code === "OTHER";

  return (
    <>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Organization role *</span>
        <select
          name="orgRoleId"
          required
          value={orgRoleId}
          onChange={(e) => setOrgRoleId(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
        >
          <option value="" disabled>
            Select role…
          </option>
          {Object.entries(rolesByCategory).map(([category, roles]) => (
            <optgroup key={category} label={labelize(category)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Manage custom roles under{" "}
          <a href="/settings/roles" className="text-teal-800 hover:underline">
            Settings → Roles
          </a>
        </p>
      </label>
      {isOtherRole ? (
        <OtherSpecify
          selectedValue="OTHER"
          label="Job title / designation"
          placeholder="e.g. Sanitation supervisor"
          defaultValue={defaultOtherDetail}
          className="sm:col-span-2"
        />
      ) : null}
    </>
  );
}
