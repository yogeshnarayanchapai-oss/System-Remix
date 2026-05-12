// NPR formatter using Crore (CRS) and Lakh (L) abbreviations.
// 1 Lakh = 100,000 ; 1 Crore = 10,000,000

export function formatNprShort(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_00_00_000) {
    return `${sign}${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}${(abs / 1_00_000).toFixed(2)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}${abs.toFixed(2)}`;
}

// Indian numbering: 1,89,25,000.00
export function formatNprFull(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'NPR 0.00';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const [intPartRaw, decPart = '00'] = abs.toFixed(2).split('.');
  let result = '';
  const reversed = intPartRaw.split('').reverse().join('');
  for (let i = 0; i < reversed.length; i++) {
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) result += ',';
    result += reversed[i];
  }
  return sign + 'NPR ' + result.split('').reverse().join('') + '.' + decPart;
}

export function dayOfWeek(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export const NETWORTH_GROUPS = [
  { value: 'INCOME', label: 'Income', type: 'ASSET' },
  { value: 'EXPENSE', label: 'Expense', type: 'LIABILITY' },
  { value: 'LIQUID_ASSETS', label: 'Liquid Assets', type: 'ASSET' },
  { value: 'INVESTED_ASSETS', label: 'Invested Assets', type: 'ASSET' },
  { value: 'CONSUMABLE_ASSETS', label: 'Consumable Assets', type: 'ASSET' },
  { value: 'SHORT_TERM_LIABILITIES', label: 'Short-Term Liabilities', type: 'LIABILITY' },
  { value: 'LONG_TERM_LIABILITIES', label: 'Long-Term Liabilities', type: 'LIABILITY' },
] as const;

export type NetworthGroup = typeof NETWORTH_GROUPS[number]['value'];
export type NetworthType = 'ASSET' | 'LIABILITY';

export function groupLabel(group: string): string {
  return NETWORTH_GROUPS.find((g) => g.value === group)?.label || group;
}
