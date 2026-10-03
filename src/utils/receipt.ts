/**
 * Receipt-number generation.
 *
 * The old scheme used `transactions.length + 1`, which re-issues a number
 * after any deletion and collides across devices. This derives the next
 * sequence from the highest sequence already used for the same prefix/date
 * (so deletions can never cause reuse on one device) and optionally appends
 * a short per-device tag so two devices never mint the same string.
 * The existing display format (e.g. MJRC-20260926-00346) is unchanged.
 */

export interface ReceiptSpec {
  prefix: string;
  /** e.g. '20260926'. Omit for formats with no date segment (GAS-000001). */
  datePart?: string;
  /** Zero-pad width of the sequence. */
  width: number;
  /** Receipt numbers already known on this device (all statuses). */
  existing: Array<string | undefined | null>;
  /** Optional 3-4 char device tag, e.g. 'A3F'. When set it is appended as '-A3F'. */
  deviceTag?: string;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function receiptStem(prefix: string, datePart?: string): string {
  return datePart ? `${prefix}-${datePart}-` : `${prefix}-`;
}

/** Returns the sequence number embedded in `receipt` for this stem, or null if it does not match. */
export function parseReceiptSeq(receipt: string | undefined | null, prefix: string, datePart?: string): number | null {
  if (!receipt) return null;
  const re = new RegExp(`^${escapeRe(receiptStem(prefix, datePart))}(\\d+)(?:-[A-Z0-9]{3,4})?$`);
  const m = re.exec(receipt);
  return m ? parseInt(m[1], 10) : null;
}

export function nextReceiptNumber(spec: ReceiptSpec): string {
  let max = 0;
  for (const r of spec.existing) {
    const seq = parseReceiptSeq(r, spec.prefix, spec.datePart);
    if (seq !== null && seq > max) max = seq;
  }
  const seq = String(max + 1).padStart(spec.width, '0');
  const tag = spec.deviceTag ? `-${spec.deviceTag.toUpperCase()}` : '';
  return `${receiptStem(spec.prefix, spec.datePart)}${seq}${tag}`;
}

/** Stable short tag derived from a device UUID (first 3 hex chars, upper-cased). */
export function deviceTagFromId(deviceId: string): string {
  const hex = deviceId.replace(/[^0-9a-fA-F]/g, '');
  return (hex.slice(0, 3) || 'DEV').toUpperCase();
}
