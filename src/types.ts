export interface DRERow {
  id: string;
  diretoria?: string; // DIRETORIA_NIO
  area?: string; // AREA_NIO
  responsavel: string;
  n1: string;
  n2: string;
  n3: string; // Subcategoria - chave
  realMMinus1: number; // Real M-1
  realCurrent: number; // Real Atual
  orcadoCurrent: number; // Orçado Atual
  diffOrcadoAbs: number; // ∆ Orçado #
  diffOrcadoPct: number; // ∆ Orçado %
  diffMMinus1Abs: number; // R$ ∆ M-1
  diffMMinus1Pct: number; // % ∆ M-1
  realYTD: number; // Real YTD
  orcadoYTD: number; // Orçado YTD
  diffOrcadoYTDAbs: number; // ∆ Orçado # YTD
  diffOrcadoYTDPct: number; // ∆ Orçado % YTD
}

export interface GcpRawRecord {
  diretoria: string;
  area: string;
  responsavel: string;
  n1: string;
  n2: string;
  n3: string;
  anomes: string; // ex: '2026/1', '2026/8'
  tipo: string; // 'ACTUAL 2026', 'Budget 2026'
  valor: number;
}

export interface DeviationImpact {
  id: string;
  name: string;
  value: number; // Em R$ (positivo aumenta, negativo reduz)
  justification: string;
}

export interface RowJustifications {
  momImpacts: DeviationImpact[]; // MoM (Real M-1 -> Real Atual)
  vsOrcadoImpacts: DeviationImpact[]; // Vs Orçado Mês (Real Atual -> Orçado)
  ytdImpacts: DeviationImpact[]; // Vs Orçado YTD (Real YTD -> Orçado YTD)
}

export interface DREWorkbook {
  monthPrevious: string; // ex: "2026/7" ou "Jul/2026"
  monthCurrent: string; // ex: "2026/8" ou "Ago/2026"
  rows: DRERow[];
  rawRecords?: GcpRawRecord[];
}

export interface WaterfallBarItem {
  label: string;
  category: 'base' | 'positive' | 'negative' | 'subtotal' | 'total';
  startValue: number;
  endValue: number;
  changeValue: number; // o valor do impacto
  displayValue: number;
  color: string;
}

export type CompanyId = 'nio' | 'vtal' | 'tecto';

export interface CompanyInfo {
  id: CompanyId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  headerBg: string;
  headerBorder: string;
  cardBorder: string;
  accentText: string;
  storageKey: string;
  excelFileName: string;
  defaultResponsible: string;
  sectors: string[];
}
