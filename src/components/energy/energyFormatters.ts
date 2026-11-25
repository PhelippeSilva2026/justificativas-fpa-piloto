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

const MONTH_LABELS: Record<string, string> = {
  '1': 'Jan/26',
  '2': 'Fev/26',
  '3': 'Mar/26',
  '4': 'Abr/26',
  '5': 'Mai/26',
  '6': 'Jun/26',
  '7': 'Jul/26',
  '8': 'Ago/26',
  '9': 'Set/26',
  '10': 'Out/26',
  '11': 'Nov/26',
  '12': 'Dez/26',
};

export function formatAnomesLabel(anomes: string): string {
  const parts = String(anomes || '').split('/');
  if (parts.length !== 2) return anomes;
  return MONTH_LABELS[parts[1]] || anomes;
}
