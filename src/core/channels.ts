/**
 * The three ways data reaches the app. Pure, so the app and the demo describe a channel in the same words.
 *
 *   erp      files exported from the accountant's Alpha ERP.
 *   tender   what the tender department records (one tender at a time, or a tender list from Excel).
 *   manual   everything Alpha does not hold: installed equipment, sales targets, the sales force.
 */
import type { ImportKind } from "@/core/import/specs";

export const CHANNELS = ["erp", "tender", "manual"] as const;
export type Channel = (typeof CHANNELS)[number];

export type ChannelInfo = {
  key: Channel;
  title: string;
  href: string;
  /** One line under the title on the hub card. */
  summary: string;
  /** Who normally feeds this channel. */
  feeder: string;
  /** File types the channel accepts through upload. */
  kinds: readonly ImportKind[];
  /** A channel is stale when nothing arrived for this many days. */
  staleAfterDays: number;
};

export const CHANNEL_INFO: Record<Channel, ChannelInfo> = {
  erp: {
    key: "erp",
    title: "ERP system",
    href: "/imports/erp",
    summary: "Alpha ERP exports: products, customers, sales, receipts, unpaid invoices and stock.",
    feeder: "Accountant",
    kinds: ["products", "customers", "sales", "receipts", "open_invoices", "stock_snapshot", "stock_transactions"],
    staleAfterDays: 7,
  },
  tender: {
    key: "tender",
    title: "Tender department",
    href: "/imports/tenders",
    summary: "Tenders, their stages, guarantees and payments, entered by the tender team or loaded from an Excel list.",
    feeder: "Tender department",
    kinds: ["tenders"],
    staleAfterDays: 14,
  },
  manual: {
    key: "manual",
    title: "Manual entry",
    href: "/imports/manual",
    summary: "Data that is not in Alpha: installed equipment, the sales force and their targets.",
    feeder: "Owner",
    kinds: ["installed_units", "sales_people"],
    staleAfterDays: 60,
  },
};

/** The channel an uploaded file type belongs to; used to point a person to the right place when a file lands in the wrong one. */
export function channelOfKind(kind: ImportKind): Channel {
  return CHANNELS.find((c) => (CHANNEL_INFO[c].kinds as readonly ImportKind[]).includes(kind)) ?? "erp";
}

export type ChannelState = "never" | "fresh" | "stale";

export type ChannelStatus = {
  channel: Channel;
  /** When the channel last received data (ISO date-time), or null. */
  lastUpdate: string | null;
  /** The name typed on the form for that update, when known. */
  by: string | null;
  /** Short facts for the card, e.g. "7 of 7 files loaded". */
  facts: string[];
  /** What the channel still needs, in plain words. Empty when nothing is missing. */
  missing: string[];
};

const DAY = 86_400_000;

/** Whole days between an update and now, never negative. */
export function daysSince(lastUpdate: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / DAY));
}

export function channelState(status: Pick<ChannelStatus, "channel" | "lastUpdate">, now: Date): ChannelState {
  if (status.lastUpdate === null) return "never";
  return daysSince(status.lastUpdate, now) > CHANNEL_INFO[status.channel].staleAfterDays ? "stale" : "fresh";
}

/** The sentence on a card about when the channel was last fed. */
export function lastUpdateText(status: ChannelStatus, now: Date): string {
  if (status.lastUpdate === null) return "Nothing received yet";
  const d = daysSince(status.lastUpdate, now);
  const when = d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  return `Last update ${when}${status.by ? ` by ${status.by}` : ""}`;
}
