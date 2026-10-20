import { redirect } from "next/navigation";

/** The weekly figures were a second copy of the sales and cash numbers already on the Owner overview, so this page now leads there. */
export default function WeeklyPage() {
  redirect("/dashboard");
}
