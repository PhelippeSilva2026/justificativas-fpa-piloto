export type PlatformPageId =
  | 'hub'
  | 'closing-justifications'
  | 'energy'
  | 'real-estate'
  | 'legal'
  | 'travel'
  | 'engineering'
  | 'operations'
  | 'marketing'
  | 'central-plano-fim';

export type FinancialModuleId = Exclude<PlatformPageId, 'hub'>;

export interface FinancialModuleConfig {
  id: FinancialModuleId;
  title: string;
  description: string;
  iconName:
    | 'BarChart3'
    | 'FileCheck2'
    | 'Zap'
    | 'Building2'
    | 'Scale'
    | 'Plane'
    | 'HardHat'
    | 'Settings2'
    | 'Megaphone';
}

export const FINANCIAL_MODULES: FinancialModuleConfig[] = [
  {
    id: 'central-plano-fim',
    title: 'Plan Fin Executivo',
    description: 'Visão executiva OPEX V.tal — Orçado, Realizado e Forecasts por Pacote.',
    iconName: 'BarChart3',
  },
  {
    id: 'closing-justifications',
    title: 'Fechamento e Justificativas',
    description: 'Análise mensal, desvios e justificativas por empresa.',
    iconName: 'FileCheck2',
  },
  {
    id: 'energy',
    title: 'Energia',
    description: 'Consumo, contratos, orçamento e eficiência energética.',
    iconName: 'Zap',
  },
  {
    id: 'real-estate',
    title: 'Real Estate',
    description: 'Imóveis, ocupação, contratos e despesas patrimoniais.',
    iconName: 'Building2',
  },
  {
    id: 'legal',
    title: 'Legal',
    description: 'Custos jurídicos, processos, escritórios e contingências.',
    iconName: 'Scale',
  },
  {
    id: 'travel',
    title: 'Viagens',
    description: 'Despesas, fornecedores, destinos e aderência às políticas.',
    iconName: 'Plane',
  },
  {
    id: 'engineering',
    title: 'Engenharia',
    description: 'Projetos, implantação, materiais e acompanhamento financeiro.',
    iconName: 'HardHat',
  },
  {
    id: 'operations',
    title: 'Operações',
    description: 'Indicadores operacionais, custos e eficiência.',
    iconName: 'Settings2',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Campanhas, mídia, fornecedores e retorno dos investimentos.',
    iconName: 'Megaphone',
  },
];
