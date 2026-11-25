export interface RealEstateFilterState {
  tipo: string;
  anomes: string;
  contrato: string;
  uf: string;
  ufMode: 'consolidated' | 'registered';
  centroCusto: string;
  estacao: string;
  fornecedor: string;
  pais: string;
  tipoOperacao: string;
  tipoRe: string;
  classificacao: string;
  search: string;
}

export interface RealEstateFilterOptionItem {
  value: string;
  label: string;
  rows: number;
  netTotal?: number;
  uf?: string | null;
}

export interface RealEstateFilterOptions {
  tipos: string[];
  months: string[];
  contracts: RealEstateFilterOptionItem[];
  ufs: Array<{ value: string; rows: number; netTotal: number }>;
  costCenters: RealEstateFilterOptionItem[];
  stations: RealEstateFilterOptionItem[];
  suppliers: RealEstateFilterOptionItem[];
  countries: Array<{ value: string; rows: number; netTotal: number }>;
  operationTypes: Array<{ value: string; label: string; rows: number }>;
  tipoReOptions: Array<{ value: string; label: string; rows: number }>;
  classifications: RealEstateFilterOptionItem[];
}

export interface RealEstateSummary {
  totalRows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
  distinctContracts: number;
  distinctStations: number;
  distinctUfs: number;
  distinctCountries: number;
  distinctCostCenters: number;
  distinctSuppliers: number;
  rowsWithContract: number;
  rowsWithStation: number;
  rowsWithRegisteredUf: number;
  valueWithContract: number;
}

export interface RealEstateMonthlyPoint {
  anomes: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateUfRow {
  uf: string;
  rows: number;
  stations: number;
  contracts: number;
  registeredRows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateCountryRow {
  pais: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateCostCenterRow {
  cc: string;
  ccDesc: string;
  rows: number;
  stations: number;
  contracts: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateClassificationRow {
  classificacao: string;
  tipoRe: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateAccountRow {
  conta: string;
  contaDesc: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateSupplierRow {
  fornecedor: string;
  rows: number;
  contracts: number;
  stations: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateContractRow {
  contrato: string;
  tipoContrato: string;
  gestor: string;
  fornecedorPrincipal: string;
  tipoRe: string;
  stations: number;
  ufs: number;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstateStationRow {
  estacao: string;
  uf: string;
  ufCadastro: string | null;
  cidade: string;
  tipoContrato: string;
  tipoOperacao: string;
  statusFin: string;
  gestor: string;
  locador?: string;
  contratoPrincipal: string | null;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface RealEstatePlOpeningRow {
  leafKey: string;
  label: string;
  group: string;
  bgt26: number;
  act26: number;
  fct84: number;
  fct48: number;
  rows: number;
}

export interface RealEstateBuildingSaleRow {
  imovel: string;
  contrato: string;
  anomes: string;
  texto: string;
  fornecedor: string;
  actTotal: number;
  bgtTotal: number;
  fct84Total: number;
  fct48Total: number;
  rows: number;
}

export interface RealEstateDashboardData {
  summary: RealEstateSummary;
  monthly: RealEstateMonthlyPoint[];
  plOpenings: RealEstatePlOpeningRow[];
  buildingSales: RealEstateBuildingSaleRow[];
  byUf: RealEstateUfRow[];
  byCountry: RealEstateCountryRow[];
  byCostCenter: RealEstateCostCenterRow[];
  byClassification: RealEstateClassificationRow[];
  byAccount: RealEstateAccountRow[];
  bySupplier: RealEstateSupplierRow[];
  byContract: RealEstateContractRow[];
  byStation: RealEstateStationRow[];
}

export interface RealEstateUfDrilldownData {
  uf: string;
  summary: {
    totalRows: number;
    netTotal: number;
    grossCost: number;
    grossCredit: number;
    distinctStations: number;
    distinctContracts: number;
    distinctCostCenters: number;
    registeredRows: number;
  };
  monthly: RealEstateMonthlyPoint[];
  stations: RealEstateStationRow[];
  contracts: Array<{
    contrato: string;
    tipoContrato: string;
    fornecedorPrincipal: string;
    stations: number;
    rows: number;
    netTotal: number;
  }>;
  costCenters: Array<{
    cc: string;
    ccDesc: string;
    rows: number;
    netTotal: number;
  }>;
}

export interface RealEstateLedgerRow {
  anomes: string;
  dataLancamento: string;
  documento: string;
  empresa: string;
  pais: string;
  cc: string;
  ccDesc: string;
  conta: string;
  contaDesc: string;
  classificacao: string;
  tipoRe: string;
  fornecedor: string;
  contrato: string;
  estacao: string;
  uf: string;
  ufCadastro: string | null;
  cidade: string;
  tipoContrato: string;
  tipoOperacao: string;
  gestor: string;
  texto: string;
  valor: number;
}

export interface RealEstateLedgerResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: RealEstateLedgerRow[];
}

// ====================================================
// VISÃO EXCEL (ANÁLISE + BASE P&L)
// ====================================================

export interface RealEstateAnaliseRow {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  bgt26: number;
  actFct26: number;
  delta: number;
}

export interface RealEstateAnaliseChartSummary {
  bgtActPeriod: number;
  bgtFctPeriod: number;
  bgtTotal: number;
  realActPeriod: number;
  realFctPeriod: number;
  realTotal: number;
  pctVsBgt: number;
}

export interface RealEstatePlRow {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  isComodato?: boolean;
  isVendaPredio?: boolean;
  isTechnicalStation?: boolean;
  bgt: number[];
  bgtFy: number;
  fct: number[];
  fctFy: number;
  actFct: number[];
  actFctFy: number;
  act25: number[];
  act25Fy: number;
  ytd: {
    act26VsAct25: number;
    act26VsBgt26: number;
    act26VsFct26: number;
  };
  fy: {
    act26VsAct25: number;
    act26VsBgt26: number;
    act26VsFct26: number;
  };
}

export interface RealEstateExcelModelData {
  actCutoffMonth: number;
  includeOverheadCc: boolean;
  months: string[];
  analise: {
    visaoPl: RealEstateAnaliseRow[];
    visaoGerencial: RealEstateAnaliseRow[];
    chartSummaryPl: RealEstateAnaliseChartSummary;
    chartSummaryGerencial: RealEstateAnaliseChartSummary;
  };
  basePl: RealEstatePlRow[];
}
