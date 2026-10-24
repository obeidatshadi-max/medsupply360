import { NextResponse } from "next/server";
import { canAccess } from "@/core/permissions";
import { hasAwardResult, prefillFileName, prefillRows, rowsToCsv } from "@/core/tender-results-prefill";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { awardDateOf } from "@/lib/award-date";
import { listTenderItems } from "@/server/services/tender-items";
import { getTender } from "@/server/services/tenders";

/** The Price history results file for one decided tender, with the cells the tender already knows filled in. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.guest || !canAccess(user.role, "tender")) return new NextResponse("Not allowed", { status: 403 });
  const { id } = await params;
  const found = await getTender(getDb(), user.companyId, id);
  if (!found) return new NextResponse("Not found", { status: 404 });
  const { tender: t, history } = found;
  if (!hasAwardResult(t.status)) return new NextResponse("This tender has no award result yet", { status: 409 });
  const items = await listTenderItems(getDb(), user.companyId, t.id);
  const rows = prefillRows({ authority: t.authority, tenderNo: t.tenderNo, title: t.title, status: t.status, awardDate: awardDateOf(history), winnerName: t.winnerName }, user.companyName, items);
  return new NextResponse(rowsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${prefillFileName(t)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
