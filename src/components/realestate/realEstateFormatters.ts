const BRL_FULL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACT_NUM = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MI_1DEC = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const MI_2DEC = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INT_FMT = new Intl.NumberFormat('pt-BR');

export function formatBrl(value: number): string {
  return BRL_FULL.format(Number.isFinite(value) ? value : 0);
}

export function formatBrlCompact(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${BRL_COMPACT_NUM.format(abs / 1_000_000)} Mi`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${BRL_COMPACT_NUM.format(abs / 1_000)} Mil`;
  }
  return BRL_FULL.format(n);
}

export function formatInt(value: number): string {
  return INT_FMT.format(Number.isFinite(value) ? Math.round(value) : 0);
}

export function formatExcelNumber(
  value: number,
  options: { unit: 'mi' | 'full'; decimals?: 1 | 2; excelSign?: boolean }
): string {
  const raw = Number.isFinite(value) ? value : 0;
  const signed = options.excelSign === false ? raw : -raw;
  const scaled = options.unit === 'mi' ? signed / 1_000_000 : signed;
  const threshold = options.unit === 'mi' ? 0.049 : 0.49;

  if (Math.abs(scaled) < threshold) {
    return '-';
  }

  const fmt =
    options.unit === 'mi'
      ? options.decimals === 2
        ? MI_2DEC
        : MI_1DEC
      : BRL_COMPACT_NUM;

  const formattedAbs = fmt.format(Math.abs(scaled));
  return scaled < 0 ? `(${formattedAbs})` : formattedAbs;
}

const MONTH_LABELS: Record<string, string> = {
  '1': 'Jan',
  '01': 'Jan',
  '2': 'Fev',
  '02': 'Fev',
  '3': 'Mar',
  '03': 'Mar',
  '4': 'Abr',
  '04': 'Abr',
  '5': 'Mai',
  '05': 'Mai',
  '6': 'Jun',
  '06': 'Jun',
  '7': 'Jul',
  '07': 'Jul',
  '8': 'Ago',
  '08': 'Ago',
  '9': 'Set',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

export function formatAnomesLabel(anomes: string): string {
  const parts = String(anomes || '').split('/');
  if (parts.length !== 2) return anomes;
  const m = MONTH_LABELS[parts[1]] || parts[1];
  const yr = parts[0].slice(-2);
  return `${m}/${yr}`;
}
