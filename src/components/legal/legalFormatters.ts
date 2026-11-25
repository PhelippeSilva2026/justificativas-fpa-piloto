const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function formatBrl(value: number, fractionDigits = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}

export function formatBrlCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}R$ ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return formatBrl(safe, 0);
}

export function formatInt(value: number): string {
  const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
  return new Intl.NumberFormat('pt-BR').format(safe);
}

export function formatAnomesLabel(anomes: string): string {
  if (!anomes) return '-';
  const parts = anomes.trim().split('/');
  if (parts.length !== 2) return anomes;
  const year = parts[0].slice(-2);
  const monthIdx = Number(parts[1]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return anomes;
  return `${MONTH_SHORT[monthIdx]}/${year}`;
}

export function calcConsumptionPct(actTotal: number, bgt: number): number | null {
  if (!Number.isFinite(bgt) || Math.abs(bgt) < 0.01) return null;
  // Em Legal, OPEX (BGT e Realizado) é exibido com sinal positivo (-1 * DRE):
  if (bgt > 0) {
    return (actTotal / bgt) * 100;
  }
  // Quando o orçamento prevê reversão líquida negativa (crédito orçado):
  return null;
}

export function getDisponivelTone(
  disponivel: number,
  bgt: number
): { label: string; textClass: string; barFill: string } {
  if (Math.abs(bgt) < 0.01 && Math.abs(disponivel) < 0.01) {
    return {
      label: 'Sem BGT',
      textClass: 'text-[#68756E]',
      barFill: '#94A39D',
    };
  }
  if (disponivel >= 0) {
    const pct = calcConsumptionPct(bgt - disponivel, bgt);
    if (pct !== null && pct >= 85) {
      return {
        label: 'Atenção BGT',
        textClass: 'text-amber-700',
        barFill: '#D97706',
      };
    }
    return {
      label: 'Dentro do BGT',
      textClass: 'text-emerald-700',
      barFill: '#4F927F',
    };
  }
  return {
    label: 'Acima do BGT',
    textClass: 'text-rose-700',
    barFill: '#E11D48',
  };
}
