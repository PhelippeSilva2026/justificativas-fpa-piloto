export interface PlanFinFilterState {
  anomes: string;
  pacote: string;
  subPacote: string;
}

export interface PlanFinMonthOption {
  value: string;
  monthNum: number;
  hasFullActual: boolean;
}

export interface PlanFinPacoteOption {
  value: string;
  label: string;
  rows: number;
  bgtFy: number;
}

export interface PlanFinSubPacoteOption {
  value: string;
  label: string;
  pacote: string;
  rows: number;
  bgtFy: number;
}

export interface PlanFinFilterOptions {
  defaultAnomes: string;
  maxClosedMonth: number;
  months: PlanFinMonthOption[];
  pacotes: PlanFinPacoteOption[];
  subPacotes: PlanFinSubPacoteOption[];
}

export interface PlanFinScenarioMetrics {
  bgtMonth: number;
  actMonth: number;
  fct102Month: number;
  fct84Month: number;
  bgtYtd: number;
  actYtd: number;
  fct102Ytd: number;
  fct84Ytd: number;
  bgtFy: number;
  fct102Fy: number;
  fct84Fy: number;
  fct48Fy: number;
}

export interface PlanFinClassificationRow extends PlanFinScenarioMetrics {
  key: string;
  classificacao: string;
}

export interface PlanFinSubPacoteRow extends PlanFinScenarioMetrics {
  key: string;
  pacote: string;
  subPacote: string;
  filterValue: string;
  classifications: PlanFinClassificationRow[];
}

export interface PlanFinPacoteRow extends PlanFinScenarioMetrics {
  key: string;
  pacote: string;
  filterValue: string;
  subPackages: PlanFinSubPacoteRow[];
}

export interface PlanFinSummary extends PlanFinScenarioMetrics {
  distinctPacotes: number;
  distinctSubPacotes: number;
  distinctClassifs: number;
}

export interface PlanFinMonthlyPoint {
  monthNum: number;
  anomes: string;
  bgt: number;
  act: number;
  fct102: number;
  fct84: number;
}

export interface PlanFinDashboardData {
  refMonth: number;
  maxClosedMonth: number;
  summary: PlanFinSummary;
  packages: PlanFinPacoteRow[];
  monthlyTrend: PlanFinMonthlyPoint[];
}
