import { NextResponse } from "next/server";
import { canAccess } from "@/core/permissions";
import { templateCsv } from "@/core/tender-results-guide";
import { getCurrentUser } from "@/lib/auth/current-user";
import { demoTenderResultsCsv } from "@/demo/tender-prices-demo";

const FILES = {
  template: { name: "tender-results-template.csv", body: templateCsv },
  sample: { name: "tender-results-MADE-UP-sample.csv", body: demoTenderResultsCsv },
} as const;

/** The empty template and the made-up sample file. Only people who may open the tender section can fetch them. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.guest || !canAccess(user.role, "tender")) return new NextResponse("Not allowed", { status: 403 });
  const which = new URL(request.url).searchParams.get("file");
  const file = which === "template" || which === "sample" ? FILES[which] : null;
  if (!file) return new NextResponse("Unknown file", { status: 404 });
  return new NextResponse(file.body(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
