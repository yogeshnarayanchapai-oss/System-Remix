export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return formatCurrency(amount, 'USD');
}

export function formatNPR(amount: number): string {
  return formatCurrency(amount, 'NPR');
}

export function formatCompactNPR(amount: number): string {
  if (!Number.isFinite(amount)) return formatNPR(amount);

  const totalPaise = Math.round(Math.abs(amount) * 100);
  let remainingRupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const parts: string[] = [];

  const crore = Math.floor(remainingRupees / 10_000_000);
  if (crore > 0) {
    parts.push(`${crore}cr`);
    remainingRupees %= 10_000_000;

    const lakh = Math.floor(remainingRupees / 100_000);
    if (lakh > 0) parts.push(`${lakh}l`);
    remainingRupees %= 100_000;
  } else if (remainingRupees >= 1_000_000) {
    const lakh = Math.floor(remainingRupees / 100_000);
    parts.push(`${lakh} lakh`);
    remainingRupees %= 100_000;
  }

  if (remainingRupees >= 1_000) {
    const thousand = Math.floor(remainingRupees / 1_000);
    parts.push(`${thousand}k`);
    remainingRupees %= 1_000;
  }

  if (parts.length === 0) {
    parts.push(new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Math.floor(Math.abs(amount))));
  }

  return `${amount < 0 ? '-' : ''}${parts.join(' ')}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getDateRangeLabel(days: number): string {
  if (days === 7) return 'Last 7 Days';
  if (days === 30) return 'Last 30 Days';
  return `Last ${days} Days`;
}
