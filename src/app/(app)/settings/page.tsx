import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/core/permissions";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { changeRoleAction, setActiveAction } from "@/server/actions/users";
import { listCompanyUsers } from "@/server/services/company-users";
import { AddUserForm } from "./add-user-form";

export const metadata: Metadata = { title: "Settings" };

const field = "rounded-md border border-line bg-white px-2 py-1.5 text-sm";
const lastSeen = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", day: "2-digit", month: "short", year: "numeric" });

export default async function SettingsPage() {
  const user = await requireUser("settings");
  const people = await listCompanyUsers(getDb(), user.companyId);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Settings`}
        title="People and access"
        sub="Choose who can sign in and what each person can open. Tender and finance staff see only the tender section. A change takes effect on their next click."
      />
      <AddUserForm />
      <section aria-label="People with access">
        <h2 className="text-sm font-semibold">People with access</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Access</th>
                <th className="px-3 py-2 font-medium">Last sign-in</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const locked = p.role === "owner" || p.id === user.id;
                return (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="px-3 py-2">
                      {p.fullName}
                      <span className="block text-xs text-muted">{p.email}</span>
                    </td>
                    <td className="px-3 py-2">
                      {locked ? (
                        <span>
                          {ROLE_LABEL[p.role].name}
                          {p.id === user.id ? " (you)" : ""}
                        </span>
                      ) : (
                        <form action={changeRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={p.id} />
                          <select name="role" defaultValue={p.role} aria-label={`Access for ${p.fullName}`} className={field}>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r].name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="rounded-[7px] border border-line px-2.5 py-1.5 text-xs hover:border-brand">
                            Save
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{p.lastLoginAt ? lastSeen.format(p.lastLoginAt) : "Never"}</td>
                    <td className="px-3 py-2">
                      {locked ? (
                        <span className="text-xs text-muted">Active</span>
                      ) : (
                        <form action={setActiveAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={p.id} />
                          <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                          <span className={`text-xs ${p.active ? "text-brand" : "text-bad"}`}>{p.active ? "Active" : "Turned off"}</span>
                          <button type="submit" className="rounded-[7px] border border-line px-2.5 py-1.5 text-xs hover:border-brand">
                            {p.active ? "Turn off" : "Turn on"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
