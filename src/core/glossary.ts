/**
 * Business terms in simple words, for readers whose first language is not English.
 * Shared by the app and the demo, so both explain a term the same way.
 *
 * Three levels, shown only where they help:
 *  1. `short`   - one plain sentence. Always available (cards, lists, the info popover).
 *  2. `example` - one practical example with made-up round numbers.
 *  3. `why` and `action` - "Why it matters" and "What you can do". Shown under "Learn more".
 *
 * `ar` is reserved for the Arabic version. Leave it empty until a native speaker has reviewed the words.
 */
export type GlossaryCategory = "Sales and profit" | "Cash and payments" | "Stock" | "Customers and tenders" | "Equipment and service" | "Data and systems";

export interface GlossaryEntry {
  /** Stable id for tests, links and translation files. Never reuse an id for a different term. */
  id: string;
  /** The professional term, exactly as written on screen. */
  term: string;
  category: GlossaryCategory;
  short: string;
  example?: string;
  why?: string;
  action?: string;
  ar?: { term?: string; short?: string; example?: string; why?: string; action?: string };
}

const entry = (id: string, term: string, category: GlossaryCategory, short: string, more: Pick<GlossaryEntry, "example" | "why" | "action"> = {}) =>
  ({ id, term, category, short, ...more }) as const;

export const GLOSSARY_ENTRIES = [
  entry("gross-profit", "Gross profit", "Sales and profit", "Sales minus the cost of the products you sold.", {
    example: "You sell goods for JOD 100,000 that cost you JOD 70,000. Gross profit is JOD 30,000.",
    why: "It is the money left to pay salaries, rent and other running costs. It is not the final profit.",
    action: "Compare it by product line. Look at the lines with a low margin.",
  }),
  entry("gross-margin", "Gross margin", "Sales and profit", "Gross profit as a percent of sales. It does not include running costs such as salaries and rent.", {
    example: "Gross profit of JOD 30,000 on sales of JOD 100,000 is a margin of 30%.",
    why: "A low margin means each sale leaves little money to cover your other costs.",
    action: "Check prices and product costs for the lines with the lowest margin.",
  }),
  entry("net-sales", "Net sales", "Sales and profit", "Money from customers for goods sold. Tax is not included, and returned goods are taken out."),
  entry("year-to-date", "Year to date", "Sales and profit", "From 1 January until today.", {
    why: "We compare it with the same dates last year, so both periods have the same length.",
  }),
  entry("estimated-demand", "Estimated demand", "Equipment and service", "How much customers should buy each month, worked out from how much they use the equipment. It is an estimate, not an order."),
  entry("receivables", "Receivables", "Cash and payments", "Money that customers owe you for invoices they have not paid yet.", {
    example: "You sent 10 invoices and customers have not paid 4 of them. The total of those 4 invoices is your receivables.",
    why: "This money is already earned, but you cannot use it until customers pay.",
    action: "Open the list of overdue customers and agree a payment date with each one.",
  }),
  entry("overdue", "Overdue", "Cash and payments", "Not paid after the due date.", {
    example: "An invoice is due on 1 September. On 20 September it is 19 days overdue.",
    why: "The longer an invoice is overdue, the harder it usually is to collect.",
    action: "Call the customers with the largest or oldest overdue invoices first.",
  }),
  entry("due-date", "Due date", "Cash and payments", "The last day the customer should pay the invoice."),
  entry("aging", "Aging", "Cash and payments", "Sorting unpaid invoices by how many days late they are.", {
    example: "Invoices 1 to 30 days late go in one group. Invoices over 90 days late go in another.",
    why: "Old invoices are the most risky. Aging shows how much money is in each group.",
    action: "Start with the oldest group. Ask finance for a payment plan.",
  }),
  entry("cash-collected", "Cash collected", "Cash and payments", "Money you actually received from customers."),
  entry("unlinked-cash", "Unlinked cash", "Cash and payments", "Money received that is not matched to an invoice yet.", {
    why: "Until the money is matched, the invoice can still look unpaid.",
    action: "Ask finance to match each payment to its invoice.",
  }),
  entry("owned-stock", "Owned stock", "Stock", "Stock that your company bought and owns. Stock kept for other companies is left out."),
  entry("unit-cost", "Unit cost", "Stock", "What it cost to buy one unit."),
  entry("stock-cover", "Stock cover", "Stock", "How many days the stock will last at the current speed of sales.", {
    example: "You hold 600 units and sell 20 units a day. Your stock cover is 30 days.",
    why: "Too little cover can mean empty shelves. Too much cover ties up money and risks expiry.",
    action: "Re-order products with low cover. Stop buying products with very high cover.",
  }),
  entry("slow-stock", "Slow stock", "Stock", "Stock that sells very slowly, or not at all.", {
    why: "Slow stock holds your money and can pass its expiry date before it sells.",
    action: "Offer it to customers first, or ask the supplier about a return or an exchange.",
  }),
  entry("expiry-loss", "Expiry loss", "Stock", "The value of stock that may pass its expiry date before it is sold. This is an estimate.", {
    example: "A batch is worth JOD 5,000 and expires in 2 months. At the current speed of sales only half will sell. The possible loss is about JOD 2,500.",
    why: "Expired goods cannot be sold. The money is lost.",
    action: "Sell batches with the nearest expiry date first. Look for a customer who can use them soon.",
  }),
  entry("estimate", "Estimate", "Data and systems", "A careful guess from past data. It is not a fact."),
  entry("days-between-orders", "Days between orders", "Customers and tenders", "The usual number of days between two orders from the same customer."),
  entry("tender", "Tender", "Customers and tenders", "A bid for a contract. It usually comes from a government body or a public hospital."),
  entry("customer-type", "Customer type", "Customers and tenders", "Tender (public buyers) or Private (private buyers)."),
  entry("therapeutic-area", "Therapeutic area", "Customers and tenders", "The medical field where a product is used, for example breathing care."),
  entry("product-range", "Product range", "Customers and tenders", "The products you offer in one area."),
  entry("erp", "ERP", "Data and systems", "The accounting software a company uses to record sales, purchases and stock. Sadaf uses Alpha ERP."),
  entry("csv", "CSV", "Data and systems", "A simple table file. You can open it in Excel."),
  entry("made-up-data", "Made-up data", "Data and systems", "Example numbers created for this demo. They are not real."),
  entry("profit-after-delivery", "Profit after delivery costs", "Sales and profit", "Gross profit minus direct delivery costs such as freight, installation, training and warranty. It does not include company running costs."),
  entry("installed-base", "Installed base", "Equipment and service", "The equipment you have already sold and installed at customers.", {
    why: "Each installed device can bring repeat orders for supplies and service work.",
    action: "Check devices with no service contract or with low supply orders.",
  }),
  entry("repeat-consumables", "Repeat consumables", "Equipment and service", "Supplies that customers buy again and again to use with your equipment."),
  entry("service-contract", "Service contract", "Equipment and service", "An agreement to maintain a customer's equipment for a fee."),
  entry("dso", "DSO", "Cash and payments", "Days sales outstanding: the average number of days customers take to pay.", {
    example: "If DSO is 60, customers take about 60 days to pay after you invoice them.",
    why: "A high DSO means your money is tied up with customers for a long time.",
    action: "Agree shorter payment terms, or follow up earlier on unpaid invoices.",
  }),
  entry("backlog", "Backlog", "Customers and tenders", "Work that was promised but is not delivered yet."),
  entry(
    "bank-guarantee",
    "Bank guarantee",
    "Customers and tenders",
    "Money a bank holds for a tender: a bid guarantee with the offer, a performance guarantee once the contract is signed. It is tied up until the bank returns it.",
    {
      why: "While the guarantee is open, that money or credit limit is not available for other uses.",
      action: "Track the return date of each guarantee and ask the bank to release it on time.",
    },
  ),
  entry("win-rate", "Win rate", "Customers and tenders", "Tenders won divided by tenders decided (won plus lost). Tenders still waiting for a decision are not counted.", {
    example: "You won 3 tenders and lost 7. Your win rate is 3 out of 10, or 30%.",
    why: "A low win rate can mean your prices or offers do not match what buyers want.",
    action: "Review the lost tenders and compare your price with the winning price.",
  }),
  entry("batch", "Batch", "Stock", "A group of units made at the same time. It has one expiry date."),
  entry("sku", "SKU", "Stock", "A code for one product."),
  entry("usage", "Usage", "Equipment and service", "How much customers use the equipment."),
] as const satisfies readonly GlossaryEntry[];

export type Term = (typeof GLOSSARY_ENTRIES)[number]["term"];

/** Short sentence per term. This is the level-1 text used by the cards and lists. */
export const GLOSSARY = Object.fromEntries(GLOSSARY_ENTRIES.map((e) => [e.term, e.short])) as { readonly [T in Term]: string };

const BY_TERM = new Map<string, GlossaryEntry>(GLOSSARY_ENTRIES.map((e) => [e.term, e]));

/** The full entry for a term, or undefined when the term is not in the glossary. */
export const glossaryEntry = (term: string): GlossaryEntry | undefined => BY_TERM.get(term);

/** True when the term has more to say than its one-line meaning, so a "Learn more" section is worth showing. */
export const hasMore = (e: GlossaryEntry): boolean => Boolean(e.example || e.why || e.action);

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
  tenders: ["Tender", "Bank guarantee", "Win rate"],
  service: ["Service contract", "Installed base", "Usage"],
  opportunityRadar: ["Repeat consumables", "Estimated demand", "Service contract", "Installed base", "Estimate"],
  alpha: ["ERP", "CSV", "Batch", "SKU", "Made-up data"],
  compare: ["ERP", "Made-up data"],
  company: ["ERP", "Made-up data", "Tender"],
};
