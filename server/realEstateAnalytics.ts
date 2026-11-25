import { BigQuery } from '@google-cloud/bigquery';
import { buildFastXlsxBuffer, queryBigQueryFast } from './excelExport';
import { fixMojibake } from './energyAnalytics';

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

const COUNTRY_NORM_EXPR = `
  CASE
    WHEN UPPER(TRIM(COALESCE(Pais, ''))) IN ('BR', 'BRASIL', '') THEN 'Brasil'
    WHEN UPPER(TRIM(COALESCE(Pais, ''))) IN ('EUA', 'ESTADOS UNIDOS', 'USA') THEN 'EUA'
    ELSE TRIM(Pais)
  END
`;

export interface RealEstateFilterParams {
  tipo?: string;
  anomes?: string;
  contrato?: string;
  uf?: string;
  ufMode?: 'consolidated' | 'registered';
  centroCusto?: string;
  estacao?: string;
  fornecedor?: string;
  pais?: string;
  tipoOperacao?: string;
  tipoRe?: string;
  classificacao?: string;
  search?: string;
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

function buildRealEstateWhereClause(
  filters: RealEstateFilterParams,
  options: { skipTipo?: boolean } = {}
): {
  whereSql: string;
  params: Record<string, unknown>;
  ufExpr: string;
} {
  const ufExpr = filters.ufMode === 'registered' ? UF_REGISTERED_EXPR : UF_CONSOLIDATED_EXPR;
  const targetTipo = (filters.tipo && filters.tipo.trim()) || 'ACTUAL 2026';

  const conditions: string[] = ["UPPER(TRIM(AREA)) = 'REAL ESTATE'"];
  const params: Record<string, unknown> = {};
  if (!options.skipTipo) {
    conditions.push('UPPER(TRIM(TIPO)) = UPPER(@tipo)');
    params.tipo = targetTipo;
  } else {
    conditions.push(
      "UPPER(TRIM(TIPO)) IN ('BUDGET 2026', 'ACTUAL 2026', 'FCST 8+4', 'FCST 4+8')"
    );
  }

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

  if (filters.pais && filters.pais !== 'ALL') {
    conditions.push(`(${COUNTRY_NORM_EXPR}) = @pais`);
    params.pais = filters.pais.trim();
  }

  if (filters.tipoOperacao && filters.tipoOperacao !== 'ALL') {
    if (filters.tipoOperacao === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), '') IS NULL");
    } else {
      conditions.push('TRIM(ESTACAO_TIPO_OPERACAO) = @tipoOperacao');
      params.tipoOperacao = filters.tipoOperacao.trim();
    }
  }

  if (filters.tipoRe && filters.tipoRe !== 'ALL') {
    if (filters.tipoRe === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(TIPO_RE), '') IS NULL");
    } else {
      conditions.push('TRIM(TIPO_RE) = @tipoRe');
      params.tipoRe = filters.tipoRe.trim();
    }
  }

  if (filters.classificacao && filters.classificacao !== 'ALL') {
    conditions.push('TRIM(CLASSIFICACAO_FPA) = @classificacao');
    params.classificacao = filters.classificacao.trim();
  }

  if (filters.search && filters.search.trim()) {
    conditions.push(`(
      LOWER(COALESCE(CONTRATO_RE, '')) LIKE @searchLike
      OR LOWER(COALESCE(SIGLA_ESTACAO, '')) LIKE @searchLike
      OR LOWER(COALESCE(centro_custo, '')) LIKE @searchLike
      OR LOWER(COALESCE(DENOMINACAO_CENTRO_DE_CUSTO, '')) LIKE @searchLike
      OR LOWER(COALESCE(nome_fornecedor, '')) LIKE @searchLike
      OR LOWER(COALESCE(ESTACAO_CIDADE, '')) LIKE @searchLike
      OR LOWER(COALESCE(CLASSIFICACAO_FPA, '')) LIKE @searchLike
      OR LOWER(COALESCE(TIPO_RE, '')) LIKE @searchLike
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

const filtersCache = new Map<string, { expiresAt: number; data: unknown }>();
const dashboardCache = new Map<string, { expiresAt: number; data: unknown }>();
const excelModelCache = new Map<
  string,
  { expiresAt: number; data: RealEstateExcelModelResponse }
>();
const CACHE_MAX = 30;

export async function getRealEstateFilterOptions(bigquery: BigQuery, tipo = 'ACTUAL 2026') {
  const normalizedTipo = tipo.trim() || 'ACTUAL 2026';
  const now = Date.now();
  const cached = filtersCache.get(normalizedTipo);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const baseWhere = "UPPER(TRIM(AREA)) = 'REAL ESTATE' AND UPPER(TRIM(TIPO)) = UPPER(@tipo)";
  const params = { tipo: normalizedTipo };

  const [
    tiposRows,
    monthsRows,
    contractsRows,
    ufsRows,
    ccRows,
    stationsRows,
    suppliersRows,
    countriesRows,
    opTypesRows,
    tipoReRows,
    classifRows,
  ] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT TRIM(TIPO) AS value, COUNT(*) AS rows_count
       FROM ${DRE_FINAL_TABLE}
       WHERE UPPER(TRIM(AREA)) = 'REAL ESTATE' AND NULLIF(TRIM(TIPO), '') IS NOT NULL
       GROUP BY 1
       ORDER BY rows_count DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT TRIM(anomes) AS value, COUNT(*) AS rows_count
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1
       ORDER BY CAST(SPLIT(value, '/')[OFFSET(0)] AS INT64), CAST(SPLIT(value, '/')[OFFSET(1)] AS INT64)`,
      params
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
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT (${UF_CONSOLIDATED_EXPR}) AS value,
              COUNT(*) AS rows_count,
              SUM(valor) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1
       ORDER BY CASE WHEN value = 'Sem UF' THEN 1 ELSE 0 END, ABS(SUM(valor)) DESC`,
      params
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
       ORDER BY ABS(SUM(valor)) DESC`,
      params
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
       LIMIT 350`,
      params
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
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 300`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT (${COUNTRY_NORM_EXPR}) AS value,
              COUNT(*) AS rows_count,
              SUM(valor) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1
       ORDER BY CASE WHEN value = 'Brasil' THEN 0 ELSE 1 END, ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), ''), 'Não Classificado') AS label,
              COUNT(*) AS rows_count
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY rows_count DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(TIPO_RE), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(TIPO_RE), ''), 'Sem TIPO_RE') AS label,
              COUNT(*) AS rows_count
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY rows_count DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT TRIM(CLASSIFICACAO_FPA) AS value,
              COUNT(*) AS rows_count,
              SUM(valor) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere} AND NULLIF(TRIM(CLASSIFICACAO_FPA), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
  ]);

  const data = {
    tipos: tiposRows.map((r) => String(r.value)),
    months: monthsRows.map((r) => String(r.value)),
    contracts: contractsRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    ufs: ufsRows.map((r) => ({
      value: String(r.value),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    costCenters: ccRows.map((r) => {
      const code = fixMojibake(r.code);
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
      label: fixMojibake(r.label),
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
    countries: countriesRows.map((r) => ({
      value: fixMojibake(r.value),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    operationTypes: opTypesRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
    })),
    tipoReOptions: tipoReRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
    })),
    classifications: classifRows.map((r) => ({
      value: fixMojibake(r.value),
      label: fixMojibake(r.value),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
  };

  filtersCache.set(normalizedTipo, { expiresAt: now + 10 * 60 * 1000, data });
  return data;
}

export async function getRealEstateDashboardData(
  bigquery: BigQuery,
  filters: RealEstateFilterParams
) {
  const cacheKey = JSON.stringify(filters);
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { whereSql, params, ufExpr } = buildRealEstateWhereClause(filters);
  const { whereSql: whereNoTipo, params: paramsNoTipo } = buildRealEstateWhereClause(filters, {
    skipTipo: true,
  });

  const plLeafExpr = `
    CASE
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('REAL ESTATE - VENDA DE PRÉDIOS', 'REAL ESTATE - VENDA DE PREDIOS')
        THEN 'rev_venda_predios'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'REAL ESTATE REVENUE'
        OR (UPPER(TRIM(NIVEL_1)) LIKE '%NET REVENUE%' AND UPPER(TRIM(AREA)) = 'REAL ESTATE')
        THEN CASE
          WHEN LOWER(COALESCE(texto, '')) LIKE '%equity%' OR LOWER(COALESCE(DESCRICAO_CONTA_CONTABIL, '')) LIKE '%equity%'
            THEN 'rev_outras'
          ELSE 'rev_locacoes'
        END
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'PDD V.TAL' OR UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%PDD%'
        THEN 'pdd_projetada'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'FINANÇAS - CONSULTORIAS' THEN 'ovh_consultoria'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'BPO' THEN 'ovh_bpo'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('FINANÇAS - VIAGENS', 'FINANÇAS - SEGUROS', 'FINANÇAS - OTHER', 'TAX - OTHER TAX EXPENSES')
        THEN 'ovh_others'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'INTERNATIONAL CONNECTIVITY - REAL ESTATE'
        OR UPPER(TRIM(COALESCE(Pais, 'Brasil'))) NOT IN ('BRASIL', 'BR', '')
        THEN 'ex_brasil'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%SERV. PÚB%'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%LOGÍSTICA%'
        OR UPPER(TRIM(TIPO_RE)) LIKE '%ÁGUA%'
        OR UPPER(TRIM(TIPO_RE)) LIKE '%AGUA%'
        THEN CASE WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'util_comodato' ELSE 'util_agua' END
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('RE OPEX - MAINTENANCE', 'FACILITIES OPEX')
        THEN CASE WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'fac_comodato' ELSE 'fac_manutencao' END
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'RE OPEX - CLEANING'
        THEN CASE WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'fac_comodato' ELSE 'fac_limpeza' END
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'RE OPEX - IFRS16'
        OR UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%IFRS%'
        THEN 'rentals_ifrs16'
      WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'rentals_comodato'
      WHEN UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%IPTU%'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('TAX - OTHER TAX REAL ESTATE', 'RE OPEX - RENTALS - IPTU')
        OR UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%TAXAS%'
        THEN 'rentals_iptu'
      WHEN UPPER(TRIM(COALESCE(ESTACAO_TIPO_OPERACAO, ''))) = 'PREDIO ADM' THEN 'rentals_adm'
      WHEN UPPER(TRIM(COALESCE(ESTACAO_TIPO_OPERACAO, ''))) IN ('ANTENA', 'FTTH', 'COLOCATION', 'CORE', 'ILA', 'CONDOMINIO', 'ESTACAO', 'SITE')
        THEN 'rentals_tec'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'MOBILE SOLUTIONS - REAL ESTATE' OR UPPER(TRIM(TIPO_RE)) LIKE '%DEMAIS%'
        THEN 'rentals_demais'
      ELSE 'rentals_tec'
    END
  `;

  const [
    summaryRows,
    monthlyRows,
    plOpeningRows,
    buildingSaleRows,
    ufRows,
    countryRows,
    ccRows,
    classifRows,
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
         COUNT(DISTINCT (${COUNTRY_NORM_EXPR})) AS distinct_countries,
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
         (${plLeafExpr}) AS leaf_key,
         COUNT(*) AS rows_count,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN valor ELSE 0 END), 0) AS bgt26,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN valor ELSE 0 END), 0) AS act26,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN valor ELSE 0 END), 0) AS fct84,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN valor ELSE 0 END), 0) AS fct48
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoTipo}
       GROUP BY 1`,
      paramsNoTipo
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(
           NULLIF(REGEXP_EXTRACT(UPPER(COALESCE(texto, '')), r'([A-Z]{2}-[A-Z0-9]{2,5}-[A-Z0-9]{2,5})'), ''),
           NULLIF(TRIM(SIGLA_ESTACAO), ''),
           CASE
             WHEN LOWER(COALESCE(texto, '')) LIKE '%ganhos imob%' THEN 'GANHOS IMOB. / AJUSTE'
             WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN 'Projeção Venda (FCST 8+4)'
             WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN 'Projeção Venda (FCST 4+8)'
             WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN 'Planejado Venda (BGT 26)'
             ELSE 'Outros Imóveis / Ajustes'
           END
         ) AS imovel,
         COALESCE(NULLIF(TRIM(CONTRATO_RE), ''), '—') AS contrato,
         COALESCE(NULLIF(TRIM(anomes), ''), '—') AS anomes,
         COALESCE(NULLIF(TRIM(texto), ''), NULLIF(TRIM(atribuicao), ''), 'Venda de Prédios V.tal') AS texto,
         COALESCE(NULLIF(TRIM(nome_fornecedor), ''), '—') AS fornecedor,
         COUNT(*) AS rows_count,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN valor ELSE 0 END), 0) AS act_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN valor ELSE 0 END), 0) AS bgt_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN valor ELSE 0 END), 0) AS fct84_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN valor ELSE 0 END), 0) AS fct48_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoTipo}
         AND (
           UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('REAL ESTATE - VENDA DE PRÉDIOS', 'REAL ESTATE - VENDA DE PREDIOS')
           OR LOWER(COALESCE(texto, '')) LIKE '%venda imovel%'
           OR LOWER(COALESCE(texto, '')) LIKE '%venda de predio%'
           OR LOWER(COALESCE(texto, '')) LIKE '%venda de prédio%'
           OR LOWER(COALESCE(atribuicao, '')) LIKE '%venda de pr%'
         )
       GROUP BY 1, 2, 3, 4, 5
       HAVING ABS(act_total) + ABS(bgt_total) + ABS(fct84_total) + ABS(fct48_total) > 0.01
       ORDER BY ABS(act_total) DESC, ABS(fct84_total) DESC, anomes ASC
       LIMIT 60`,
      paramsNoTipo
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
         (${COUNTRY_NORM_EXPR}) AS pais,
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
         COALESCE(NULLIF(TRIM(centro_custo), ''), 'Sem CC') AS cc,
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
         COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), 'Sem Classificação') AS classificacao,
         COALESCE(NULLIF(TRIM(TIPO_RE), ''), 'Não Informado') AS tipo_re,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(conta_do_razao), ''), COALESCE(NULLIF(TRIM(CONTA), ''), 'Sem Conta')) AS conta,
         ANY_VALUE(COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), ''))) AS conta_desc,
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
       LIMIT 35`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(CONTRATO_RE) AS contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_GESTOR_CTTO), '')) AS gestor,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor_principal,
         ANY_VALUE(NULLIF(TRIM(TIPO_RE), '')) AS tipo_re,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(DISTINCT CASE WHEN (${ufExpr}) != 'Sem UF' THEN (${ufExpr}) END) AS ufs,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 80`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         UPPER(TRIM(SIGLA_ESTACAO)) AS estacao,
         ANY_VALUE((${ufExpr})) AS uf,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_UF), '')) AS uf_cadastro,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_CIDADE), '')) AS cidade,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), '')) AS tipo_operacao,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_STATUS_FINANC), '')) AS status_fin,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_GESTOR_CTTO), '')) AS gestor,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_LOCADOR_RESPONSAVEL), '')) AS locador,
         ANY_VALUE(NULLIF(TRIM(CONTRATO_RE), '')) AS contrato_principal,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(SIGLA_ESTACAO), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 120`,
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
      distinctCountries: intVal(s.distinct_countries),
      distinctCostCenters: intVal(s.distinct_ccs),
      distinctSuppliers: intVal(s.distinct_suppliers),
      rowsWithContract: intVal(s.rows_with_contract),
      rowsWithStation: intVal(s.rows_with_station),
      rowsWithRegisteredUf: intVal(s.rows_with_registered_uf),
      valueWithContract: numVal(s.value_with_contract),
    },
    monthly: monthlyRows.map((r) => ({
      anomes: String(r.anomes || ''),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    plOpenings: (() => {
      const meta: Record<string, { label: string; group: string; order: number }> = {
        rev_locacoes: { label: 'Receita c/ Locações', group: 'Net Revenue', order: 1 },
        rev_venda_predios: { label: 'Venda Prédios V.tal', group: 'Net Revenue', order: 2 },
        rev_outras: { label: 'Equity Oi / Outras Receitas', group: 'Net Revenue', order: 3 },
        rentals_adm: { label: 'Rentals — Prédios Administrativos', group: 'Rentals', order: 4 },
        rentals_tec: { label: 'Rentals — Prédios Técnicos', group: 'Rentals', order: 5 },
        rentals_ifrs16: { label: 'Rentals — IFRS16', group: 'Rentals', order: 6 },
        rentals_iptu: { label: 'Rentals — IPTU / Taxas', group: 'Rentals', order: 7 },
        rentals_comodato: { label: 'Rentals — Comodato', group: 'Rentals', order: 8 },
        rentals_demais: { label: 'Rentals — Demais', group: 'Rentals', order: 9 },
        fac_manutencao: { label: 'Facilities — Manutenção Predial', group: 'Facilities', order: 10 },
        fac_limpeza: { label: 'Facilities — Limpeza Predial', group: 'Facilities', order: 11 },
        fac_comodato: { label: 'Facilities — Comodato', group: 'Facilities', order: 12 },
        util_agua: { label: 'Água, Esgoto & Gás', group: 'Utilidades', order: 13 },
        util_comodato: { label: 'Água & Esgoto — Comodato', group: 'Utilidades', order: 14 },
        pdd_projetada: { label: 'PDD Projetada', group: 'Provisões', order: 15 },
        ex_brasil: { label: 'Ex-Brasil (Latam)', group: 'Internacional', order: 16 },
        ovh_consultoria: { label: 'Overhead — Consultoria', group: 'Overhead', order: 17 },
        ovh_bpo: { label: 'Overhead — BPO', group: 'Overhead', order: 18 },
        ovh_others: { label: 'Overhead — Demais', group: 'Overhead', order: 19 },
      };
      return plOpeningRows
        .map((r) => {
          const leafKey = String(r.leaf_key || 'rentals_tec');
          const m = meta[leafKey] || { label: leafKey, group: 'Real Estate', order: 99 };
          return {
            leafKey,
            label: m.label,
            group: m.group,
            order: m.order,
            bgt26: numVal(r.bgt26),
            act26: numVal(r.act26),
            fct84: numVal(r.fct84),
            fct48: numVal(r.fct48),
            rows: intVal(r.rows_count),
          };
        })
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...rest }) => rest);
    })(),
    buildingSales: buildingSaleRows.map((r) => ({
      imovel: fixMojibake(r.imovel) || 'Imóvel V.tal',
      contrato: fixMojibake(r.contrato) || '—',
      anomes: String(r.anomes || '—'),
      texto: fixMojibake(r.texto) || 'Venda de Prédios V.tal',
      fornecedor: fixMojibake(r.fornecedor) || '—',
      actTotal: numVal(r.act_total),
      bgtTotal: numVal(r.bgt_total),
      fct84Total: numVal(r.fct84_total),
      fct48Total: numVal(r.fct48_total),
      rows: intVal(r.rows_count),
    })),
    byUf: ufRows.map((r) => ({
      uf: String(r.uf || 'Sem UF'),
      rows: intVal(r.rows_count),
      stations: intVal(r.stations),
      contracts: intVal(r.contracts),
      registeredRows: intVal(r.registered_rows),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byCountry: countryRows.map((r) => ({
      pais: fixMojibake(r.pais) || 'Brasil',
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byCostCenter: ccRows.map((r) => ({
      cc: fixMojibake(r.cc) || 'Sem CC',
      ccDesc: fixMojibake(r.cc_desc),
      rows: intVal(r.rows_count),
      stations: intVal(r.stations),
      contracts: intVal(r.contracts),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byClassification: classifRows.map((r) => ({
      classificacao: fixMojibake(r.classificacao),
      tipoRe: fixMojibake(r.tipo_re),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byAccount: accountRows.map((r) => ({
      conta: fixMojibake(r.conta),
      contaDesc: fixMojibake(r.conta_desc),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    bySupplier: supplierRows.map((r) => ({
      fornecedor: fixMojibake(r.fornecedor) || 'Sem Fornecedor',
      rows: intVal(r.rows_count),
      contracts: intVal(r.contracts),
      stations: intVal(r.stations),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byContract: contractRows.map((r) => ({
      contrato: fixMojibake(r.contrato),
      tipoContrato: fixMojibake(r.tipo_contrato),
      gestor: fixMojibake(r.gestor),
      fornecedorPrincipal: fixMojibake(r.fornecedor_principal) || '—',
      tipoRe: fixMojibake(r.tipo_re) || '—',
      stations: intVal(r.stations),
      ufs: intVal(r.ufs),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    byStation: stationRows.map((r) => ({
      estacao: fixMojibake(r.estacao),
      uf: String(r.uf || 'Sem UF'),
      ufCadastro: r.uf_cadastro ? String(r.uf_cadastro) : null,
      cidade: fixMojibake(r.cidade),
      tipoContrato: fixMojibake(r.tipo_contrato),
      tipoOperacao: fixMojibake(r.tipo_operacao),
      statusFin: fixMojibake(r.status_fin),
      gestor: fixMojibake(r.gestor),
      locador: fixMojibake(r.locador),
      contratoPrincipal: r.contrato_principal ? fixMojibake(r.contrato_principal) : null,
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
  };

  if (dashboardCache.size >= CACHE_MAX) {
    const firstKey = dashboardCache.keys().next().value;
    if (firstKey) dashboardCache.delete(firstKey);
  }
  dashboardCache.set(cacheKey, { expiresAt: now + 5 * 60 * 1000, data });
  return data;
}

export async function getRealEstateUfDrilldown(
  bigquery: BigQuery,
  ufTarget: string,
  filters: RealEstateFilterParams
) {
  const drillFilters: RealEstateFilterParams = {
    ...filters,
    uf: ufTarget,
  };
  const { whereSql, params, ufExpr } = buildRealEstateWhereClause(drillFilters);

  const [summaryRows, monthlyRows, stationsRows, contractsRows, ccRows] = await Promise.all([
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
         UPPER(TRIM(SIGLA_ESTACAO)) AS estacao,
         ANY_VALUE((${ufExpr})) AS uf,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_UF), '')) AS uf_cadastro,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_CIDADE), '')) AS cidade,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_OPERACAO), '')) AS tipo_operacao,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_STATUS_FINANC), '')) AS status_fin,
         ANY_VALUE(NULLIF(TRIM(CONTRATO_RE), '')) AS contrato_principal,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total,
         COALESCE(SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END), 0) AS gross_cost,
         COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS gross_credit
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(SIGLA_ESTACAO), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 150`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(CONTRATO_RE) AS contrato,
         ANY_VALUE(NULLIF(TRIM(ESTACAO_TIPO_CONTRATO), '')) AS tipo_contrato,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor_principal,
         COUNT(DISTINCT NULLIF(TRIM(SIGLA_ESTACAO), '')) AS stations,
         COUNT(*) AS rows_count,
         COALESCE(SUM(valor), 0) AS net_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 100`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(centro_custo), ''), 'Sem CC') AS cc,
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
      anomes: String(r.anomes || ''),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    stations: stationsRows.map((r) => ({
      estacao: fixMojibake(r.estacao),
      uf: String(r.uf || ufTarget),
      ufCadastro: r.uf_cadastro ? String(r.uf_cadastro) : null,
      cidade: fixMojibake(r.cidade),
      tipoContrato: fixMojibake(r.tipo_contrato),
      tipoOperacao: fixMojibake(r.tipo_operacao),
      statusFin: fixMojibake(r.status_fin),
      gestor: '',
      contratoPrincipal: r.contrato_principal ? fixMojibake(r.contrato_principal) : null,
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
      grossCost: numVal(r.gross_cost),
      grossCredit: numVal(r.gross_credit),
    })),
    contracts: contractsRows.map((r) => ({
      contrato: fixMojibake(r.contrato),
      tipoContrato: fixMojibake(r.tipo_contrato),
      fornecedorPrincipal: fixMojibake(r.fornecedor_principal) || '—',
      stations: intVal(r.stations),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
    costCenters: ccRows.map((r) => ({
      cc: fixMojibake(r.cc),
      ccDesc: fixMojibake(r.cc_desc),
      rows: intVal(r.rows_count),
      netTotal: numVal(r.net_total),
    })),
  };
}

export async function getRealEstateLedgerPage(
  bigquery: BigQuery,
  filters: RealEstateFilterParams,
  options: { page?: number; pageSize?: number; sortBy?: string }
) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize || 50));
  const offset = (page - 1) * pageSize;

  let orderBySql = 'ABS(valor) DESC, anomes DESC';
  if (options.sortBy === 'valor_asc') orderBySql = 'valor ASC, anomes DESC';
  else if (options.sortBy === 'valor_desc') orderBySql = 'valor DESC, anomes DESC';
  else if (options.sortBy === 'recent') {
    orderBySql = "CAST(SPLIT(anomes, '/')[OFFSET(0)] AS INT64) DESC, CAST(SPLIT(anomes, '/')[OFFSET(1)] AS INT64) DESC, ABS(valor) DESC";
  }

  const { whereSql, params, ufExpr } = buildRealEstateWhereClause(filters);

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
         (${COUNTRY_NORM_EXPR}) AS pais,
         centro_custo,
         DENOMINACAO_CENTRO_DE_CUSTO,
         COALESCE(NULLIF(TRIM(conta_do_razao), ''), NULLIF(TRIM(CONTA), '')) AS conta,
         COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), '')) AS conta_desc,
         CLASSIFICACAO_FPA,
         TIPO_RE,
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
      pais: fixMojibake(r.pais) || 'Brasil',
      cc: fixMojibake(r.centro_custo),
      ccDesc: fixMojibake(r.DENOMINACAO_CENTRO_DE_CUSTO),
      conta: fixMojibake(r.conta),
      contaDesc: fixMojibake(r.conta_desc),
      classificacao: fixMojibake(r.CLASSIFICACAO_FPA),
      tipoRe: fixMojibake(r.TIPO_RE),
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

export async function exportRealEstateExcelBuffer(
  bigquery: BigQuery,
  filters: RealEstateFilterParams
): Promise<{ buffer: Buffer; rowCount: number }> {
  const { whereSql, params, ufExpr } = buildRealEstateWhereClause(filters);

  const sql = `
    SELECT
      TRIM(anomes) AS ANOMES,
      TIPO,
      NIVEL_2 AS EMPRESA,
      (${COUNTRY_NORM_EXPR}) AS PAIS,
      AREA,
      CLASSIFICACAO_FPA,
      TIPO_RE,
      centro_custo AS CENTRO_CUSTO,
      DENOMINACAO_CENTRO_DE_CUSTO AS DESC_CENTRO_CUSTO,
      COALESCE(NULLIF(TRIM(conta_do_razao), ''), NULLIF(TRIM(CONTA), '')) AS CONTA_RAZAO,
      COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), '')) AS DESC_CONTA,
      CONTRATO_RE,
      SIGLA_ESTACAO,
      (${ufExpr}) AS UF_CONSOLIDADA,
      ESTACAO_UF AS UF_CADASTRO_RE,
      ESTACAO_CIDADE AS CIDADE,
      ESTACAO_TIPO_CONTRATO AS TIPO_CONTRATO,
      ESTACAO_TIPO_OPERACAO AS TIPO_OPERACAO,
      ESTACAO_STATUS_FINANC AS STATUS_FINANCEIRO,
      ESTACAO_GESTOR_CTTO AS GESTOR_CONTRATO,
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
    PAIS: fixMojibake(row.PAIS),
    CLASSIFICACAO_FPA: fixMojibake(row.CLASSIFICACAO_FPA),
    TIPO_RE: fixMojibake(row.TIPO_RE),
    DESC_CENTRO_CUSTO: fixMojibake(row.DESC_CENTRO_CUSTO),
    DESC_CONTA: fixMojibake(row.DESC_CONTA),
    CIDADE: fixMojibake(row.CIDADE),
    FORNECEDOR: fixMojibake(row.FORNECEDOR),
    TEXTO: fixMojibake(row.TEXTO),
  }));

  const rowsForSheet =
    cleanedRows.length > 0
      ? cleanedRows
      : [{ Mensagem: 'Nenhum lançamento encontrado para os filtros selecionados em Real Estate.' }];

  const buffer = await buildFastXlsxBuffer(rowsForSheet, 'Real_Estate_Detalhado');
  return { buffer, rowCount: cleanedRows.length };
}

// =========================================================================
// VISÃO EXCEL (MODELO ANÁLISE + BASE P&L) — DIRETAMENTE DO BIGQUERY DRE_FINAL
// =========================================================================

export type PlLeafKey =
  | 'rev_locacoes'
  | 'rev_venda_predios'
  | 'rev_outras'
  | 'rentals_adm'
  | 'rentals_tec'
  | 'rentals_ifrs16'
  | 'rentals_iptu'
  | 'rentals_comodato'
  | 'rentals_demais'
  | 'fac_manutencao'
  | 'fac_limpeza'
  | 'fac_comodato'
  | 'util_agua'
  | 'util_comodato'
  | 'pdd_projetada'
  | 'ex_brasil'
  | 'ovh_consultoria'
  | 'ovh_bpo'
  | 'ovh_others';

export interface PlRowComputed {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  isComodato?: boolean;
  isVendaPredio?: boolean;
  isTechnicalStation?: boolean;
  bgt: number[]; // 12 months (index 0..11)
  bgtFy: number;
  fct: number[]; // 12 months (FCT 8+4)
  fctFy: number;
  actFct: number[]; // 1..cutoff from ACTUAL 2026, cutoff+1..12 from Fcst 8+4
  actFctFy: number;
  act25: number[]; // 12 months Actual 2025
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

interface AnaliseSummaryRow {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  bgt26: number;
  actFct26: number;
  delta: number;
}

export interface RealEstateExcelModelResponse {
  actCutoffMonth: number;
  includeOverheadCc: boolean;
  months: string[];
  analise: {
    visaoPl: AnaliseSummaryRow[];
    visaoGerencial: AnaliseSummaryRow[];
    chartSummaryPl: {
      bgtActPeriod: number;
      bgtFctPeriod: number;
      bgtTotal: number;
      realActPeriod: number;
      realFctPeriod: number;
      realTotal: number;
      pctVsBgt: number;
    };
    chartSummaryGerencial: {
      bgtActPeriod: number;
      bgtFctPeriod: number;
      bgtTotal: number;
      realActPeriod: number;
      realFctPeriod: number;
      realTotal: number;
      pctVsBgt: number;
    };
  };
  basePl: PlRowComputed[];
}

const PL_ROW_DEFS: Array<{
  id: string;
  label: string;
  level: 0 | 1 | 2;
  childrenIds?: string[];
  leafKey?: PlLeafKey;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  isComodato?: boolean;
  isVendaPredio?: boolean;
  isTechnicalStation?: boolean;
}> = [
  {
    id: 'total_re',
    label: 'Resultado total Real Estate',
    level: 0,
    isTotal: true,
    childrenIds: ['net_revenue', 'opex_re'],
  },
  {
    id: 'net_revenue',
    label: 'Net Revenue',
    level: 1,
    isSectionHeader: true,
    childrenIds: ['rev_locacoes', 'rev_venda_predios', 'rev_outras'],
  },
  { id: 'rev_locacoes', label: 'Receita c/ Locações', level: 2, leafKey: 'rev_locacoes' },
  {
    id: 'rev_venda_predios',
    label: 'Venda Prédios V.tal',
    level: 2,
    leafKey: 'rev_venda_predios',
    isVendaPredio: true,
  },
  { id: 'rev_outras', label: 'Equity Oi / Outras Receitas', level: 2, leafKey: 'rev_outras' },
  {
    id: 'opex_re',
    label: 'Opex Real Estate',
    level: 1,
    isTotal: true,
    childrenIds: ['rentals', 'facilities', 'utilities', 'pdd_projetada', 'ex_brasil', 'overhead'],
  },
  {
    id: 'rentals',
    label: 'Rentals',
    level: 1,
    isSectionHeader: true,
    childrenIds: [
      'rentals_adm',
      'rentals_tec',
      'rentals_ifrs16',
      'rentals_iptu',
      'rentals_comodato',
      'rentals_demais',
    ],
  },
  { id: 'rentals_adm', label: 'Prédios Administrativos', level: 2, leafKey: 'rentals_adm' },
  {
    id: 'rentals_tec',
    label: 'Prédios Técnicos',
    level: 2,
    leafKey: 'rentals_tec',
    isTechnicalStation: true,
  },
  { id: 'rentals_ifrs16', label: 'IFRS16', level: 2, leafKey: 'rentals_ifrs16' },
  { id: 'rentals_iptu', label: 'IPTU / Taxas', level: 2, leafKey: 'rentals_iptu' },
  {
    id: 'rentals_comodato',
    label: 'Comodato (Rentals)',
    level: 2,
    leafKey: 'rentals_comodato',
    isComodato: true,
  },
  { id: 'rentals_demais', label: 'Demais Locações / Mobile', level: 2, leafKey: 'rentals_demais' },
  {
    id: 'facilities',
    label: 'Facilities',
    level: 1,
    isSectionHeader: true,
    childrenIds: ['fac_manutencao', 'fac_limpeza', 'fac_comodato'],
  },
  { id: 'fac_manutencao', label: 'Manutenção Predial', level: 2, leafKey: 'fac_manutencao' },
  { id: 'fac_limpeza', label: 'Limpeza Predial', level: 2, leafKey: 'fac_limpeza' },
  {
    id: 'fac_comodato',
    label: 'Comodato (Facilities)',
    level: 2,
    leafKey: 'fac_comodato',
    isComodato: true,
  },
  {
    id: 'utilities',
    label: 'Água, Esgoto e Gás',
    level: 1,
    isSectionHeader: true,
    childrenIds: ['util_agua', 'util_comodato'],
  },
  { id: 'util_agua', label: 'Custo mensal', level: 2, leafKey: 'util_agua' },
  {
    id: 'util_comodato',
    label: 'Comodato (Água/Util.)',
    level: 2,
    leafKey: 'util_comodato',
    isComodato: true,
  },
  {
    id: 'pdd_projetada',
    label: 'PDD projetada',
    level: 1,
    isSectionHeader: true,
    leafKey: 'pdd_projetada',
  },
  {
    id: 'ex_brasil',
    label: 'Ex Brasil (Latam)',
    level: 1,
    isSectionHeader: true,
    leafKey: 'ex_brasil',
  },
  {
    id: 'overhead',
    label: 'Overhead',
    level: 1,
    isSectionHeader: true,
    childrenIds: ['ovh_consultoria', 'ovh_bpo', 'ovh_others'],
  },
  { id: 'ovh_consultoria', label: 'Consultoria', level: 2, leafKey: 'ovh_consultoria' },
  { id: 'ovh_bpo', label: 'BPO', level: 2, leafKey: 'ovh_bpo' },
  { id: 'ovh_others', label: 'Others (Viagens, Seguros e Outros)', level: 2, leafKey: 'ovh_others' },
];

export async function getRealEstateExcelModelData(
  bigquery: BigQuery,
  options: { actCutoffMonth?: number; includeOverheadCc?: boolean } = {}
): Promise<RealEstateExcelModelResponse> {
  const cutoff = Math.min(11, Math.max(1, Math.trunc(options.actCutoffMonth || 10)));
  const includeOverheadCc = options.includeOverheadCc !== false;
  const cacheKey = `${cutoff}:${includeOverheadCc ? 'withCC' : 'areaOnly'}`;
  const now = Date.now();
  const cached = excelModelCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const scopeWhere = includeOverheadCc
    ? `(
         UPPER(TRIM(AREA)) = 'REAL ESTATE'
         OR (
           TRIM(centro_custo) = 'BR01932625'
           AND UPPER(TRIM(CLASSIFICACAO_FPA)) IN (
             'FINANÇAS - CONSULTORIAS',
             'BPO',
             'FINANÇAS - VIAGENS',
             'FINANÇAS - SEGUROS',
             'FINANÇAS - OTHER',
             'TAX - OTHER TAX EXPENSES',
             'PDD V.TAL'
           )
         )
       )`
    : `UPPER(TRIM(AREA)) = 'REAL ESTATE'`;

  const leafSqlExpr = `
    CASE
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'REAL ESTATE - VENDA DE PRÉDIOS'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) = 'REAL ESTATE - VENDA DE PREDIOS'
        THEN 'rev_venda_predios'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'REAL ESTATE REVENUE'
        OR (UPPER(TRIM(NIVEL_1)) LIKE '%NET REVENUE%' AND UPPER(TRIM(AREA)) = 'REAL ESTATE')
        THEN CASE
          WHEN LOWER(COALESCE(texto, '')) LIKE '%equity%' OR LOWER(COALESCE(DESCRICAO_CONTA_CONTABIL, '')) LIKE '%equity%'
            THEN 'rev_outras'
          ELSE 'rev_locacoes'
        END

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'PDD V.TAL'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%PDD%'
        THEN 'pdd_projetada'

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'FINANÇAS - CONSULTORIAS' THEN 'ovh_consultoria'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'BPO' THEN 'ovh_bpo'
      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) IN (
        'FINANÇAS - VIAGENS',
        'FINANÇAS - SEGUROS',
        'FINANÇAS - OTHER',
        'TAX - OTHER TAX EXPENSES'
      ) THEN 'ovh_others'

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'INTERNATIONAL CONNECTIVITY - REAL ESTATE'
        OR UPPER(TRIM(COALESCE(Pais, 'Brasil'))) NOT IN ('BRASIL', 'BR', '')
        THEN 'ex_brasil'

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%SERV. PÚB%'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) LIKE '%LOGÍSTICA%'
        OR UPPER(TRIM(TIPO_RE)) LIKE '%ÁGUA%'
        OR UPPER(TRIM(TIPO_RE)) LIKE '%AGUA%'
        THEN CASE
          WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'util_comodato'
          ELSE 'util_agua'
        END

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('RE OPEX - MAINTENANCE', 'FACILITIES OPEX')
        THEN CASE
          WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'fac_comodato'
          ELSE 'fac_manutencao'
        END

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'RE OPEX - CLEANING'
        THEN CASE
          WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%' THEN 'fac_comodato'
          ELSE 'fac_limpeza'
        END

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'RE OPEX - IFRS16'
        OR UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%IFRS%'
        THEN 'rentals_ifrs16'

      WHEN UPPER(TRIM(TIPO_RE)) LIKE '%COMODATO%'
        THEN 'rentals_comodato'

      WHEN UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%IPTU%'
        OR UPPER(TRIM(CLASSIFICACAO_FPA)) IN ('TAX - OTHER TAX REAL ESTATE', 'RE OPEX - RENTALS - IPTU')
        OR UPPER(COALESCE(DESCRICAO_CONTA_CONTABIL, CONTA_CONTABIL_DESCRICAO, '')) LIKE '%TAXAS%'
        THEN 'rentals_iptu'

      WHEN UPPER(TRIM(COALESCE(ESTACAO_TIPO_OPERACAO, ''))) = 'PREDIO ADM'
        THEN 'rentals_adm'

      WHEN UPPER(TRIM(COALESCE(ESTACAO_TIPO_OPERACAO, ''))) IN (
        'ANTENA', 'FTTH', 'COLOCATION', 'CORE', 'ILA', 'CONDOMINIO', 'ESTACAO', 'SITE'
      )
        THEN 'rentals_tec'

      WHEN UPPER(TRIM(CLASSIFICACAO_FPA)) = 'MOBILE SOLUTIONS - REAL ESTATE'
        THEN 'rentals_demais'

      WHEN UPPER(TRIM(TIPO_RE)) LIKE '%DEMAIS%'
        THEN 'rentals_demais'

      ELSE 'rentals_tec'
    END
  `;

  const sql = `
    SELECT
      CASE
        WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN 'BGT26'
        WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN 'FCT84'
        WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN 'ACT26'
        WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2025' THEN 'ACT25'
      END AS tipo_grupo,
      SAFE_CAST(SPLIT(TRIM(anomes), '/')[SAFE_OFFSET(1)] AS INT64) AS month_num,
      (${leafSqlExpr}) AS leaf_key,
      COALESCE(SUM(valor), 0) AS total_valor
    FROM ${DRE_FINAL_TABLE}
    WHERE ${scopeWhere}
      AND UPPER(TRIM(TIPO)) IN ('BUDGET 2026', 'FCST 8+4', 'ACTUAL 2026', 'ACTUAL 2025')
      AND NULLIF(TRIM(anomes), '') IS NOT NULL
    GROUP BY 1, 2, 3
  `;

  const rawRows = await runBqQuery(bigquery, sql);

  // Acumuladores por leaf_key -> [12 meses]
  const empty12 = () => new Array<number>(12).fill(0);
  const buckets: Record<string, { bgt: number[]; fct: number[]; act26: number[]; act25: number[] }> = {};

  for (const def of PL_ROW_DEFS) {
    if (def.leafKey) {
      buckets[def.leafKey] = {
        bgt: empty12(),
        fct: empty12(),
        act26: empty12(),
        act25: empty12(),
      };
    }
  }

  for (const r of rawRows) {
    const tipoGrupo = String(r.tipo_grupo || '');
    const m = intVal(r.month_num);
    const leaf = String(r.leaf_key || '') as PlLeafKey;
    const val = numVal(r.total_valor);
    if (m < 1 || m > 12 || !buckets[leaf]) continue;
    const idx = m - 1;
    if (tipoGrupo === 'BGT26') buckets[leaf].bgt[idx] += val;
    else if (tipoGrupo === 'FCT84') buckets[leaf].fct[idx] += val;
    else if (tipoGrupo === 'ACT26') buckets[leaf].act26[idx] += val;
    else if (tipoGrupo === 'ACT25') buckets[leaf].act25[idx] += val;
  }

  const rowMap = new Map<string, PlRowComputed>();
  const sumArr = (arr: number[], start = 0, end = 12) => {
    let s = 0;
    for (let i = start; i < end; i++) s += arr[i] || 0;
    return s;
  };

  // Passo 1: Folhas
  for (const def of PL_ROW_DEFS) {
    if (!def.leafKey) continue;
    const b = buckets[def.leafKey];
    const actFct = empty12();
    for (let i = 0; i < 12; i++) {
      // M+2: até o mês de corte (cutoff) usa ACTUAL 2026; após cutoff usa Fcst 8+4
      actFct[i] = i < cutoff ? b.act26[i] : b.fct[i];
    }

    const bgtFy = sumArr(b.bgt);
    const fctFy = sumArr(b.fct);
    const actFctFy = sumArr(actFct);
    const act25Fy = sumArr(b.act25);

    const act26Ytd = sumArr(actFct, 0, cutoff);
    const act25Ytd = sumArr(b.act25, 0, cutoff);
    const bgtYtd = sumArr(b.bgt, 0, cutoff);
    const fctYtd = sumArr(b.fct, 0, cutoff);

    rowMap.set(def.id, {
      id: def.id,
      label: def.label,
      level: def.level,
      isTotal: def.isTotal,
      isSectionHeader: def.isSectionHeader,
      isComodato: def.isComodato,
      isVendaPredio: def.isVendaPredio,
      isTechnicalStation: def.isTechnicalStation,
      bgt: b.bgt,
      bgtFy,
      fct: b.fct,
      fctFy,
      actFct,
      actFctFy,
      act25: b.act25,
      act25Fy,
      ytd: {
        act26VsAct25: act26Ytd - act25Ytd,
        act26VsBgt26: act26Ytd - bgtYtd,
        act26VsFct26: act26Ytd - fctYtd,
      },
      fy: {
        act26VsAct25: actFctFy - act25Fy,
        act26VsBgt26: actFctFy - bgtFy,
        act26VsFct26: actFctFy - fctFy,
      },
    });
  }

  // Passo 2: Pais (Bottom-up na ordem reversa para garantir totalizações aninhadas)
  for (let idx = PL_ROW_DEFS.length - 1; idx >= 0; idx--) {
    const def = PL_ROW_DEFS[idx];
    if (!def.childrenIds || def.childrenIds.length === 0) continue;

    const bgt = empty12();
    const fct = empty12();
    const actFct = empty12();
    const act25 = empty12();

    for (const childId of def.childrenIds) {
      const child = rowMap.get(childId);
      if (!child) continue;
      for (let i = 0; i < 12; i++) {
        bgt[i] += child.bgt[i];
        fct[i] += child.fct[i];
        actFct[i] += child.actFct[i];
        act25[i] += child.act25[i];
      }
    }

    const bgtFy = sumArr(bgt);
    const fctFy = sumArr(fct);
    const actFctFy = sumArr(actFct);
    const act25Fy = sumArr(act25);

    const act26Ytd = sumArr(actFct, 0, cutoff);
    const act25Ytd = sumArr(act25, 0, cutoff);
    const bgtYtd = sumArr(bgt, 0, cutoff);
    const fctYtd = sumArr(fct, 0, cutoff);

    rowMap.set(def.id, {
      id: def.id,
      label: def.label,
      level: def.level,
      isTotal: def.isTotal,
      isSectionHeader: def.isSectionHeader,
      bgt,
      bgtFy,
      fct,
      fctFy,
      actFct,
      actFctFy,
      act25,
      act25Fy,
      ytd: {
        act26VsAct25: act26Ytd - act25Ytd,
        act26VsBgt26: act26Ytd - bgtYtd,
        act26VsFct26: act26Ytd - fctYtd,
      },
      fy: {
        act26VsAct25: actFctFy - act25Fy,
        act26VsBgt26: actFctFy - bgtFy,
        act26VsFct26: actFctFy - fctFy,
      },
    });
  }

  const basePlRows: PlRowComputed[] = PL_ROW_DEFS.map((d) => rowMap.get(d.id)!);

  // Passo 3: Monta as duas tabelas da aba "Análise"
  const getVal = (id: string, col: 'bgtFy' | 'actFctFy') => rowMap.get(id)?.[col] ?? 0;

  const buildAnaliseTable = (excludeTechnicalStations: boolean): AnaliseSummaryRow[] => {
    const revLocBgt = getVal('rev_locacoes', 'bgtFy') + getVal('rev_outras', 'bgtFy');
    const revLocAct = getVal('rev_locacoes', 'actFctFy') + getVal('rev_outras', 'actFctFy');

    const aluguelBgt =
      getVal('rentals_adm', 'bgtFy') +
      getVal('rentals_demais', 'bgtFy') +
      (excludeTechnicalStations ? 0 : getVal('rentals_tec', 'bgtFy'));
    const aluguelAct =
      getVal('rentals_adm', 'actFctFy') +
      getVal('rentals_demais', 'actFctFy') +
      (excludeTechnicalStations ? 0 : getVal('rentals_tec', 'actFctFy'));

    const ifrsBgt = getVal('rentals_ifrs16', 'bgtFy');
    const ifrsAct = getVal('rentals_ifrs16', 'actFctFy');
    const iptuBgt = getVal('rentals_iptu', 'bgtFy');
    const iptuAct = getVal('rentals_iptu', 'actFctFy');
    const rentalsBgt = aluguelBgt + ifrsBgt + iptuBgt;
    const rentalsAct = aluguelAct + ifrsAct + iptuAct;

    const facBgt = getVal('fac_manutencao', 'bgtFy') + getVal('fac_limpeza', 'bgtFy');
    const facAct = getVal('fac_manutencao', 'actFctFy') + getVal('fac_limpeza', 'actFctFy');

    const utilBgt = getVal('util_agua', 'bgtFy');
    const utilAct = getVal('util_agua', 'actFctFy');

    const pddBgt = excludeTechnicalStations ? 0 : getVal('pdd_projetada', 'bgtFy');
    const pddAct = excludeTechnicalStations ? 0 : getVal('pdd_projetada', 'actFctFy');

    const exBrBgt = getVal('ex_brasil', 'bgtFy');
    const exBrAct = getVal('ex_brasil', 'actFctFy');

    const ovhBgt = getVal('overhead', 'bgtFy');
    const ovhAct = getVal('overhead', 'actFctFy');

    const totalBgt = revLocBgt + rentalsBgt + facBgt + utilBgt + pddBgt + exBrBgt + ovhBgt;
    const totalAct = revLocAct + rentalsAct + facAct + utilAct + pddAct + exBrAct + ovhAct;

    const mk = (id: string, label: string, level: 0 | 1 | 2, bgt26: number, actFct26: number): AnaliseSummaryRow => ({
      id,
      label,
      level,
      bgt26,
      actFct26,
      delta: actFct26 - bgt26,
    });

    return [
      mk('total', 'Total', 0, totalBgt, totalAct),
      mk('net_rev', 'Net Revenue (sem Venda Prédio)', 1, revLocBgt, revLocAct),
      mk('rev_loc', 'Receita c/ Locações', 2, revLocBgt, revLocAct),
      mk('rentals', 'Rentals (sem Comodato)', 1, rentalsBgt, rentalsAct),
      mk('aluguel', excludeTechnicalStations ? 'Aluguel (Sem Est. Técnica)' : 'Aluguel (Adm + Téc + Demais)', 2, aluguelBgt, aluguelAct),
      mk('ifrs16', 'IFRS16', 2, ifrsBgt, ifrsAct),
      mk('iptu', 'IPTU / Taxas', 2, iptuBgt, iptuAct),
      mk('facilities', 'Facilities (sem Comodato)', 1, facBgt, facAct),
      mk('fac_opex', 'Manutenção & Limpeza Opex', 2, facBgt, facAct),
      mk('utilities', 'Água, Esgoto e Gás (sem Comodato)', 1, utilBgt, utilAct),
      mk('util_opex', 'Custo Mensal Opex', 2, utilBgt, utilAct),
      mk('pdd', 'PDD projetada', 1, pddBgt, pddAct),
      mk('ex_br', 'Ex Brasil (Latam)', 1, exBrBgt, exBrAct),
      mk('overhead', 'Overhead (Consultoria + BPO + Outros)', 1, ovhBgt, ovhAct),
    ];
  };

  const plAnaliseTable = buildAnaliseTable(false);
  const gerencialAnaliseTable = buildAnaliseTable(true);

  // Passo 4: Quadro comparativo RE Bgt vs RE Act + Fct (igual canto direito da aba Analise)
  const calcPeriodSplit = (excludeTech: boolean) => {
    const ids = [
      'rev_locacoes',
      'rev_outras',
      'rentals_adm',
      'rentals_demais',
      ...(excludeTech ? [] : ['rentals_tec', 'pdd_projetada']),
      'rentals_ifrs16',
      'rentals_iptu',
      'fac_manutencao',
      'fac_limpeza',
      'util_agua',
      'ex_brasil',
      'ovh_consultoria',
      'ovh_bpo',
      'ovh_others',
    ];

    let bgtActPeriod = 0;
    let bgtFctPeriod = 0;
    let realActPeriod = 0;
    let realFctPeriod = 0;

    for (const id of ids) {
      const r = rowMap.get(id);
      if (!r) continue;
      for (let i = 0; i < 12; i++) {
        if (i < cutoff) {
          bgtActPeriod += r.bgt[i];
          realActPeriod += r.actFct[i];
        } else {
          bgtFctPeriod += r.bgt[i];
          realFctPeriod += r.actFct[i];
        }
      }
    }

    const bgtTotal = bgtActPeriod + bgtFctPeriod;
    const realTotal = realActPeriod + realFctPeriod;
    const pctVsBgt = bgtTotal !== 0 ? ((realTotal - bgtTotal) / Math.abs(bgtTotal)) * 100 : 0;

    return {
      bgtActPeriod,
      bgtFctPeriod,
      bgtTotal,
      realActPeriod,
      realFctPeriod,
      realTotal,
      pctVsBgt,
    };
  };

  const data = {
    actCutoffMonth: cutoff,
    includeOverheadCc,
    months: Array.from({ length: 12 }, (_, idx) => `2026/${String(idx + 1).padStart(2, '0')}`),
    analise: {
      visaoPl: plAnaliseTable,
      visaoGerencial: gerencialAnaliseTable,
      chartSummaryPl: calcPeriodSplit(false),
      chartSummaryGerencial: calcPeriodSplit(true),
    },
    basePl: basePlRows,
  };

  if (excelModelCache.size >= CACHE_MAX) {
    const firstKey = excelModelCache.keys().next().value;
    if (firstKey) excelModelCache.delete(firstKey);
  }
  excelModelCache.set(cacheKey, { expiresAt: now + 5 * 60 * 1000, data });
  return data;
}

export async function exportRealEstateExcelModelBuffer(
  bigquery: BigQuery,
  options: { actCutoffMonth?: number; includeOverheadCc?: boolean; excelSign?: boolean } = {}
): Promise<{ buffer: Buffer }> {
  const model = await getRealEstateExcelModelData(bigquery, options);
  const signMult = options.excelSign === false ? 1 : -1;

  const round2 = (v: number) => Math.round((v * signMult) * 100) / 100;

  const flatRows = model.basePl.map((row) => {
    const obj: Record<string, unknown> = {
      LINHA_PL: `${'  '.repeat(row.level)}${row.label}`,
      NIVEL: row.level,
    };
    model.months.forEach((m, i) => {
      obj[`BGT_${m}`] = round2(row.bgt[i]);
    });
    obj.BGT_FY2026 = round2(row.bgtFy);
    model.months.forEach((m, i) => {
      obj[`FCT84_${m}`] = round2(row.fct[i]);
    });
    obj.FCT84_FY2026 = round2(row.fctFy);
    model.months.forEach((m, i) => {
      const prefix = i < model.actCutoffMonth ? 'ACT' : 'FCT';
      obj[`${prefix}_${m}`] = round2(row.actFct[i]);
    });
    obj.ACT_FCT_FY2026 = round2(row.actFctFy);
    obj.YTD_ACT26_vs_ACT25 = round2(row.ytd.act26VsAct25);
    obj.YTD_ACT26_vs_BGT26 = round2(row.ytd.act26VsBgt26);
    obj.YTD_ACT26_vs_FCT26 = round2(row.ytd.act26VsFct26);
    obj.FY_ACT26_vs_ACT25 = round2(row.fy.act26VsAct25);
    obj.FY_ACT26_vs_BGT26 = round2(row.fy.act26VsBgt26);
    obj.FY_ACT26_vs_FCT26 = round2(row.fy.act26VsFct26);
    return obj;
  });

  const buffer = await buildFastXlsxBuffer(flatRows, 'Real_Estate_Base_PL');
  return { buffer };
}
