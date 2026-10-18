/**
 * Business terms in simple words, for readers whose first language is not English. One short sentence each.
 * Shared by the app and the demo, so both explain a term the same way.
 */
export const GLOSSARY = {
  "Gross profit": "Sales minus the cost of the products you sold.",
  "Gross margin": "Gross profit as a percent of sales. It does not include running costs such as salaries and rent.",
  "Net sales": "Money from customers for goods sold. Tax is not included, and returned goods are taken out.",
  "Year to date": "From 1 January until today.",
  "Estimated demand": "How much customers should buy each month, worked out from how much they use the equipment. It is an estimate, not an order.",
  Receivables: "Money that customers owe you for invoices they have not paid yet.",
  Overdue: "Not paid after the due date.",
  "Due date": "The last day the customer should pay the invoice.",
  Aging: "Sorting unpaid invoices by how many days late they are.",
  "Cash collected": "Money you actually received from customers.",
  "Unlinked cash": "Money received that is not matched to an invoice yet.",
  "Owned stock": "Stock that your company bought and owns. Stock kept for other companies is left out.",
  "Unit cost": "What it cost to buy one unit.",
  "Stock cover": "How many days the stock will last at the current speed of sales.",
  "Slow stock": "Stock that sells very slowly, or not at all.",
  "Expiry loss": "The value of stock that may pass its expiry date before it is sold. This is an estimate.",
  Estimate: "A careful guess from past data. It is not a fact.",
  "Days between orders": "The usual number of days between two orders from the same customer.",
  Tender: "A bid for a contract. It usually comes from a government body or a public hospital.",
  "Customer type": "Tender (public buyers) or Private (private buyers).",
  "Therapeutic area": "The medical field where a product is used, for example breathing care.",
  "Product range": "The products you offer in one area.",
  ERP: "The accounting software a company uses to record sales, purchases and stock. Sadaf uses Alpha ERP.",
  CSV: "A simple table file. You can open it in Excel.",
  "Made-up data": "Example numbers created for this demo. They are not real.",
  "Profit after delivery costs": "Gross profit minus direct delivery costs such as freight, installation, training and warranty. It does not include company running costs.",
  "Installed base": "The equipment you have already sold and installed at customers.",
  "Repeat consumables": "Supplies that customers buy again and again to use with your equipment.",
  "Service contract": "An agreement to maintain a customer's equipment for a fee.",
  DSO: "Days sales outstanding: the average number of days customers take to pay.",
  Backlog: "Work that was promised but is not delivered yet.",
  Batch: "A group of units made at the same time. It has one expiry date.",
  SKU: "A code for one product.",
  Usage: "How much customers use the equipment.",
} as const;

export type Term = keyof typeof GLOSSARY;

/** Terms to explain on each screen. Keys are the app's page names. */
export const PAGE_TERMS: Record<string, Term[]> = {
  overview: ["Net sales", "Year to date", "Gross margin", "Cash collected", "Overdue", "Slow stock", "Expiry loss", "Estimate"],
  finance: ["Year to date", "Gross profit", "Gross margin", "Cash collected", "Unlinked cash", "Receivables", "Overdue", "Due date", "Aging"],
  inventory: ["Owned stock", "Unit cost", "Stock cover", "Slow stock", "Expiry loss", "Estimate"],
  opportunities: ["Estimate", "Days between orders", "Overdue", "Receivables"],
  portfolio: ["Therapeutic area", "Customer type", "Tender", "Product range", "Year to date", "Estimate"],
  weekly: ["Cash collected", "Overdue", "Receivables", "Year to date"],
  // Screens that exist only in the demo.
  data: ["ERP", "CSV", "Cash collected", "Overdue", "Receivables"],
  sales: ["Gross profit", "Gross margin", "DSO", "Tender", "Customer type", "Repeat consumables"],
  base: ["Installed base", "Repeat consumables", "Estimated demand", "Service contract", "Usage"],
  tenders: ["Tender", "Backlog", "Gross profit", "Profit after delivery costs"],
  service: ["Service contract", "Installed base", "Usage"],
  opportunityRadar: ["Repeat consumables", "Estimated demand", "Service contract", "Installed base", "Estimate"],
  alpha: ["ERP", "CSV", "Batch", "SKU", "Made-up data"],
  compare: ["ERP", "Made-up data"],
  company: ["ERP", "Made-up data", "Tender"],
};
