// Competência de fechamento: independente da data do calendário e de cargas futuras.
export const EDITABLE_JUSTIFICATION_PERIOD = '2026/10';
export const REPORT_MONTH = '2026-10';
export const AVAILABLE_REPORT_PERIODS = Array.from({ length: 10 }, (_, i) => `2026/${i + 1}`);
export const JUSTIFICATIONS_CACHE_VERSION = 'v4';

export function previousReportPeriod(period: string): string {
  const [year, month] = period.split('/').map(Number);
  return month === 1 ? `${year - 1}/12` : `${year}/${month - 1}`;
}

// Marco permanente: novos ciclos não herdam textos nem impactos de outro mês.
export function requiresExactJustifications(period: string): boolean {
  const [year, month] = period.split('/').map(Number);
  return year * 12 + month >= 2026 * 12 + 10;
}

export function exactPeriodJustifications<T extends {
  momImpacts?: unknown[]; vsOrcadoImpacts?: unknown[]; ytdImpacts?: unknown[];
}>(exact?: T) {
  return {
    momImpacts: [...(exact?.momImpacts || [])],
    vsOrcadoImpacts: [...(exact?.vsOrcadoImpacts || [])],
    ytdImpacts: [...(exact?.ytdImpacts || [])],
    suppressHistorical: true,
  };
}
