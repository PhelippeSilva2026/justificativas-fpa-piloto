export interface LegalFilterState {
  classificacao: string;
  diretoria: string;
  gerencia: string;
  descricao: string;
  pais: string;
  centroCusto: string;
  fornecedor: string;
  contaRazao: string;
  pedidoCompra: string;
  atribuicao: string;
  anomes: string;
  search: string;
  ledgerTipo: string;
}

export interface LegalFilterOptionItem {
  value: string;
  label: string;
  rows: number;
  actTotal?: number;
}

export interface LegalFilterOptions {
  classifications: LegalFilterOptionItem[];
  diretorias: LegalFilterOptionItem[];
  gerencias: LegalFilterOptionItem[];
  descricoes: LegalFilterOptionItem[];
  paises: LegalFilterOptionItem[];
  costCenters: LegalFilterOptionItem[];
  suppliers: LegalFilterOptionItem[];
  accounts: LegalFilterOptionItem[];
  purchaseOrders: LegalFilterOptionItem[];
  months: string[];
}

export interface LegalScenarioMetrics {
  bgtMonth: number;
  actMonth: number;
  disponivelMonth: number;
  fct84Month: number;
  bgtFy: number;
  bgtYtd: number;
  actTotal: number;
  disponivelFy: number;
  disponivelYtd: number;
  fct84Total: number;
  fct84Ytd: number;
  fct48Total: number;
}

export interface LegalSummary extends LegalScenarioMetrics {
  totalRows: number;
  actRows: number;
  distinctCcs: number;
  distinctDiretorias: number;
  distinctGerencias: number;
  distinctDescricoes: number;
  distinctPaises: number;
  distinctSuppliers: number;
  distinctPos: number;
  distinctContracts: number;
  actRowsWithPo: number;
  actRowsWithAtrib: number;
}

export interface LegalMonthlyPoint {
  anomes: string;
  rows: number;
  bgt: number;
  act: number;
  disponivel: number;
  fct84: number;
  fct48: number;
}

export interface LegalMatrixChildRow extends LegalScenarioMetrics {
  key: string;
  label: string;
  sublabel?: string;
  filterKey?: keyof LegalFilterState;
  filterValue?: string;
  ccsCount: number;
  actRows: number;
}

export interface LegalDiretoriaRow extends LegalScenarioMetrics {
  diretoria: string;
  ccsCount: number;
  actRows: number;
  children: LegalMatrixChildRow[];
}

export interface LegalGerenciaRow extends LegalScenarioMetrics {
  gerencia: string;
  diretoria: string;
  ccsCount: number;
  actRows: number;
  children: LegalMatrixChildRow[];
}

export interface LegalDescricaoRow extends LegalScenarioMetrics {
  descricao: string;
  diretoria: string;
  gerencia: string;
  ccsCount: number;
  actRows: number;
  children: LegalMatrixChildRow[];
}

export interface LegalJustificationImpact {
  id: string;
  name: string;
  value: number;
  justification: string;
}

export interface LegalClassificationJustifications {
  period: string;
  isFallbackPeriod?: boolean;
  updatedAt?: string;
  updatedBy?: string;
  vsOrcadoImpacts: LegalJustificationImpact[];
  momImpacts: LegalJustificationImpact[];
  ytdImpacts: LegalJustificationImpact[];
}

export interface LegalClassificationRow extends LegalScenarioMetrics {
  classificacao: string;
  actRows: number;
  children: LegalMatrixChildRow[];
  justifications?: LegalClassificationJustifications | null;
}

export interface LegalSupplierRow {
  fornecedor: string;
  actRows: number;
  posCount: number;
  contractsCount: number;
  accountsCount: number;
  mainGerencia: string;
  actTotal: number;
  fct84Total: number;
  fct48Total: number;
}

export interface LegalPurchaseOrderRow {
  poOrContract: string;
  docKind: string;
  fornecedor: string;
  ccDesc: string;
  gerencia: string;
  atribuicao: string;
  texto: string;
  rows: number;
  actTotal: number;
  fct84Total: number;
}

export interface LegalTextAtribRow {
  atribuicao: string;
  texto: string;
  contaDesc: string;
  fornecedor: string;
  ccDesc: string;
  rows: number;
  actTotal: number;
}

export interface LegalDashboardData {
  maxActMonth: number;
  refMonth: number;
  justificationsPeriod?: string;
  summary: LegalSummary;
  byDiretoria: LegalDiretoriaRow[];
  byGerencia: LegalGerenciaRow[];
  byDescricao: LegalDescricaoRow[];
  byClassification: LegalClassificationRow[];
  bySupplier: LegalSupplierRow[];
  byPurchaseOrder: LegalPurchaseOrderRow[];
  byTextAtribuicao: LegalTextAtribRow[];
}

export interface LegalLedgerRow {
  tipo: string;
  anomes: string;
  dataLancamento: string;
  documento: string;
  cc: string;
  ccDesc: string;
  diretoria: string;
  gerencia: string;
  pais: string;
  statusCc: string;
  classificacao: string;
  contaRazao: string;
  contaDesc: string;
  fornecedor: string;
  pedidoCompra: string;
  pedidoItem: string;
  contratoRe: string;
  atribuicao: string;
  texto: string;
  valor: number;
}

export interface LegalLedgerResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: LegalLedgerRow[];
}
