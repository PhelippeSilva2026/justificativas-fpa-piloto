export interface EnergyFilterState {
  anomes: string;
  contrato: string;
  uf: string;
  ufMode: 'consolidated' | 'registered';
  centroCusto: string;
  estacao: string;
  fornecedor: string;
  empresa: string;
  tipoContrato: string;
  search: string;
}

export interface EnergyFilterOptionItem {
  value: string;
  label: string;
  rows: number;
  netTotal?: number;
  uf?: string | null;
}

export interface EnergyFilterOptions {
  months: string[];
  contracts: EnergyFilterOptionItem[];
  ufs: Array<{ value: string; rows: number; netTotal: number }>;
  costCenters: EnergyFilterOptionItem[];
  stations: EnergyFilterOptionItem[];
  suppliers: EnergyFilterOptionItem[];
  companies: string[];
  contractTypes: Array<{ value: string; label: string; rows: number }>;
}

export interface EnergySummary {
  totalRows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
  distinctContracts: number;
  distinctStations: number;
  distinctUfs: number;
  distinctCostCenters: number;
  distinctSuppliers: number;
  rowsWithContract: number;
  rowsWithStation: number;
  rowsWithRegisteredUf: number;
  valueWithContract: number;
}

export interface EnergyMonthlyPoint {
  anomes: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyUfRow {
  uf: string;
  rows: number;
  stations: number;
  contracts: number;
  registeredRows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyCostCenterRow {
  cc: string;
  ccDesc: string;
  rows: number;
  stations: number;
  contracts: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyAccountRow {
  conta: string;
  contaDesc: string;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergySupplierRow {
  fornecedor: string;
  rows: number;
  contracts: number;
  stations: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyContractRow {
  contrato: string;
  tipoContrato: string;
  gestor: string;
  fornecedorPrincipal: string;
  stations: number;
  ufs: number;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyStationRow {
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
  cc?: string | null;
  rows: number;
  netTotal: number;
  grossCost: number;
  grossCredit: number;
}

export interface EnergyDashboardData {
  summary: EnergySummary;
  monthly: EnergyMonthlyPoint[];
  byUf: EnergyUfRow[];
  byCostCenter: EnergyCostCenterRow[];
  byAccount: EnergyAccountRow[];
  bySupplier: EnergySupplierRow[];
  byContract: EnergyContractRow[];
  byStation: EnergyStationRow[];
}

export interface EnergyUfDrilldownData {
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
  monthly: EnergyMonthlyPoint[];
  stations: EnergyStationRow[];
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

export interface EnergyLedgerRow {
  anomes: string;
  dataLancamento: string;
  documento: string;
  empresa: string;
  cc: string;
  ccDesc: string;
  conta: string;
  contaDesc: string;
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

export interface EnergyLedgerResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: EnergyLedgerRow[];
}
