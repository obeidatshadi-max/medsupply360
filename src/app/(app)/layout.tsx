import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { logoutAction } from "@/server/actions/auth";
import { AppFrame } from "@/components/app-frame";
import { DashboardUpdateStatus } from "@/components/dashboard-update-status";
import { DEMO_AS_OF } from "@/demo/dataset";
import { lastImportText } from "@/lib/last-import";
import { LevelSwitch } from "@/components/level-switch";
import { showsLevelSwitch } from "@/core/level";
import { currentLevel } from "@/lib/level";
import { navItems } from "@/lib/nav";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser("any");
  const integration = user.guest ? undefined : await lastImportText(user.companyId);
  const level = await currentLevel();
  const { main, explore } = navItems({ guest: user.guest, role: user.role, level });

  const banner = user.guest ? (
    <p className="flex justify-between gap-2.5 border-b border-line bg-[#eef3eb] px-4 py-[9px] text-[11px] text-[#657367] md:px-[18px]">
      <span>
        <b>Open access:</b> you are browsing as a guest. No company data is shown.
      </span>
      <a className="underline" href="/login">
        Sign in
      </a>
    </p>
  ) : null;

  const topRight = user.guest ? (
    <>
      <span className="hidden rounded-[5px] bg-[#f6efdf] px-2 py-[3px] text-[11px] font-semibold text-[#8c6a2e] md:inline">SYNTHETIC DATA</span>
      <a href="/login" className="rounded-[7px] border border-line px-3 py-1.5 text-sm hover:border-brand hover:bg-[#f0f6f2]">
        Sign in
      </a>
    </>
  ) : (
    <>
      {showsLevelSwitch(user.role) ? <LevelSwitch current={level} /> : null}
      <form action={logoutAction} className="flex items-center gap-3 text-sm">
        <span className="hidden text-muted md:inline">
          {user.fullName} · {user.role}
        </span>
        <button type="submit" className="rounded-[7px] border border-line px-3 py-1.5 hover:border-brand hover:bg-[#f0f6f2]">
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <AppFrame
      main={main}
      explore={explore}
      fullName={user.guest ? "Guest" : user.fullName}
      initials={user.guest ? "G" : initialsOf(user.fullName)}
      companyName={user.companyName}
      banner={banner}
      topRight={topRight}
      status={<DashboardUpdateStatus sampleAsOf={user.guest ? DEMO_AS_OF : undefined} integration={integration} />}
    >
      {children}
    </AppFrame>
  );
}
