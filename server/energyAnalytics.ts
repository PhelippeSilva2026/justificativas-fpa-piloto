import { BigQuery } from '@google-cloud/bigquery';
import { buildFastXlsxBuffer, queryBigQueryFast } from './excelExport';

const DRE_FINAL_TABLE = '`vtal-fpea-prd.419556.DRE_FINAL`';

const VALID_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const UF_CONSOLIDATED_EXPR = `
  CASE
    WHEN NULLIF(TRIM(ESTACAO_UF), '') IS NOT NULL THEN UPPER(TRIM(ESTACAO_UF))
    WHEN REGEXP_CONTAINS(UPPER(TRIM(SIGLA_ESTACAO)), r'^(${VALID_UFS.join('|')})-')
      THEN UPPER(SUBSTR(TRIM(SIGLA_ESTACAO), 1, 2))
    ELSE 'Sem UF'
  END
`;

const UF_REGISTERED_EXPR = `COALESCE(NULLIF(UPPER(TRIM(ESTACAO_UF)), ''), 'Sem UF')`;

export interface EnergyFilterParams {
  anomes?: string;
  contrato?: string;
  uf?: string;
  ufMode?: 'consolidated' | 'registered';
  centroCusto?: string;
  estacao?: string;
  fornecedor?: string;
  empresa?: string;
  tipoContrato?: string;
  search?: string;
}

export function fixMojibake(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (!/[ÃÂ]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch {}
  return text;
}

function numVal(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intVal(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function unwrapDate(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return String((v as { value: unknown }).value || '');
  }
  return String(v);
}

function buildEnergyWhereClause(filters: EnergyFilterParams): {
  whereSql: string;
  params: Record<string, unknown>;
  ufExpr: string;
} {
  const ufExpr = filters.ufMode === 'registered' ? UF_REGISTERED_EXPR : UF_CONSOLIDATED_EXPR;
  const conditions: string[] = [
    "UPPER(TRIM(AREA)) = 'ENERGIA'",
    "UPPER(TRIM(TIPO)) = 'ACTUAL 2026'",
  ];
  const params: Record<string, unknown> = {};

  if (filters.anomes && filters.anomes !== 'ALL') {
    conditions.push('TRIM(anomes) = @anomes');
    params.anomes = filters.anomes.trim();
  }

  if (filters.contrato && filters.contrato !== 'ALL') {
    if (filters.contrato === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(CONTRATO_RE), '') IS NULL");
    } else {
      conditions.push('TRIM(CONTRATO_RE) = @contrato');
      params.contrato = filters.contrato.trim();
    }
  }

  if (filters.uf && filters.uf !== 'ALL') {
    conditions.push(`(${ufExpr}) = @uf`);
    params.uf = filters.uf.trim().toUpperCase() === 'SEM UF' ? 'Sem UF' : filters.uf.trim().toUpperCase();
  }

  if (filters.centroCusto && filters.centroCusto !== 'ALL') {
    if (filters.centroCusto === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(centro_custo), '') IS NULL");
    } else {
      conditions.push('TRIM(centro_custo) = @centroCusto');
      params.centroCusto = filters.centroCusto.trim();
    }
  }

  if (filters.estacao && filters.estacao !== 'ALL') {
    if (filters.estacao === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(SIGLA_ESTACAO), '') IS NULL");
    } else {
      conditions.push('UPPER(TRIM(SIGLA_ESTACAO)) = @estacao');
      params.estacao = filters.estacao.trim().toUpperCase();
    }
  }

  if (filters.fornecedor && filters.fornecedor !== 'ALL') {
    if (filters.fornecedor === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(nome_fornecedor), '') IS NULL");
    } else {
      conditions.push('TRIM(nome_fornecedor) = @fornecedor');
      params.fornecedor = filters.fornecedor.trim();
    }
  }

  if (filters.empresa && filters.empresa !== 'ALL') {
    conditions.push('TRIM(NIVEL_2) = @empresa');
    params.empresa = filters.empresa.trim();
  }

  if (filters.tipoContrato && filters.tipoContrato !== 'ALL') {
    if (filters.tipoContrato === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '') IS NULL");
    } else {
      conditions.push('TRIM(ESTACAO_TIPO_CONTRATO) = @tipoContrato');
      params.tipoContrato = filters.tipoContrato.trim();
    }
  }

  if (filters.search && filters.search.trim()) {
    conditions.push(`(
      LOWER(COALESCE(CONTRATO_RE, '')) LIKE @searchLike
      OR LOWER(COALESCE(SIGLA_ESTACAO, '')) LIKE @searchLike
      OR LOWER(COALESCE(centro_custo, '')) LIKE @searchLike
      OR LOWER(COALESCE(DENOMINACAO_CENTRO_DE_CUSTO, '')) LIKE @searchLike
      OR LOWER(COALESCE(nome_fornecedor, '')) LIKE @searchLike
      OR LOWER(COALESCE(ESTACAO_CIDADE, '')) LIKE @searchLike
      OR LOWER(COALESCE(n_documento, '')) LIKE @searchLike
      OR LOWER(COALESCE(texto, '')) LIKE @searchLike
    )`);
    params.searchLike = `%${filters.search.trim().toLowerCase()}%`;
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
    ufExpr,
  };
}

async function runBqQuery(
  bigquery: BigQuery,
  query: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>[]> {
  const options: { query: string; params?: Record<string, unknown>; location?: string } = {
    query,
    location: 'southamerica-east1',
  };
  if (Object.keys(params).length > 0) {
    options.params = params;
  }
  try {
    const [rows] = await bigquery.query(options);
    return rows as Record<string, unknown>[];
  } catch {
    delete options.location;
    const [rows] = await bigquery.query(options);
    return rows as Record<string, unknown>[];
  }
}

// Cache em memória simples (TTL 5 min para dashboard e 10 min para filtros)
let filtersCache: { expiresAt: number; data: unknown } | null = null;
const dashboardCache = new Map<string, { expiresAt: number; data: unknown }>();
const DASHBOARD_CACHE_MAX = 30;

export async function getEnergyFilterOptions(bigquery: BigQuery) {
  const now = Date.now();
  if (filtersCache && filtersCache.expiresAt > now) {
    return filtersCache.data;
  }

  const baseWhere = "UPPER(TRIM(AREA)) = 'ENERGIA' AND UPPER(TRIM(TIPO)) = 'ACTUAL 2026'";

  const [monthsRows, contractsRows, ufsRows, ccRows, stationsRows, suppliersRows, companiesRows, contractTypesRows] =
    await Promise.all([
      runBqQuery(
        bigquery,
        `SELECT TRIM(anomes) AS value, COUNT(*) AS rows_count
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere} AND NULLIF(TRIM(anomes), '') IS NOT NULL
         GROUP BY 1
         ORDER BY CAST(SPLIT(value, '/')[OFFSET(0)] AS INT64), CAST(SPLIT(value, '/')[OFFSET(1)] AS INT64)`
      ),
      runBqQuery(
        bigquery,
        `SELECT COALESCE(NULLIF(TRIM(CONTRATO_RE), ''), '__EMPTY__') AS value,
                COALESCE(NULLIF(TRIM(CONTRATO_RE), ''), 'Sem Contrato') AS label,
                COUNT(*) AS rows_count,
                SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1, 2
         ORDER BY ABS(SUM(valor)) DESC`
      ),
      runBqQuery(
        bigquery,
        `SELECT (${UF_CONSOLIDATED_EXPR}) AS value,
                COUNT(*) AS rows_count,
                SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1
         ORDER BY CASE WHEN value = 'Sem UF' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC`
      ),
      runBqQuery(
        bigquery,
        `SELECT COALESCE(NULLIF(TRIM(centro_custo), ''), '__EMPTY__') AS value,
                COALESCE(NULLIF(TRIM(centro_custo), ''), 'Sem Centro de Custo') AS code,
                ANY_VALUE(NULLIF(TRIM(DENOMINACAO_CENTRO_DE_CUSTO), '')) AS desc_cc,
                COUNT(*) AS rows_count,
                SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1, 2
         ORDER BY ABS(SUM(valor)) DESC`
      ),
      runBqQuery(
        bigquery,
        `SELECT COALESCE(NULLIF(UPPER(TRIM(SIGLA_ESTACAO)), ''), '__EMPTY__') AS value,
                COALESCE(NULLIF(UPPER(TRIM(SIGLA_ESTACAO)), ''), 'Sem Estação') AS label,
                ANY_VALUE(NULLIF(TRIM(ESTACAO_UF), '')) AS uf,
                COUNT(*) AS rows_count,
                SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1, 2
         ORDER BY CASE WHEN value = '__EMPTY__' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC
         LIMIT 350`
      ),
      runBqQuery(
        bigquery,
        `SELECT COALESCE(NULLIF(TRIM(nome_fornecedor), ''), '__EMPTY__') AS value,
                COALESCE(NULLIF(TRIM(nome_fornecedor), ''), 'Sem Fornecedor') AS label,
                COUNT(*) AS rows_count,
                SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1, 2
         ORDER BY ABS(SUM(valor)) DESC`
      ),
      runBqQuery(
        bigquery,
        `SELECT TRIM(NIVEL_2) AS value, COUNT(*) AS rows_count, SUM(valor) AS net_total
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere} AND NULLIF(TRIM(NIVEL_2), '') IS NOT NULL
         GROUP BY 1
         ORDER BY ABS(SUM(valor)) DESC`
      ),
      runBqQuery(
        bigquery,
        `SELECT COALESCE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), ''), '__EMPTY__') AS value,
                COALESCE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), ''), 'Não Classificado') AS label,
                COUNT(*) AS rows_count
         FROM ${DRE_FINAL_TABLE}
         WHERE ${baseWhere}
         GROUP BY 1, 2
         ORDER BY rows_count DESC`
      ),
    ]);

  const data = {
    months: monthsRows.map((r) => String(r.value)),
    contracts: contractsRows.map((r) => ({
      value: String(r.value),
      label: String(r.label),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    ufs: ufsRows.map((r) => ({
      value: String(r.value),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    costCenters: ccRows.map((r) => {
      const code = String(r.code);
      const desc = fixMojibake(r.desc_cc);
      return {
        value: String(r.value),
        label: desc && code !== 'Sem Centro de Custo' ? `${code} · ${desc}` : code,
        rows: intVal(r.rows_count),
        netTotal: numVal(r.net_total),
      };
    }),
    stations: stationsRows.map((r) => ({
      value: String(r.value),
      label: String(r.label),
      uf: r.uf ? String(r.uf) : null,
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    suppliers: suppliersRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    companies: companiesRows.map((r) => String(r.value)),
    contractTypes: contractTypesRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
    })),
  };

  filtersCache = { expiresAt: now + 10 * 60 * 1000, data };
  return data;
}

export async function getEnergyDashboardData(bigquery: BigQuery, filters: EnergyFilterParams) {
  const cacheKey = JSON.stringify(filters);
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { whereSql, params, ufExpr } = buildEnergyWhereClause(filters);

  const [
    summaryRows,
    monthlyRows,
    ufRows,
    ccRows,
    accountRows,
    supplierRows,
    contractRows,
    stationRows,
  ] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT
         COUNT(*) AS total_rows,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS distinct_contracts,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS distinct_stations,
         COUNT(DISTINCT CASE WHEN (${ufExpr}) != 'Sem UF' THEN (${ufExpr}) END) AS distinct_ufs,
         COUNT(DISTINCT NULLIF(TRIM(centro_custo), '')) AS distinct_ccs,
         COUNT(DISTINCT NULLIF(TRIM(nome_fornecedor), '')) AS distinct_suppliers,
         COUNTIF(NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL) AS rows_with_contract,
         COUNTIF(NULLIF(TRIM(SIGLA_ESTACAO), '') IS NOT NULL) AS rows_with_station,
         COUNTIF(NULLIF(TRIM(ESTACAO_UF), '') IS NOT NULL) AS rows_with_registered_uf,
         COALESCE(SUM(CASE WHEN NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL THEN valor ELSE 0 END), 0) AS value_with_contract
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(anomes) AS anomes,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1
       ORDER BY CAST(SPLIT(anomes, '/')[OFFSET(0)] AS INT64), CAST(SPLIT(anomes, '/')[OFFSET(1)] AS INT64)`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         (${ufExpr}) AS uf,
         COUNT(*) AS rows_count,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS contracts,
         COUNTIF(NULLIF(TRIM(ESTACAO_UF), '') IS NOT NULL) AS registered_rows,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY CASE WHEN uf = 'Sem UF' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(centro_custo), ''), 'Sem Centro de Custo') AS cc,
         ANY_VALUE(NULLIF(TRIM(DENOMINACAO_CENTRO_DE_CUSTO), '')) AS cc_desc,
         COUNT(*) AS rows_count,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS contracts,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(conta_do_razao), ''), 'Sem Conta') AS conta,
         ANY_VALUE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), '')) AS conta_desc,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(nome_fornecedor), ''), 'Sem Fornecedor') AS fornecedor,
         COUNT(*) AS rows_count,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS contracts,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 30`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(CONTRATO_RE), ''), 'Sem Contrato') AS contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_GESTOR_CTTO), '')) AS gestor,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor_principal,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(DISTINCT CASE WHEN (${ufExpr}) != 'Sem UF' THEN (${ufExpr}) END) AS ufs,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY CASE WHEN contrato = 'Sem Contrato' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC
       LIMIT 60`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(UPPER(TRIM(SIGLA_ESTACAO)), ''), 'Sem Estação') AS estacao,
         ANY_VALUE(${ufExpr}) AS uf,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_UF), '')) AS uf_cadastro,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_CIDADE), '')) AS cidade,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), '')) AS tipo_operacao,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_STATUS_FINANC), '')) AS status_fin,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_GESTOR_CTTO), '')) AS gestor,
         ANY_VALUE(NULLIF(TRIM(CONTRATO_RE), '')) AS contrato_principal,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY CASE WHEN estacao = 'Sem Estação' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC
       LIMIT 100`,
      params
    ),
  ]);

  const s = summaryRows[0] || {};
  const data = {
    summary: {
      totalRows: intVal(s.total_rows),
      netTotal: numVal(s.net_total),
      grossCost: numVal(s.gross_cost),
      grossCredit: numVal(s.gross_credit),
      distinctContracts: intVal(s.distinct_contracts),
      distinctStations: intVal(s.distinct_stations),
      distinctUfs: intVal(s.distinct_ufs),
      distinctCostCenters: intVal(s.distinct_ccs),
      distinctSuppliers: intVal(s.distinct_suppliers),
      rowsWithContract: intVal(s.rows_with_contract),
      rowsWithStation: intVal(s.rows_with_station),
      rowsWithRegisteredUf: intVal(s.rows_with_registered_uf),
      valueWithContract: numVal(s.value_with_contract),
    },
    monthly: monthlyRows.map((r) => ({
      anomes: String(r.anomes),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byUf: ufRows.map((r) => ({
      uf: String(r.uf),
      rows: intVal(r.rows_count),
      stations: intVal(r.stations),
      contracts: intVal(r.contracts),
      registeredRows: intVal(r.registered_rows),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byCostCenter: ccRows.map((r) => ({
      cc: String(r.cc),
      ccDesc: fixMojibake(r.cc_desc) || (String(r.cc) === 'Sem Centro de Custo' ? 'Sem classificação de CC' : ''),
      rows: intVal(r.rows_count),
      stations: intVal(r.stations),
      contracts: intVal(r.contracts),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byAccount: accountRows.map((r) => ({
      conta: String(r.conta),
      contaDesc: fixMojibake(r.conta_desc),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    bySupplier: supplierRows.map((r) => ({
      fornecedor: fixMojibake(r.fornecedor),
      rows: intVal(r.rows_count),
      contracts: intVal(r.contracts),
      stations: intVal(r.stations),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byContract: contractRows.map((r) => ({
      contrato: String(r.contrato),
      tipoContrato: fixMojibake(r.tipo_contrato),
      gestor: fixMojibake(r.gestor),
      fornecedorPrincipal: fixMojibake(r.fornecedor_principal),
      stations: intVal(r.stations),
      ufs: intVal(r.ufs),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byStation: stationRows.map((r) => ({
      estacao: String(r.estacao),
      uf: String(r.uf || 'Sem UF'),
      ufCadastro: r.uf_cadastro ? String(r.uf_cadastro) : null,
      cidade: fixMojibake(r.cidade),
      tipoContrato: fixMojibake(r.tipo_contrato),
      tipoOperacao: fixMojibake(r.tipo_operacao),
      statusFin: fixMojibake(r.status_fin),
      gestor: fixMojibake(r.gestor),
      contratoPrincipal: r.contrato_principal ? String(r.contrato_principal) : null,
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
  };

  if (dashboardCache.size >= DASHBOARD_CACHE_MAX) {
    const oldestKey = dashboardCache.keys().next().value;
    if (oldestKey) dashboardCache.delete(oldestKey);
  }
  dashboardCache.set(cacheKey, { expiresAt: now + 5 * 60 * 1000, data });

  return data;
}

export async function getEnergyUfDrilldown(
  bigquery: BigQuery,
  ufTarget: string,
  filters: EnergyFilterParams
) {
  const { whereSql, params, ufExpr } = buildEnergyWhereClause({
    ...filters,
    uf: ufTarget,
  });

  const [summaryRows, monthlyRows, stationRows, contractRows, ccRows] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT
         COUNT(*) AS total_rows,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS distinct_stations,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS distinct_contracts,
         COUNT(DISTINCT NULLIF(TRIM(centro_custo), '')) AS distinct_ccs,
         COUNTIF(NULLIF(TRIM(ESTACAO_UF), '') IS NOT NULL) AS registered_rows
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(anomes) AS anomes,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1
       ORDER BY CAST(SPLIT(anomes, '/')[OFFSET(0)] AS INT64), CAST(SPLIT(anomes, '/')[OFFSET(1)] AS INT64)`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(UPPER(TRIM(SIGLA_ESTACAO)), ''), 'Sem Estação') AS estacao,
         ANY_VALUE(${ufExpr}) AS uf,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_UF), '')) AS uf_cadastro,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_CIDADE), '')) AS cidade,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), '')) AS tipo_operacao,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_STATUS_FINANC), '')) AS status_fin,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_GESTOR_CTTO), '')) AS gestor,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_LOCADOR_RESPONSAVEL), '')) AS locador,
         ANY_VALUE(NULLIF(TRIM(CONTRATO_RE), '')) AS contrato_principal,
         ANY_VALUE(NULLIF(TRIM(centro_custo), '')) AS cc,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY CASE WHEN estacao = 'Sem Estação' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC
       LIMIT 150`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(CONTRATO_RE), ''), 'Sem Contrato') AS contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor_principal,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY CASE WHEN contrato = 'Sem Contrato' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC
       LIMIT 40`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(centro_custo), ''), 'Sem Centro de Custo') AS cc,
         ANY_VALUE(NULLIF(TRIM(DENOMINACAO_CENTRO_DE_CUSTO), '')) AS cc_desc,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
  ]);

  const s = summaryRows[0] || {};
  return {
    uf: ufTarget,
    summary: {
      totalRows: intVal(s.total_rows),
      netTotal: numVal(s.net_total),
      grossCost: numVal(s.gross_cost),
      grossCredit: numVal(s.gross_credit),
      distinctStations: intVal(s.distinct_stations),
      distinctContracts: intVal(s.distinct_contracts),
      distinctCostCenters: intVal(s.distinct_ccs),
      registeredRows: intVal(s.registered_rows),
    },
    monthly: monthlyRows.map((r) => ({
      anomes: String(r.anomes),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    stations: stationRows.map((r) => ({
      estacao: String(r.estacao),
      uf: String(r.uf || ufTarget),
      ufCadastro: r.uf_cadastro ? String(r.uf_cadastro) : null,
      cidade: fixMojibake(r.cidade),
      tipoContrato: fixMojibake(r.tipo_contrato),
      tipoOperacao: fixMojibake(r.tipo_operacao),
      statusFin: fixMojibake(r.status_fin),
      gestor: fixMojibake(r.gestor),
      locador: fixMojibake(r.locador),
      contratoPrincipal: r.contrato_principal ? String(r.contrato_principal) : null,
      cc: r.cc ? String(r.cc) : null,
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    contracts: contractRows.map((r) => ({
      contrato: String(r.contrato),
      tipoContrato: fixMojibake(r.tipo_contrato),
      fornecedorPrincipal: fixMojibake(r.fornecedor_principal),
      stations: intVal(r.stations),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    costCenters: ccRows.map((r) => ({
      cc: String(r.cc),
      ccDesc: fixMojibake(r.cc_desc),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
  };
}

export async function getEnergyLedgerPage(
  bigquery: BigQuery,
  filters: EnergyFilterParams,
  options: { page?: number; pageSize?: number; sortBy?: string }
) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize || 50));
  const offset = (page - 1) * pageSize;

  let orderBySql = 'ABS(valor) DESC, anomes DESC';
  if (options.sortBy === 'valor_asc') orderBySql = 'valor ASC, anomes DESC';
  else if (options.sortBy === 'valor_desc') orderBySql = 'valor DESC, anomes DESC';
  else if (options.sortBy === 'data_desc') orderBySql = 'data_de_lancamento DESC, ABS(valor) DESC';
  else if (options.sortBy === 'anomes') {
    orderBySql = "CAST(SPLIT(anomes, '/')[OFFSET(0)] AS INT64) DESC, CAST(SPLIT(anomes, '/')[OFFSET(1)] AS INT64) DESC, ABS(valor) DESC";
  }

  const { whereSql, params, ufExpr } = buildEnergyWhereClause(filters);

  const [countRows, rows] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT COUNT(*) AS total_count FROM ${DRE_FINAL_TABLE} WHERE ${whereSql}`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(anomes) AS anomes,
         data_de_lancamento,
         n_documento,
         NIVEL_2,
         centro_custo,
         DENOMINACAO_CENTRO_DE_CUSTO,
         conta_do_razao,
         CONTA_CONTABIL_DESCRICAO,
         nome_fornecedor,
         CONTRATO_RE,
         SIGLA_ESTACAO,
         (${ufExpr}) AS uf_efetiva,
         ESTACAO_UF,
         ESTACAO_CIDADE,
         ESTACAO_TIPO_CONTRATO,
         ESTACAO_TIPO_OPERACAO,
         ESTACAO_GESTOR_CTTO,
         texto,
         valor
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       ORDER BY ${orderBySql}
       LIMIT @limit OFFSET @offset`,
      { ...params, limit: pageSize, offset }
    ),
  ]);

  const totalCount = intVal(countRows[0]?.total_count);

  return {
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    rows: rows.map((r) => ({
      anomes: String(r.anomes || ''),
      dataLancamento: unwrapDate(r.data_de_lancamento),
      documento: fixMojibake(r.n_documento),
      empresa: fixMojibake(r.NIVEL_2),
      cc: fixMojibake(r.centro_custo),
      ccDesc: fixMojibake(r.DENOMINACAO_CENTRO_DE_CUSTO),
      conta: fixMojibake(r.conta_do_razao),
      contaDesc: fixMojibake(r.CONTA_CONTABIL_DESCRICAO),
      fornecedor: fixMojibake(r.nome_fornecedor),
      contrato: fixMojibake(r.CONTRATO_RE),
      estacao: fixMojibake(r.SIGLA_ESTACAO),
      uf: String(r.uf_efetiva || 'Sem UF'),
      ufCadastro: r.ESTACAO_UF ? String(r.ESTACAO_UF) : null,
      cidade: fixMojibake(r.ESTACAO_CIDADE),
      tipoContrato: fixMojibake(r.ESTACAO_TIPO_CONTRATO),
      tipoOperacao: fixMojibake(r.ESTACAO_TIPO_OPERACAO),
      gestor: fixMojibake(r.ESTACAO_GESTOR_CTTO),
      texto: fixMojibake(r.texto),
      valor: numVal(r.valor),
    })),
  };
}

export async function exportEnergyExcelBuffer(
  bigquery: BigQuery,
  filters: EnergyFilterParams
): Promise<{ buffer: Buffer; rowCount: number }> {
  const { whereSql, params, ufExpr } = buildEnergyWhereClause(filters);

  const sql = `
    SELECT
      TRIM(anomes) AS ANOMES,
      TIPO,
      NIVEL_2 AS EMPRESA,
      AREA,
      centro_custo AS CENTRO_CUSTO,
      DENOMINACAO_CENTRO_DE_CUSTO AS DESC_CENTRO_CUSTO,
      conta_do_razao AS CONTA_RAZAO,
      CONTA_CONTABIL_DESCRICAO AS DESC_CONTA,
      CONTRATO_RE,
      SIGLA_ESTACAO,
      (${ufExpr}) AS UF_CONSOLIDADA,
      ESTACAO_UF AS UF_CADASTRO_RE,
      ESTACAO_CIDADE AS CIDADE,
      ESTACAO_TIPO_CONTRATO AS TIPO_CONTRATO,
      ESTACAO_TIPO_OPERACAO AS TIPO_OPERACAO,
      ESTACAO_STATUS_FINANC AS STATUS_FINANCEIRO,
      ESTACAO_GESTOR_CTTO AS GESTOR_CONTRATO,
      ESTACAO_LOCADOR_RESPONSAVEL AS LOCADOR_RESPONSAVEL,
      nome_fornecedor AS FORNECEDOR,
      n_documento AS N_DOCUMENTO,
      data_de_lancamento AS DATA_LANCAMENTO,
      texto AS TEXTO,
      valor AS VALOR
    FROM ${DRE_FINAL_TABLE}
    WHERE ${whereSql}
    ORDER BY ANOMES, ABS(VALOR) DESC
  `;

  const rawRows = await queryBigQueryFast(bigquery, sql, params);
  const cleanedRows = rawRows.map((row) => ({
    ...row,
    DESC_CENTRO_CUSTO: fixMojibake(row.DESC_CENTRO_CUSTO),
    DESC_CONTA: fixMojibake(row.DESC_CONTA),
    CIDADE: fixMojibake(row.CIDADE),
    LOCADOR_RESPONSAVEL: fixMojibake(row.LOCADOR_RESPONSAVEL),
    FORNECEDOR: fixMojibake(row.FORNECEDOR),
    TEXTO: fixMojibake(row.TEXTO),
  }));

  const rowsForSheet =
    cleanedRows.length > 0
      ? cleanedRows
      : [{ Mensagem: 'Nenhum lançamento encontrado para os filtros selecionados (AREA = Energia, TIPO = ACTUAL 2026).' }];

  const buffer = await buildFastXlsxBuffer(rowsForSheet, 'Energia_ACTUAL_2026');
  return { buffer, rowCount: cleanedRows.length };
}
