/**
 * Plain explanation behind each "needs your attention" item, in the order a busy owner needs it:
 * what we found (the alert text), what it may mean, why it matters, what to do next.
 *
 * Rules for the wording:
 *  - "found" is a fact from the imported files. It lives in the alert text itself.
 *  - "means" lists POSSIBLE reasons. The app cannot know the real reason, so it must never say "because".
 *  - "next" is one practical step.
 * Shared by the app and the demo.
 */
export type InsightTopic = "sales" | "cash" | "overdue" | "stock";

export interface InsightHelp {
  /** Possible reasons. Always worded as possibilities, not facts. */
  means: string;
  why: string;
  next: string;
}

export const INSIGHT_HELP: Record<InsightTopic, InsightHelp> = {
  overdue: {
    means: "Customers have not paid by the due date. This may be a late payment, a dispute, or a payment that is not matched to its invoice yet.",
    why: "You have earned this money, but you cannot use it. It can leave less cash to pay suppliers.",
    next: "Call the customers with the largest and oldest overdue invoices. Then check that recent payments are matched to invoices.",
  },
  cash: {
    means: "You received less money than in the same period last year. Possible reasons are lower sales, slower payments, or receipts that are not imported yet.",
    why: "Cash pays salaries, suppliers and rent. Lower cash can cause problems even when sales are good.",
    next: "Check that the receipts file is up to date. Then compare with the overdue payments.",
  },
  sales: {
    means: "You sold less than in the same period last year. Possible reasons are fewer orders, lost tenders, or a sales file that is not up to date.",
    why: "Lower sales reduce the money available to cover your running costs.",
    next: "Check that the sales file is up to date. Then see which product line or customer type fell the most.",
  },
  stock: {
    means: "Part of your stock sells slowly or may pass its expiry date. The expiry loss is an estimate from the current speed of sales, not a fact.",
    why: "Slow stock holds your money. Expired stock cannot be sold, so the money is lost.",
    next: "Sell the batches with the nearest expiry date first. Pause new orders for slow products until stock falls.",
  },
};

/** The demo names some alerts differently. This maps them to the four topics. */
export const DEMO_ALERT_TOPIC: Record<string, InsightTopic> = {
  collection: "overdue",
  expiry: "stock",
};
