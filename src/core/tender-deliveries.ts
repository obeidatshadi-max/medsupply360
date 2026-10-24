/**
 * Part deliveries of a contracted tender. Each delivery records a date, the value delivered (JOD, at contract prices) and a
 * note. The progress against the contract value is worked out here for the tender page, the owner's overview and the tests.
 * Item lines are optional on a tender, so progress is measured in money, which every contracted tender has.
 */

const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

export interface DeliveryAmount {
  deliveredOn: string;
  /** Value delivered at contract prices, or null when the person did not enter it. */
  value: number | null;
}

export interface DeliveryProgress {
  count: number;
  /** Sum of the values entered. Deliveries without a value are counted in `count` but add nothing. */
  deliveredValue: number;
  /** How many deliveries have no value, so the delivered total is a floor. */
  withoutValue: number;
  /** Contract value minus delivered value, never below zero. Null when the contract value is not known. */
  outstanding: number | null;
  /** Delivered as a share of the contract value (0-100, one decimal; may exceed 100). Null when it cannot be worked out. */
  percent: number | null;
  /** Delivered value above the contract value, or 0. A variation order is normal, so it is flagged, not refused. */
  overDelivered: number;
  lastDeliveredOn: string | null;
}

export function deliveryProgress(contractValue: number | null, deliveries: readonly DeliveryAmount[]): DeliveryProgress {
  const deliveredValue = round3(deliveries.reduce((s, d) => s + (d.value ?? 0), 0));
  const known = contractValue !== null && contractValue > 0;
  return {
    count: deliveries.length,
    deliveredValue,
    withoutValue: deliveries.filter((d) => d.value === null).length,
    outstanding: known ? round3(Math.max(0, contractValue - deliveredValue)) : null,
    percent: known ? Math.round((deliveredValue / contractValue) * 1000) / 10 : null,
    overDelivered: known ? round3(Math.max(0, deliveredValue - contractValue)) : 0,
    lastDeliveredOn: deliveries.length === 0 ? null : deliveries.map((d) => d.deliveredOn).sort().at(-1)!,
  };
}

export const NOTE_MAX = 500;

export interface DeliveryForm {
  deliveredOn: string;
  value: string;
  note: string;
}
