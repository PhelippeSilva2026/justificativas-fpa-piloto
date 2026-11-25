import { BigQuery } from '@google-cloud/bigquery';
import { buildFastXlsxBuffer, queryBigQueryFast } from './excelExport';
import { fixMojibake } from './energyAnalytics';

const DRE_EXEC_TABLE = '`vtal-fpea-prd.419556.DRE_FINAL_EXECUTIVA`';
const BASE_SCOPE_WHERE = `
  TRIM(NIVEL_2) = 'V.tal'
  AND TRIM(NIVEL_1) = '(-) OPEX'
  AND UPPER(TRIM(TIPO)) IN ('BUDGET 2026', 'ACTUAL 2026', 'FCST 10+2 BANCO', 'FCST 8+4', 'FCST 4+8')
`;
const MONTH_EXPR = "SAFE_CAST(SPLIT(TRIM(anomes), '/')[SAFE_OFFSET(1)] AS INT64)";

export interface PlanFinFilterParams {
  anomes?: string;
  pacote?: string;
  subPacote?: string;
}

function numVal(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intVal(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
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

function buildPlanFinWhere(filters: PlanFinFilterParams): {
  whereSql: string;
  params: Record<string, unknown>;
} {
  const conditions = [BASE_SCOPE_WHERE];
  const params: Record<string, unknown> = {};

  if (filters.pacote && filters.pacote !== 'ALL') {
    if (filters.pacote === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(NIVEL_3), '') IS NULL");
    } else {
      conditions.push('TRIM(NIVEL_3) = @pacote');
      params.pacote = filters.pacote.trim();
    }
  }

  if (filters.subPacote && filters.subPacote !== 'ALL') {
    if (filters.subPacote === '__EMPTY__') {
      conditions.push("NULLIF(TRIM(NIVEL_4), '') IS NULL");
    } else {
      conditions.push('TRIM(NIVEL_4) = @subPacote');
      params.subPacote = filters.subPacote.trim();
    }
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

let filtersCache: { expiresAt: number; data: unknown } | null = null;
const dashboardCache = new Map<string, { expiresAt: number; data: unknown }>();
const CACHE_MAX = 30;

export async function getPlanFinFilterOptions(bigquery: BigQuery) {
  const now = Date.now();
  if (filtersCache && filtersCache.expiresAt > now) {
    return filtersCache.data;
  }

  const [monthRows, pacoteRows, subPacoteRows, closedMonthRow] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT TRIM(anomes) AS value,
              ${MONTH_EXPR} AS month_num,
              COUNTIF(UPPER(TRIM(TIPO)) = 'ACTUAL 2026') AS act_rows
       FROM ${DRE_EXEC_TABLE}
       WHERE ${BASE_SCOPE_WHERE} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1, 2
       ORDER BY month_num`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(NIVEL_3), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(NIVEL_3), ''), 'Sem Pacote') AS label,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS bgt_fy
       FROM ${DRE_EXEC_TABLE}
       WHERE ${BASE_SCOPE_WHERE}
       GROUP BY 1, 2
       ORDER BY ABS(bgt_fy) DESC, rows_count DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT COALESCE(NULLIF(TRIM(NIVEL_4), ''), '__EMPTY__') AS value,
              COALESCE(NULLIF(TRIM(NIVEL_4), ''), 'Sem Sub Pacote') AS label,
              COALESCE(NULLIF(TRIM(NIVEL_3), ''), '__EMPTY__') AS pacote,
              COUNT(*) AS rows_count,
              SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END) AS bgt_fy
       FROM ${DRE_EXEC_TABLE}
       WHERE ${BASE_SCOPE_WHERE}
       GROUP BY 1, 2, 3
       ORDER BY ABS(bgt_fy) DESC, rows_count DESC`
    ),
    runBqQuery(
      bigquery,
      `SELECT ${MONTH_EXPR} AS month_num, COUNT(*) AS act_rows
       FROM ${DRE_EXEC_TABLE}
       WHERE TRIM(NIVEL_2) = 'V.tal'
         AND TRIM(NIVEL_1) = '(-) OPEX'
         AND UPPER(TRIM(TIPO)) = 'ACTUAL 2026'
       GROUP BY 1
       HAVING COUNT(*) >= 3000
       ORDER BY 1 DESC
       LIMIT 1`
    ),
  ]);

  const maxClosedMonth = Math.min(
    12,
    Math.max(1, intVal(closedMonthRow[0]?.month_num || 10))
  );

  const data = {
    defaultAnomes: `2026/${maxClosedMonth}`,
    maxClosedMonth,
    months: monthRows.map((r) => ({
      value: String(r.value),
      monthNum: intVal(r.month_num),
      hasFullActual: intVal(r.act_rows) >= 3000,
    })),
    pacotes: pacoteRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      rows: intVal(r.rows_count),
      bgtFy: numVal(r.bgt_fy),
    })),
    subPacotes: subPacoteRows.map((r) => ({
      value: String(r.value),
      label: fixMojibake(r.label),
      pacote: String(r.pacote),
      rows: intVal(r.rows_count),
      bgtFy: numVal(r.bgt_fy),
    })),
  };

  filtersCache = { expiresAt: now + 10 * 60 * 1000, data };
  return data;
}

interface ScenarioMetrics {
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

function emptyMetrics(): ScenarioMetrics {
  return {
    bgtMonth: 0,
    actMonth: 0,
    fct102Month: 0,
    fct84Month: 0,
    bgtYtd: 0,
    actYtd: 0,
    fct102Ytd: 0,
    fct84Ytd: 0,
    bgtFy: 0,
    fct102Fy: 0,
    fct84Fy: 0,
    fct48Fy: 0,
  };
}

function addMetrics(target: ScenarioMetrics, src: ScenarioMetrics) {
  target.bgtMonth += src.bgtMonth;
  target.actMonth += src.actMonth;
  target.fct102Month += src.fct102Month;
  target.fct84Month += src.fct84Month;
  target.bgtYtd += src.bgtYtd;
  target.actYtd += src.actYtd;
  target.fct102Ytd += src.fct102Ytd;
  target.fct84Ytd += src.fct84Ytd;
  target.bgtFy += src.bgtFy;
  target.fct102Fy += src.fct102Fy;
  target.fct84Fy += src.fct84Fy;
  target.fct48Fy += src.fct48Fy;
}

function mapMetricsRow(r: Record<string, unknown>): ScenarioMetrics {
  return {
    bgtMonth: numVal(r.bgt_month),
    actMonth: numVal(r.act_month),
    fct102Month: numVal(r.fct102_month),
    fct84Month: numVal(r.fct84_month),
    bgtYtd: numVal(r.bgt_ytd),
    actYtd: numVal(r.act_ytd),
    fct102Ytd: numVal(r.fct102_ytd),
    fct84Ytd: numVal(r.fct84_ytd),
    bgtFy: numVal(r.bgt_fy),
    fct102Fy: numVal(r.fct102_fy),
    fct84Fy: numVal(r.fct84_fy),
    fct48Fy: numVal(r.fct48_fy),
  };
}

export async function getPlanFinDashboardData(
  bigquery: BigQuery,
  filters: PlanFinFilterParams
) {
  const cacheKey = JSON.stringify(filters);
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const [closedMonthRows] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT ${MONTH_EXPR} AS month_num
       FROM ${DRE_EXEC_TABLE}
       WHERE TRIM(NIVEL_2) = 'V.tal'
         AND TRIM(NIVEL_1) = '(-) OPEX'
         AND UPPER(TRIM(TIPO)) = 'ACTUAL 2026'
       GROUP BY 1
       HAVING COUNT(*) >= 3000
       ORDER BY 1 DESC
       LIMIT 1`
    ),
  ]);

  const maxClosedMonth = Math.min(
    12,
    Math.max(1, intVal(closedMonthRows[0]?.month_num || 10))
  );

  let refMonth = maxClosedMonth;
  if (filters.anomes && filters.anomes !== 'ALL') {
    const parsedMonth = Number(filters.anomes.split('/')[1]);
    if (Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
      refMonth = Math.trunc(parsedMonth);
    }
  }

  const { whereSql, params } = buildPlanFinWhere(filters);

  // OPEX é apresentado com sinal positivo (-1 * valor DRE) para leitura executiva de custos
  const metricSelectCols = `
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 10+2 BANCO' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct102_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' AND ${MONTH_EXPR} = ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_month,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 10+2 BANCO' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct102_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' AND ${MONTH_EXPR} <= ${refMonth} THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_ytd,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt_fy,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 10+2 BANCO' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct102_fy,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84_fy,
    COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 4+8' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct48_fy
  `;

  const [detailRows, monthlyRows] = await Promise.all([
    runBqQuery(
      bigquery,
      `SELECT
         COALESCE(NULLIF(TRIM(NIVEL_3), ''), 'Sem Pacote') AS pacote,
         COALESCE(NULLIF(TRIM(NIVEL_4), ''), 'Sem Sub Pacote') AS sub_pacote,
         COALESCE(NULLIF(TRIM(CLASSIFICACAO_FPA), ''), 'Sem Classificação') AS classificacao,
         ${metricSelectCols}
       FROM ${DRE_EXEC_TABLE}
       WHERE ${whereSql}
       GROUP BY 1, 2, 3
       ORDER BY ABS(bgt_ytd) + ABS(act_ytd) + ABS(fct102_ytd) DESC`,
      params
    ),
    runBqQuery(
      bigquery,
      `SELECT
         ${MONTH_EXPR} AS month_num,
         TRIM(anomes) AS anomes,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'BUDGET 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS bgt,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'ACTUAL 2026' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS act,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 10+2 BANCO' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct102,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(TIPO)) = 'FCST 8+4' THEN (-COALESCE(valor, 0)) ELSE 0 END), 0) AS fct84
       FROM ${DRE_EXEC_TABLE}
       WHERE ${whereSql} AND NULLIF(TRIM(anomes), '') IS NOT NULL
       GROUP BY 1, 2
       ORDER BY month_num`,
      params
    ),
  ]);

  interface ClassifNode extends ScenarioMetrics {
    key: string;
    classificacao: string;
  }

  interface SubPacoteNode extends ScenarioMetrics {
    key: string;
    pacote: string;
    subPacote: string;
    filterValue: string;
    classifications: ClassifNode[];
  }

  interface PacoteNode extends ScenarioMetrics {
    key: string;
    pacote: string;
    filterValue: string;
    subPackages: SubPacoteNode[];
  }

  const pkgMap = new Map<
    string,
    {
      node: Omit<PacoteNode, 'subPackages'>;
      subMap: Map<string, SubPacoteNode>;
    }
  >();

  const totalSummary = emptyMetrics();
  const distinctClassifs = new Set<string>();
  const distinctSubPacotes = new Set<string>();

  for (const r of detailRows) {
    const pacote = fixMojibake(r.pacote) || 'Sem Pacote';
    const subPacote = fixMojibake(r.sub_pacote) || 'Sem Sub Pacote';
    const classificacao = fixMojibake(r.classificacao) || 'Sem Classificação';
    const m = mapMetricsRow(r);

    // Ignorar linhas completamente zeradas em todos os cenários
    const hasNonZero =
      Math.abs(m.bgtMonth) >= 0.01 ||
      Math.abs(m.actMonth) >= 0.01 ||
      Math.abs(m.fct102Month) >= 0.01 ||
      Math.abs(m.bgtYtd) >= 0.01 ||
      Math.abs(m.actYtd) >= 0.01 ||
      Math.abs(m.fct102Ytd) >= 0.01 ||
      Math.abs(m.bgtFy) >= 0.01 ||
      Math.abs(m.fct102Fy) >= 0.01;
    if (!hasNonZero) continue;

    addMetrics(totalSummary, m);
    distinctSubPacotes.add(`${pacote}::${subPacote}`);
    distinctClassifs.add(classificacao);

    let pkgEntry = pkgMap.get(pacote);
    if (!pkgEntry) {
      pkgEntry = {
        node: {
          key: `pkg:${pacote}`,
          pacote,
          filterValue: pacote === 'Sem Pacote' ? '__EMPTY__' : pacote,
          ...emptyMetrics(),
        },
        subMap: new Map(),
      };
      pkgMap.set(pacote, pkgEntry);
    }
    addMetrics(pkgEntry.node, m);

    let subEntry = pkgEntry.subMap.get(subPacote);
    if (!subEntry) {
      subEntry = {
        key: `sub:${pacote}::${subPacote}`,
        pacote,
        subPacote,
        filterValue: subPacote === 'Sem Sub Pacote' ? '__EMPTY__' : subPacote,
        ...emptyMetrics(),
        classifications: [],
      };
      pkgEntry.subMap.set(subPacote, subEntry);
    }
    addMetrics(subEntry, m);

    subEntry.classifications.push({
      key: `cls:${pacote}::${subPacote}::${classificacao}`,
      classificacao,
      ...m,
    });
  }

  const packages: PacoteNode[] = Array.from(pkgMap.values())
    .map(({ node, subMap }) => {
      const subPackages = Array.from(subMap.values())
        .map((sub) => ({
          ...sub,
          classifications: sub.classifications.sort(
            (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actYtd) - (Math.abs(a.bgtYtd) + Math.abs(a.actYtd))
          ),
        }))
        .sort(
          (a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actYtd) - (Math.abs(a.bgtYtd) + Math.abs(a.actYtd))
        );

      return {
        ...node,
        subPackages,
      };
    })
    .sort((a, b) => Math.abs(b.bgtYtd) + Math.abs(b.actYtd) - (Math.abs(a.bgtYtd) + Math.abs(a.actYtd)));

  const data = {
    refMonth,
    maxClosedMonth,
    summary: {
      ...totalSummary,
      distinctPacotes: packages.length,
      distinctSubPacotes: distinctSubPacotes.size,
      distinctClassifs: distinctClassifs.size,
    },
    packages,
    monthlyTrend: monthlyRows.map((r) => ({
      monthNum: intVal(r.month_num),
      anomes: String(r.anomes || ''),
      bgt: numVal(r.bgt),
      act: numVal(r.act),
      fct102: numVal(r.fct102),
      fct84: numVal(r.fct84),
    })),
  };

  if (dashboardCache.size >= CACHE_MAX) {
    const firstKey = dashboardCache.keys().next().value;
    if (firstKey) dashboardCache.delete(firstKey);
  }
  dashboardCache.set(cacheKey, { expiresAt: now + 5 * 60 * 1000, data });
  return data;
}

export async function exportPlanFinExcelBuffer(
  bigquery: BigQuery,
  filters: PlanFinFilterParams
): Promise<{ buffer: Buffer; rowCount: number }> {
  const { whereSql, params } = buildPlanFinWhere(filters);
  const dashboard = (await getPlanFinDashboardData(bigquery, filters)) as {
    refMonth: number;
    packages: Array<{
      pacote: string;
      bgtMonth: number;
      actMonth: number;
      fct102Month: number;
      bgtYtd: number;
      actYtd: number;
      fct102Ytd: number;
      bgtFy: number;
      fct102Fy: number;
      subPackages: Array<{
        subPacote: string;
        bgtMonth: number;
        actMonth: number;
        fct102Month: number;
        bgtYtd: number;
        actYtd: number;
        fct102Ytd: number;
        bgtFy: number;
        fct102Fy: number;
        classifications: Array<{
          classificacao: string;
          bgtMonth: number;
          actMonth: number;
          fct102Month: number;
          bgtYtd: number;
          actYtd: number;
          fct102Ytd: number;
          bgtFy: number;
          fct102Fy: number;
        }>;
      }>;
    }>;
  };

  const rowsForSheet: Array<Record<string, unknown>> = [];
  for (const pkg of dashboard.packages) {
    for (const sub of pkg.subPackages) {
      for (const cls of sub.classifications) {
        rowsForSheet.push({
          MES_REFERENCIA: `2026/${dashboard.refMonth}`,
          PACOTE_NIVEL_3: pkg.pacote,
          SUB_PACOTE_NIVEL_4: sub.subPacote,
          CLASSIFICACAO_FPA: cls.classificacao,
          ORC_MES_BRL: Math.round(cls.bgtMonth * 100) / 100,
          REAL_MES_BRL: Math.round(cls.actMonth * 100) / 100,
          REAL_X_ORC_MES_BRL: Math.round((cls.actMonth - cls.bgtMonth) * 100) / 100,
          ORC_ACUM_YTD_BRL: Math.round(cls.bgtYtd * 100) / 100,
          REAL_ACUM_YTD_BRL: Math.round(cls.actYtd * 100) / 100,
          REAL_X_ORC_YTD_BRL: Math.round((cls.actYtd - cls.bgtYtd) * 100) / 100,
          BGT_FY_2026_BRL: Math.round(cls.bgtFy * 100) / 100,
          FCST_10_2_FY_BRL: Math.round(cls.fct102Fy * 100) / 100,
        });
      }
    }
  }

  // Fallback para garantir consulta válida se vazio
  if (rowsForSheet.length === 0) {
    const rawCheck = await queryBigQueryFast(
      bigquery,
      `SELECT COUNT(*) AS cnt FROM ${DRE_EXEC_TABLE} WHERE ${whereSql}`,
      params
    );
    rowsForSheet.push({
      Mensagem: 'Nenhum lançamento encontrado para os filtros selecionados.',
      Registros: rawCheck[0]?.cnt ?? 0,
    });
  }

  const buffer = await buildFastXlsxBuffer(rowsForSheet, 'Plan_Fin_Executivo_OPEX');
  return { buffer, rowCount: rowsForSheet.length };
}
