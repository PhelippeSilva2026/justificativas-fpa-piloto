import { BigQuery } from '@google-cloud/bigquery';
import { buildFastXlsxBuffer, queryBigQueryFast } from './excelExport';
import { fixMojibake } from './energyAnalytics';

const DRE_FINAL_TABLE = '`vtal-fpea-prd.419556.DRE_FINAL`';

export interface LegalFilterParams {
  classificacao?: string;
  diretoria?: string;
  gerencia?: string;
  descricao?: string;
  pais?: string;
  centroCusto?: string;
  fornecedor?: string;
  contaRazao?: string;
  pedidoCompra?: string;
  atribuicao?: string;
  anomes?: string;
  search?: string;
  ledgerTipo?: string;
}

// Expressões baseadas diretamente nas novas colunas de Legal no GCP (vtal-fpea-prd.419556.DRE_FINAL)
const DIRETORIA_EXPR = `COALESCE(NULLIF(TRIM(LEGAL_DIRETORIA), ''), 'Sem Diretoria')`;
const GERENCIA_EXPR = `COALESCE(NULLIF(TRIM(LEGAL_GERENCIA), ''), 'Sem Gerência')`;
const DESCRICAO_EXPR = `COALESCE(NULLIF(TRIM(LEGAL_DESCRICAO), ''), 'Sem Descrição')`;
const PAIS_EXPR = `COALESCE(NULLIF(TRIM(LEGAL_PAIS), ''), 'Sem País')`;
const CC_DESC_EXPR = `COALESCE(NULLIF(TRIM(LEGAL_DESCRICAO), ''), NULLIF(TRIM(DENOMINACAO_CENTRO_DE_CUSTO), ''), NULLIF(TRIM(centro_custo), ''), 'Sem Centro de Custo')`;
const CC_STATUS_EXPR = `
  CASE
    WHEN UPPER(TRIM(COALESCE(LEGAL_DIRETORIA, ''))) = 'INATIVO'
      OR UPPER(TRIM(COALESCE(LEGAL_GERENCIA, ''))) = 'INATIVO'
    THEN 'Inativo'
    ELSE 'Ativo'
  END
`;

const PO_OR_CONTRACT_EXPR = `
  COALESCE(
    NULLIF(TRIM(documento_de_compras), ''),
    NULLIF(TRIM(CONTRATO_RE), ''),
    'Sem Pedido/Contrato'
  )
`;

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

function buildLegalWhereClause(
  filters: LegalFilterParams,
  options: { includeScenarioFilter?: boolean; skipAnomes?: boolean } = {}
): {
  whereSql: string;
  params: Record<string, unknown>;
} {
  // Esta página mostra exclusivamente registros onde AREA = 'Legal'
  const conditions: string[] = ["UPPER(TRIM(AREA)) = 'LEGAL'"];
  const params: Record<string, unknown> = {};

  if (options.includeScenarioFilter && filters.ledgerTipo && filters.ledgerTipo !== 'ALL') {
    conditions.push('UPPER(TRIM(TIPO)) = UPPER(@ledgerTipo)');
    params.ledgerTipo = filters.ledgerTipo.trim();
  } else {
    conditions.push(
      "UPPER(TRIM(TIPO)) IN ('BUDGET 2026', 'ACTUAL 2026', 'FCST 8+4', 'FCST 4+8')"
    );
  }

  if (!options.skipAnomes && filters.anomes && filters.anomes !== 'ALL') {
    conditions.push('TRIM(anomes) = @anomes');
    params.anomes = filters.anomes.trim();
  }

  if (filters.classificacao && filters.classificacao !== 'ALL') {
    if (filters.classificacao === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(CLASSIFICACAO_FPA), '') IS NULL");
    } else {
      conditions.push('TRIM(CLASSIFICACAO_FPA) = @classificacao');
      params.classificacao = filters.classificacao.trim();
    }
  }

  if (filters.diretoria && filters.diretoria !== 'ALL') {
    if (filters.diretoria === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(LEGAL_DIRETORIA), '') IS NULL");
    } else {
      conditions.push('TRIM(LEGAL_DIRETORIA) = @diretoria');
      params.diretoria = filters.diretoria.trim();
    }
  }

  if (filters.gerencia && filters.gerencia !== 'ALL') {
    if (filters.gerencia === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(LEGAL_GERENCIA), '') IS NULL");
    } else {
      conditions.push('TRIM(LEGAL_GERENCIA) = @gerencia');
      params.gerencia = filters.gerencia.trim();
    }
  }

  if (filters.descricao && filters.descricao !== 'ALL') {
    if (filters.descricao === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(LEGAL_DESCRICAO), '') IS NULL");
    } else {
      conditions.push('TRIM(LEGAL_DESCRICAO) = @descricao');
      params.descricao = filters.descricao.trim();
    }
  }

  if (filters.pais && filters.pais !== 'ALL') {
    if (filters.pais === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(LEGAL_PAIS), '') IS NULL");
    } else {
      conditions.push('TRIM(LEGAL_PAIS) = @pais');
      params.pais = filters.pais.trim();
    }
  }

  if (filters.centroCusto && filters.centroCusto !== 'ALL') {
    if (filters.centroCusto === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(centro_custo), '') IS NULL");
    } else {
      conditions.push('UPPER(TRIM(centro_custo)) = @centroCusto');
      params.centroCusto = filters.centroCusto.trim().toUpperCase();
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

  if (filters.contaRazao && filters.contaRazao !== 'ALL') {
    conditions.push(
      "COALESCE(NULLIF(TRIM(conta_do_razao), ''), COALESCE(NULLIF(TRIM(CONTA), ''), 'Sem Conta')) = @contaRazao"
    );
    params.contaRazao = filters.contaRazao.trim();
  }

  if (filters.pedidoCompra && filters.pedidoCompra !== 'ALL') {
    conditions.push(`(${PO_OR_CONTRACT_EXPR}) = @pedidoCompra`);
    params.pedidoCompra = filters.pedidoCompra.trim();
  }

  if (filters.atribuicao && filters.atribuicao !== 'ALL') {
    if (filters.atribuicao === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(atribuicao), '') IS NULL");
    } else {
      conditions.push('TRIM(atribuicao) = @atribuicao');
      params.atribuicao = filters.atribuicao.trim();
    }
  }

  if (filters.search && filters.search.trim()) {
    conditions.push(`(
      LOWER(COALESCE(texto, '')) LIKE @searchLike
      OR LOWER(COALESCE(atribuicao, '')) LIKE @searchLike
      OR LOWER(COALESCE(documento_de_compras, '')) LIKE @searchLike
      OR LOWER(COALESCE(CONTRATO_RE, '')) LIKE @searchLike
      OR LOWER(COALESCE(nome_fornecedor, '')) LIKE @searchLike
      OR LOWER(COALESCE(conta_do_razao, '')) LIKE @searchLike
      OR LOWER(COALESCE(CONTA_CONTABIL_DESCRICAO, '')) LIKE @searchLike
      OR LOWER(COALESCE(CLASSIFICACAO_FPA, '')) LIKE @searchLike
      OR LOWER(COALESCE(centro_custo, '')) LIKE @searchLike
      OR LOWER(COALESCE(LEGAL_DIRETORIA, '')) LIKE @searchLike
      OR LOWER(COALESCE(LEGAL_GERENCIA, '')) LIKE @searchLike
      OR LOWER(COALESCE(LEGAL_DESCRICAO, '')) LIKE @searchLike
      OR LOWER(COALESCE(LEGAL_PAIS, '')) LIKE @searchLike
      OR LOWER(COALESCE(n_documento, '')) LIKE @searchLike
    )`);
    params.searchLike = `%${filters.search.trim().toLowerCase()}%`;
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

let filtersCache: { expiresAt: number; data: unknown } | null = null;
const dashboardCache = new Map<string, { expiresAt: number; data: unknown }>();
const CACHE_MAX = 30;

export async function getLegalFilterOptions(bigquery: BigQuery) {
  const now = Date.now();
  if (filtersCache && filtersCache.expiresAt > now) {
    return filtersCache.data;
  }

  const baseWhere =
    "UPPER(TRIM(AREA)) = 'LEGAL' AND UPPER(TRIM(TIPO)) IN ('BUDGET 2026', 'ACTUAL 2026', 'FCST 8+4', 'FCST 4+8')";

  const [
    classifRows,
    diretoriaRows,
    gerenciaRows,
    descricaoRows,
    paisRows,
    ccRows,
    supplierRows,
    accountRows,
    poRows,
    monthRows,
  ] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), 'Sem Classificação') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(LEGAL_DIRETORIA), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(LEGAL_DIRETORIA), ''), 'Sem Diretoria') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(LEGAL_GERENCIA), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(LEGAL_GERENCIA), ''), 'Sem Gerência') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(LEGAL_DESCRICAO), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(LEGAL_DESCRICAO), ''), 'Sem Descrição') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(LEGAL_PAIS), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(LEGAL_PAIS), ''), 'Sem País') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(UPPER(TRIM(centro_custo)), ''), '__EMPTY__') AS value,
              (${CC_DESC_EXPR}) AS cc_desc,
              (${DIRETORIA_EXPR}) AS diretoria,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2, 3
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(nome_fornecedor), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(nome_fornecedor), ''), 'Sem Fornecedor') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 300`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(conta_do_razao), ''), COALESCE(NULLIF(TRIM(CONTA), ''), 'Sem Conta')) AS value,
              ANY_VALUE(COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), ''))) AS desc_conta,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT (${PO_OR_CONTRACT_EXPR}) AS value,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere}
         AND (NULLIF(TRIM(documento_de_compras), '') IS NOT NULL OR NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL)
       GROUP BY 1
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 250`
    ),
    runBqQuery(
      bigquery,
      `SELECT TRIM(anomes) AS value, COUNT(*) AS rows_count
       FROM ${DRE_FINAL_TABLE}
       WHERE ${baseWhere} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1
       ORDER BY CAST(SPLIT(value, '/')[OFFSET(0)] AS INT64), CAST(SPLIT(value, '/')[OFFSET(1)] AS INT64)`
    ),
  ]);

  const mapSimpleOpt = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
      actTotal: numVal(r.act_total),
    }));

  const data = {
    classifications: mapSimpleOpt(classifRows),
    diretorias: mapSimpleOpt(diretoriaRows),
    gerencias: mapSimpleOpt(gerenciaRows),
    descricoes: mapSimpleOpt(descricaoRows),
    paises: mapSimpleOpt(paisRows),
    costCenters: ccRows.map((r) => {
      const code = String(r.value) === '__EMPTY__' ? 'Sem CC' : String(r.value);
      const desc = fixMojibake(r.cc_desc);
      return {
        value: String(r.value),
        label: desc && code !== 'Sem CC' ? `${code} · ${desc}` : desc,
        rows: intVal(r.rows_count),
        actTotal: numVal(r.act_total),
      };
    }),
    suppliers: mapSimpleOpt(supplierRows),
    accounts: accountRows.map((r) => {
      const code = String(r.value);
      const desc = fixMojibake(r.desc_conta);
      return {
        value: code,
        label: desc ? `${code} · ${desc}` : code,
        rows: intVal(r.rows_count),
        actTotal: numVal(r.act_total),
      };
    }),
    purchaseOrders: poRows.map((r) => ({
      value: fixMojibake(r.value),
      label: fixMojibake(r.value),
      rows: intVal(r.rows_count),
      actTotal: numVal(r.act_total),
    })),
    months: monthRows.map((r) => String(r.value)),
  };

  filtersCache = { expiresAt: now + 10 * 60 * 1000, data };
  return data;
}

const MONTH_EXPR = "SAFE_CAST(SPLIT(TRIM(anomes), '/')[SAFE_OFFSET(1)] AS INT64)";

export async function getLegalDashboardData(bigquery: BigQuery, filters: LegalFilterParams) {
  const cacheKey = JSON.stringify(filters);
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { whereSql, params } = buildLegalWhereClause(filters);
  const { whereSql: whereNoMonthSql, params: paramsNoMonth } = buildLegalWhereClause(filters, {
    skipAnomes: true,
  });

  const [maxActRow] = await runBqQuery(
    bigquery,
    `SELECT COALESCE(MAX(${MONTH_EXPR}), 11) AS max_act_month
     FROM ${DRE_FINAL_TABLE}
     WHERE UPPER(TRIM(AREA)) = 'LEGAL' AND UPPER(TRIM(TIPO)) = 'ACTUAL 2026'`
  );
  const maxActMonth = Math.min(12, Math.max(1, intVal(maxActRow?.max_act_month || 11)));

  let refMonth = maxActMonth;
  if (filters.anomes && filters.anomes !== 'ALL') {
    const parsedMonth = Number(filters.anomes.split('/')[1]);
    if (Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
      refMonth = Math.trunc(parsedMonth);
    }
  }

  // Em Legal, o OPEX é apresentado com sinal positivo (-1 * valor DRE)
  const scenarioCols = `
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_fy,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_total,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_total,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct48_total
  `;

  const scenarioColsWithYtd = `
    ${scenarioCols},
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_ytd
  `;

  const [
    summaryRows,
    dirGerRows,
    gerDescRows,
    descClassifRows,
    classifAccountRows,
    bySupplierRows,
    byPoRows,
    byTextAtribRows,
  ] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT
         COUNT(*) AS total_rows,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         ${scenarioColsWithYtd},
         COUNT(DISTINCT NULLIF(UPPER(TRIM(centro_custo)), '')) AS distinct_ccs,
         COUNT(DISTINCT NULLIF(TRIM(LEGAL_DIRETORIA), '')) AS distinct_diretorias,
         COUNT(DISTINCT NULLIF(TRIM(LEGAL_GERENCIA), '')) AS distinct_gerencias,
         COUNT(DISTINCT NULLIF(TRIM(LEGAL_DESCRICAO), '')) AS distinct_descricoes,
         COUNT(DISTINCT NULLIF(TRIM(LEGAL_PAIS), '')) AS distinct_paises,
         COUNT(DISTINCT NULLIF(TRIM(nome_fornecedor), '')) AS distinct_suppliers,
         COUNT(DISTINCT NULLIF(TRIM(documento_de_compras), '')) AS distinct_pos,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS distinct_contracts,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND NULLIF(TRIM(documento_de_compras), '') IS NOT NULL) AS act_rows_with_po,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND NULLIF(TRIM(atribuicao), '') IS NOT NULL) AS act_rows_with_atrib
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}`,
      params
    ),
    // Diretoria -> Gerência (usa whereNoMonthSql para manter Mês e YTD lado a lado coerentes!)
    runBqQuery(
      bigquery,
      `SELECT
         (${DIRETORIA_EXPR}) AS diretoria,
         (${GERENCIA_EXPR}) AS gerencia,
         COUNT(DISTINCT NULLIF(UPPER(TRIM(centro_custo)), '')) AS ccs_count,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         ${scenarioColsWithYtd}
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoMonthSql}
       GROUP BY 1, 2
       ORDER BY ABS(bgt_ytd) + ABS(act_ytd) DESC`,
      paramsNoMonth
    ),
    // Gerência -> Descrição
    runBqQuery(
      bigquery,
      `SELECT
         (${GERENCIA_EXPR}) AS gerencia,
         ANY_VALUE((${DIRETORIA_EXPR})) AS diretoria,
         (${DESCRICAO_EXPR}) AS descricao,
         COUNT(DISTINCT NULLIF(UPPER(TRIM(centro_custo)), '')) AS ccs_count,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         ${scenarioColsWithYtd}
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoMonthSql}
       GROUP BY 1, 3
       ORDER BY ABS(bgt_ytd) + ABS(act_ytd) DESC`,
      paramsNoMonth
    ),
    // Descrição -> Classificação FP&A
    runBqQuery(
      bigquery,
      `SELECT
         (${DESCRICAO_EXPR}) AS descricao,
         ANY_VALUE((${DIRETORIA_EXPR})) AS diretoria,
         ANY_VALUE((${GERENCIA_EXPR})) AS gerencia,
         COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), 'Sem Classificação') AS classificacao,
         COUNT(DISTINCT NULLIF(UPPER(TRIM(centro_custo)), '')) AS ccs_count,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         ${scenarioColsWithYtd}
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoMonthSql}
       GROUP BY 1, 4
       ORDER BY ABS(bgt_ytd) + ABS(act_ytd) DESC`,
      paramsNoMonth
    ),
    // Classificação FP&A consolidada (o drill abre justificativas do mês e visão YTD)
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), 'Sem Classificação') AS classificacao,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         ${scenarioColsWithYtd}
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereNoMonthSql}
       GROUP BY 1
       ORDER BY ABS(bgt_ytd) + ABS(act_ytd) DESC`,
      paramsNoMonth
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(nome_fornecedor), ''), 'Sem Fornecedor') AS fornecedor,
         COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows,
         COUNT(DISTINCT NULLIF(TRIM(documento_de_compras), '')) AS pos_count,
         COUNT(DISTINCT NULLIF(TRIM(CONTRATO_RE), '')) AS contracts_count,
         COUNT(DISTINCT NULLIF(TRIM(conta_do_razao), '')) AS accounts_count,
         ANY_VALUE((${GERENCIA_EXPR})) AS main_gerencia,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct48_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
       GROUP BY 1
       ORDER BY ABS(act_total) + ABS(fct84_total) DESC
       LIMIT 60`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         (${PO_OR_CONTRACT_EXPR}) AS po_or_contract,
         CASE
           WHEN NULLIF(TRIM(documento_de_compras), '') IS NOT NULL THEN 'Pedido de Compra'
           ELSE 'Contrato RE'
         END AS doc_kind,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor,
         ANY_VALUE((${CC_DESC_EXPR})) AS cc_desc,
         ANY_VALUE((${GERENCIA_EXPR})) AS gerencia,
         ANY_VALUE(NULLIF(TRIM(atribuicao), '')) AS atribuicao,
         ANY_VALUE(NULLIF(TRIM(texto), '')) AS texto,
         COUNT(*) AS rows_count,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_total,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql}
         AND (NULLIF(TRIM(documento_de_compras), '') IS NOT NULL OR NULLIF(TRIM(CONTRATO_RE), '') IS NOT NULL)
       GROUP BY 1, 2
       ORDER BY ABS(act_total) + ABS(fct84_total) DESC
       LIMIT 80`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(atribuicao), ''), 'Sem Atribuição') AS atribuicao,
         COALESCE(NULLIF(TRIM(texto), ''), 'Sem Texto') AS texto,
         ANY_VALUE(COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), ''))) AS conta_desc,
         ANY_VALUE(NULLIF(TRIM(nome_fornecedor), '')) AS fornecedor,
         ANY_VALUE((${CC_DESC_EXPR})) AS cc_desc,
         COUNT(*) AS rows_count,
         COALESCE(SUM((-COALESCE(valor, 0))), 0) AS act_total
       FROM ${DRE_FINAL_TABLE}
       WHERE ${whereSql} AND UPPER(TRIM(TIPO)) = 'ACTUAL 2026'
       GROUP BY 1, 2
       ORDER BY ABS(SUM(valor)) DESC
       LIMIT 80`,
      params
    ),
  ]);

  const mapScenarioMetrics = (r: Record<string, unknown>, useYtdForAct = true) => {
    const rowBgtMonth = numVal(r.bgt_month);
    const rowActMonth = numVal(r.act_month);
    const rowFct84Month = numVal(r.fct84_month);
    const rowBgtFy = numVal(r.bgt_fy);
    const rowBgtYtd = numVal(r.bgt_ytd);
    const rowAct = useYtdForAct ? numVal(r.act_ytd) : numVal(r.act_total);
    const rowFct84 = numVal(r.fct84_total);
    const rowFct84Ytd = numVal(r.fct84_ytd);
    const rowFct48 = numVal(r.fct48_total);
    return {
      bgtMonth: rowBgtMonth,
      actMonth: rowActMonth,
      disponivelMonth: rowBgtMonth - rowActMonth,
      fct84Month: rowFct84Month,
      bgtFy: rowBgtFy,
      bgtYtd: rowBgtYtd,
      actTotal: rowAct,
      disponivelFy: rowBgtFy - rowAct,
      disponivelYtd: rowBgtYtd - rowAct,
      fct84Total: rowFct84,
      fct84Ytd: rowFct84Ytd,
      fct48Total: rowFct48,
    };
  };

  type MetricsObj = ReturnType<typeof mapScenarioMetrics>;
  const emptyMetrics = (): MetricsObj => ({
    bgtMonth: 0,
    actMonth: 0,
    disponivelMonth: 0,
    fct84Month: 0,
    bgtFy: 0,
    bgtYtd: 0,
    actTotal: 0,
    disponivelFy: 0,
    disponivelYtd: 0,
    fct84Total: 0,
    fct84Ytd: 0,
    fct48Total: 0,
  });

  const addMetrics = (target: MetricsObj, src: MetricsObj) => {
    target.bgtMonth += src.bgtMonth;
    target.actMonth += src.actMonth;
    target.disponivelMonth += src.disponivelMonth;
    target.fct84Month += src.fct84Month;
    target.bgtFy += src.bgtFy;
    target.bgtYtd += src.bgtYtd;
    target.actTotal += src.actTotal;
    target.disponivelFy += src.disponivelFy;
    target.disponivelYtd += src.disponivelYtd;
    target.fct84Total += src.fct84Total;
    target.fct84Ytd += src.fct84Ytd;
    target.fct48Total += src.fct48Total;
  };

  // 1. Diretoria -> Gerência
  const dirMap = new Map<
    string,
    {
      diretoria: string;
      ccsCount: number;
      actRows: number;
      metrics: MetricsObj;
      children: Array<{
        key: string;
        label: string;
        filterKey: 'gerencia';
        filterValue: string;
        ccsCount: number;
        actRows: number;
      } & MetricsObj>;
    }
  >();

  for (const r of dirGerRows) {
    const dir = fixMojibake(r.diretoria) || 'Sem Diretoria';
    const ger = fixMojibake(r.gerencia) || 'Sem Gerência';
    const m = mapScenarioMetrics(r, true);
    let entry = dirMap.get(dir);
    if (!entry) {
      entry = { diretoria: dir, ccsCount: 0, actRows: 0, metrics: emptyMetrics(), children: [] };
      dirMap.set(dir, entry);
    }
    entry.ccsCount += intVal(r.ccs_count);
    entry.actRows += intVal(r.act_rows);
    addMetrics(entry.metrics, m);
    entry.children.push({
      key: `${dir}::${ger}`,
      label: ger,
      filterKey: 'gerencia',
      filterValue: ger === 'Sem Gerência' ? '__EMPTY__' : ger,
      ccsCount: intVal(r.ccs_count),
      actRows: intVal(r.act_rows),
      ...m,
    });
  }

  const byDiretoria = Array.from(dirMap.values())
    .map((d) => ({
      diretoria: d.diretoria,
      ccsCount: d.ccsCount,
      actRows: d.actRows,
      ...d.metrics,
      children: d.children.sort(
        (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
      ),
    }))
    .sort(
      (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
    );

  // 2. Gerência -> Descrição
  const gerMap = new Map<
    string,
    {
      gerencia: string;
      diretoria: string;
      ccsCount: number;
      actRows: number;
      metrics: MetricsObj;
      children: Array<{
        key: string;
        label: string;
        filterKey: 'descricao';
        filterValue: string;
        ccsCount: number;
        actRows: number;
      } & MetricsObj>;
    }
  >();

  for (const r of gerDescRows) {
    const ger = fixMojibake(r.gerencia) || 'Sem Gerência';
    const dir = fixMojibake(r.diretoria) || 'Sem Diretoria';
    const desc = fixMojibake(r.descricao) || 'Sem Descrição';
    const m = mapScenarioMetrics(r, true);
    let entry = gerMap.get(ger);
    if (!entry) {
      entry = {
        gerencia: ger,
        diretoria: dir,
        ccsCount: 0,
        actRows: 0,
        metrics: emptyMetrics(),
        children: [],
      };
      gerMap.set(ger, entry);
    }
    entry.ccsCount += intVal(r.ccs_count);
    entry.actRows += intVal(r.act_rows);
    addMetrics(entry.metrics, m);
    entry.children.push({
      key: `${ger}::${desc}`,
      label: desc,
      filterKey: 'descricao',
      filterValue: desc === 'Sem Descrição' ? '__EMPTY__' : desc,
      ccsCount: intVal(r.ccs_count),
      actRows: intVal(r.act_rows),
      ...m,
    });
  }

  const byGerencia = Array.from(gerMap.values())
    .map((g) => ({
      gerencia: g.gerencia,
      diretoria: g.diretoria,
      ccsCount: g.ccsCount,
      actRows: g.actRows,
      ...g.metrics,
      children: g.children.sort(
        (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
      ),
    }))
    .sort(
      (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
    );

  // 3. Descrição -> Classificação FP&A
  const descMap = new Map<
    string,
    {
      descricao: string;
      diretoria: string;
      gerencia: string;
      ccsCount: number;
      actRows: number;
      metrics: MetricsObj;
      children: Array<{
        key: string;
        label: string;
        filterKey: 'classificacao';
        filterValue: string;
        ccsCount: number;
        actRows: number;
      } & MetricsObj>;
    }
  >();

  for (const r of descClassifRows) {
    const desc = fixMojibake(r.descricao) || 'Sem Descrição';
    const dir = fixMojibake(r.diretoria) || 'Sem Diretoria';
    const ger = fixMojibake(r.gerencia) || 'Sem Gerência';
    const classif = fixMojibake(r.classificacao) || 'Sem Classificação';
    const m = mapScenarioMetrics(r, true);
    let entry = descMap.get(desc);
    if (!entry) {
      entry = {
        descricao: desc,
        diretoria: dir,
        gerencia: ger,
        ccsCount: 0,
        actRows: 0,
        metrics: emptyMetrics(),
        children: [],
      };
      descMap.set(desc, entry);
    }
    entry.ccsCount += intVal(r.ccs_count);
    entry.actRows += intVal(r.act_rows);
    addMetrics(entry.metrics, m);
    entry.children.push({
      key: `${desc}::${classif}`,
      label: classif,
      filterKey: 'classificacao',
      filterValue: classif === 'Sem Classificação' ? '__EMPTY__' : classif,
      ccsCount: intVal(r.ccs_count),
      actRows: intVal(r.act_rows),
      ...m,
    });
  }

  const byDescricao = Array.from(descMap.values())
    .map((d) => ({
      descricao: d.descricao,
      diretoria: d.diretoria,
      gerencia: d.gerencia,
      ccsCount: d.ccsCount,
      actRows: d.actRows,
      ...d.metrics,
      children: d.children.sort(
        (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
      ),
    }))
    .sort(
      (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
    );

  // 4. Classificação FP&A (sem drill de contas — drill exibe justificativas do mês e YTD)
  const byClassification = classifAccountRows
    .map((r) => {
      const classificacao = fixMojibake(r.classificacao) || 'Sem Classificação';
      const m = mapScenarioMetrics(r, true);
      return {
        classificacao,
        actRows: intVal(r.act_rows),
        ...m,
        children: [],
      };
    })
    .sort(
      (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actTotal) - (Math.abs(a.bgtYtd) + Math.abs(a.actTotal))
    );

  const s = summaryRows[0] || {};
  const summaryMetrics = mapScenarioMetrics(s, false);

  const data = {
    maxActMonth,
    refMonth,
    summary: {
      totalRows: intVal(s.total_rows),
      actRows: intVal(s.act_rows),
      ...summaryMetrics,
      distinctCcs: intVal(s.distinct_ccs),
      distinctDiretorias: intVal(s.distinct_diretorias),
      distinctGerencias: intVal(s.distinct_gerencias),
      distinctDescricoes: intVal(s.distinct_descricoes),
      distinctPaises: intVal(s.distinct_paises),
      distinctSuppliers: intVal(s.distinct_suppliers),
      distinctPos: intVal(s.distinct_pos),
      distinctContracts: intVal(s.distinct_contracts),
      actRowsWithPo: intVal(s.act_rows_with_po),
      actRowsWithAtrib: intVal(s.act_rows_with_atrib),
    },
    byDiretoria,
    byGerencia,
    byDescricao,
    byClassification,
    bySupplier: bySupplierRows.map((r) => ({
      fornecedor: fixMojibake(r.fornecedor) || 'Sem Fornecedor',
      actRows: intVal(r.act_rows),
      posCount: intVal(r.pos_count),
      contractsCount: intVal(r.contracts_count),
      accountsCount: intVal(r.accounts_count),
      mainGerencia: fixMojibake(r.main_gerencia),
      actTotal: numVal(r.act_total),
      fct84Total: numVal(r.fct84_total),
      fct48Total: numVal(r.fct48_total),
    })),
    byPurchaseOrder: byPoRows.map((r) => ({
      poOrContract: fixMojibake(r.po_or_contract),
      docKind: String(r.doc_kind || 'Pedido de Compra'),
      fornecedor: fixMojibake(r.fornecedor) || '—',
      ccDesc: fixMojibake(r.cc_desc),
      gerencia: fixMojibake(r.gerencia),
      atribuicao: fixMojibake(r.atribuicao),
      texto: fixMojibake(r.texto),
      rows: intVal(r.rows_count),
      actTotal: numVal(r.act_total),
      fct84Total: numVal(r.fct84_total),
    })),
    byTextAtribuicao: byTextAtribRows.map((r) => ({
      atribuicao: fixMojibake(r.atribuicao),
      texto: fixMojibake(r.texto),
      contaDesc: fixMojibake(r.conta_desc),
      fornecedor: fixMojibake(r.fornecedor) || '—',
      ccDesc: fixMojibake(r.cc_desc),
      rows: intVal(r.rows_count),
      actTotal: numVal(r.act_total),
    })),
  };

  if (dashboardCache.size >= CACHE_MAX) {
    const firstKey = dashboardCache.keys().next().value;
    if (firstKey) dashboardCache.delete(firstKey);
  }
  dashboardCache.set(cacheKey, { expiresAt: now + 5 * 60 * 1000, data });
  return data;
}

export async function getLegalLedgerPage(
  bigquery: BigQuery,
  filters: LegalFilterParams,
  options: { page?: number; pageSize?: number; sortBy?: string }
) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize || 50));
  const offset = (page - 1) * pageSize;

  let orderBySql = 'ABS(valor) DESC, anomes DESC';
  if (options.sortBy === 'valor_asc') orderBySql = 'valor DESC, anomes DESC';
  else if (options.sortBy === 'valor_desc') orderBySql = 'valor ASC, anomes DESC';
  else if (options.sortBy === 'recent') {
    orderBySql =
      "CAST(SPLIT(anomes, '/')[OFFSET(0)] AS INT64) DESC, CAST(SPLIT(anomes, '/')[OFFSET(1)] AS INT64) DESC, ABS(valor) DESC";
  }

  const { whereSql, params } = buildLegalWhereClause(filters, { includeScenarioFilter: true });

  const [countRows, rows] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT COUNT(*) AS total_count FROM ${DRE_FINAL_TABLE} WHERE ${whereSql}`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         TRIM(TIPO) AS tipo,
         TRIM(anomes) AS anomes,
         data_de_lancamento,
         n_documento,
         centro_custo,
         (${CC_DESC_EXPR}) AS cc_desc,
         (${DIRETORIA_EXPR}) AS diretoria,
         (${GERENCIA_EXPR}) AS gerencia,
         (${PAIS_EXPR}) AS pais,
         (${CC_STATUS_EXPR}) AS status_cc,
         CLASSIFICACAO_FPA,
         COALESCE(NULLIF(TRIM(conta_do_razao), ''), NULLIF(TRIM(CONTA), '')) AS conta_razao,
         COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), '')) AS conta_desc,
         nome_fornecedor,
         documento_de_compras,
         documento_de_compras_item,
         CONTRATO_RE,
         atribuicao,
         texto,
         (-COALESCE(valor, 0)) AS valor
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
      tipo: String(r.tipo || ''),
      anomes: String(r.anomes || ''),
      dataLancamento: unwrapDate(r.data_de_lancamento),
      documento: fixMojibake(r.n_documento),
      cc: fixMojibake(r.centro_custo),
      ccDesc: fixMojibake(r.cc_desc),
      diretoria: fixMojibake(r.diretoria),
      gerencia: fixMojibake(r.gerencia),
      pais: fixMojibake(r.pais),
      statusCc: String(r.status_cc || 'Ativo'),
      classificacao: fixMojibake(r.CLASSIFICACAO_FPA),
      contaRazao: fixMojibake(r.conta_razao),
      contaDesc: fixMojibake(r.conta_desc),
      fornecedor: fixMojibake(r.nome_fornecedor),
      pedidoCompra: fixMojibake(r.documento_de_compras),
      pedidoItem: fixMojibake(r.documento_de_compras_item),
      contratoRe: fixMojibake(r.CONTRATO_RE),
      atribuicao: fixMojibake(r.atribuicao),
      texto: fixMojibake(r.texto),
      valor: numVal(r.valor),
    })),
  };
}

export async function exportLegalExcelBuffer(
  bigquery: BigQuery,
  filters: LegalFilterParams
): Promise<{ buffer: Buffer; rowCount: number }> {
  const { whereSql, params } = buildLegalWhereClause(filters, { includeScenarioFilter: true });

  const sql = `
    SELECT
      TRIM(TIPO) AS CENARIO_TIPO,
      TRIM(anomes) AS ANOMES,
      centro_custo AS CCUSTO_S4H,
      (${DESCRICAO_EXPR}) AS LEGAL_DESCRICAO,
      (${DIRETORIA_EXPR}) AS LEGAL_DIRETORIA,
      (${GERENCIA_EXPR}) AS LEGAL_GERENCIA,
      (${PAIS_EXPR}) AS LEGAL_PAIS,
      (${CC_STATUS_EXPR}) AS STATUS_CC,
      CLASSIFICACAO_FPA,
      COALESCE(NULLIF(TRIM(conta_do_razao), ''), NULLIF(TRIM(CONTA), '')) AS CONTA_RAZAO,
      COALESCE(NULLIF(TRIM(CONTA_CONTABIL_DESCRICAO), ''), NULLIF(TRIM(DESCRICAO_CONTA_CONTABIL), '')) AS DESC_CONTA_RAZAO,
      nome_fornecedor AS FORNECEDOR,
      documento_de_compras AS PEDIDO_DE_COMPRA,
      documento_de_compras_item AS ITEM_PEDIDO,
      CONTRATO_RE AS CONTRATO,
      atribuicao AS ATRIBUICAO,
      texto AS TEXTO,
      n_documento AS N_DOCUMENTO,
      data_de_lancamento AS DATA_LANCAMENTO,
      (-COALESCE(valor, 0)) AS VALOR
    FROM ${DRE_FINAL_TABLE}
    WHERE ${whereSql}
    ORDER BY CENARIO_TIPO, ANOMES, ABS(VALOR) DESC
  `;

  const rawRows = await queryBigQueryFast(bigquery, sql, params);
  const cleanedRows = rawRows.map((row) => ({
    ...row,
    LEGAL_DESCRICAO: fixMojibake(row.LEGAL_DESCRICAO),
    LEGAL_DIRETORIA: fixMojibake(row.LEGAL_DIRETORIA),
    LEGAL_GERENCIA: fixMojibake(row.LEGAL_GERENCIA),
    LEGAL_PAIS: fixMojibake(row.LEGAL_PAIS),
    CLASSIFICACAO_FPA: fixMojibake(row.CLASSIFICACAO_FPA),
    DESC_CONTA_RAZAO: fixMojibake(row.DESC_CONTA_RAZAO),
    FORNECEDOR: fixMojibake(row.FORNECEDOR),
    ATRIBUICAO: fixMojibake(row.ATRIBUICAO),
    TEXTO: fixMojibake(row.TEXTO),
  }));

  const rowsForSheet =
    cleanedRows.length > 0
      ? cleanedRows
      : [{ Mensagem: 'Nenhum lançamento encontrado para os filtros selecionados em Legal.' }];

  const buffer = await buildFastXlsxBuffer(rowsForSheet, 'Legal_Detalhado_2026');
  return { buffer, rowCount: cleanedRows.length };
}
