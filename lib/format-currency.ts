/**
 * Currency formatting utilities
 *
 * Single source of truth for converting paisa (BigInt) to display strings.
 * Replaces all scattered `Number(bigint) / 100` calls across service files,
 * which lose precision for values > Number.MAX_SAFE_INTEGER and are inconsistent.
 *
 * All internal amounts are stored and passed as BigInt paisa.
 * All display strings are produced here.
 */

/**
 * Format paisa (BigInt) as a rupee display string.
 *
 * @example
 * formatPaisa(100000n)   // "₹1,000.00"
 * formatPaisa(50n)       // "₹0.50"
 * formatPaisa(-100000n)  // "-₹1,000.00"
 */
export function formatPaisa(paisa: bigint): string {
  const negative = paisa < 0n;
  const abs = negative ? -paisa : paisa;

  const rupees = abs / 100n;
  const paise = abs % 100n;

  // Format integer part with Indian comma grouping (1,00,000 style)
  const rupeesStr = formatIndianNumber(rupees);
  const paiseStr = paise.toString().padStart(2, '0');

  return `${negative ? '-' : ''}₹${rupeesStr}.${paiseStr}`;
}

/**
 * Format paisa as plain rupee number string (no symbol, no commas).
 * Used for API responses and computation inputs.
 *
 * @example
 * paisaToRupeeString(100000n) // "1000.00"
 */
export function paisaToRupeeString(paisa: bigint): string {
  const negative = paisa < 0n;
  const abs = negative ? -paisa : paisa;
  const rupees = abs / 100n;
  const paise = abs % 100n;
  return `${negative ? '-' : ''}${rupees}.${paise.toString().padStart(2, '0')}`;
}

/**
 * Parse a rupee string back to paisa BigInt.
 * Handles "1000.00", "1,000.00", "₹1,000.00".
 */
export function rupeeStringToPaisa(rupeeStr: string): bigint {
  const cleaned = rupeeStr.replace(/[₹,\s]/g, '');
  const [intPart, decPart = '00'] = cleaned.split('.');
  const paise = decPart.padEnd(2, '0').slice(0, 2);
  return BigInt(intPart) * 100n + BigInt(paise);
}

function formatIndianNumber(n: bigint): string {
  const str = n.toString();
  if (str.length <= 3) return str;

  // Last 3 digits, then groups of 2
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const groups: string[] = [];

  for (let i = rest.length; i > 0; i -= 2) {
    groups.unshift(rest.slice(Math.max(0, i - 2), i));
  }

  return [...groups, last3].join(',');
}