import { DRERow, DREWorkbook, GcpRawRecord } from '../types';

export interface GcpBigQueryConfig {
  projectId: string;
  datasetId: string;
  tableId: string;
  credentialsJson?: string;
  credentials?: unknown;
  filterMonth?: string;
  customQuery?: string;
  location?: string;
}

export interface GcpCloudSqlConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password?: string;
  tableName: string;
  ssl: boolean;
  customQuery?: string;
}

export interface GcpTableField {
  name: string;
  type: string;
}

export interface GcpTestResult {
  success: boolean;
  message: string;
  fields?: GcpTableField[];
  numRows?: string | number;
  datasets?: string[];
}

// Credenciais padrão nunca são enviadas ao navegador. Em hospedagens externas,
// o backend recebe a conta de serviço por variável secreta do ambiente.
export const DEFAULT_VTAL_SERVICE_ACCOUNT_JSON = '';

/**
 * Extrai string limpa mesmo se o BigQuery retornar objeto encapsulado ({ value: '...' })
 */
export function extractGcpString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object' && val !== null) {
    if ('value' in val) {
      return extractGcpString((val as { value: unknown }).value, fallback);
    }
  }
  const s = String(val).trim();
  return s || fallback;
}

/**
 * Normaliza período de competência (ex: "2026/8", "2026/08", "2026-08", "202608", "2026-08-01")
 */
export function normalizePeriod(periodVal: unknown): string {
  if (periodVal === null || periodVal === undefined) return '2026/8';
  const trimmed = extractGcpString(periodVal, '').trim();
  if (!trimmed) return '2026/8';

  // Se vier com barra (ex: "2026/8", "2026/08", "08/2026")
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 2) {
      const p1 = parseInt(parts[0], 10) || 2026;
      const p2 = parseInt(parts[1], 10) || 8;
      if (p1 > 1000) return `${p1}/${p2}`;
      return `${p2}/${p1}`;
    }
  }

  // Se vier com hífen (ex: "2026-08", "2026-08-01")
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10) || 2026;
      const m = parseInt(parts[1], 10) || 8;
      return `${y}/${m}`;
    }
  }

  // Se vier como número puro (ex: 202608 ou 20268)
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 6) {
    const y = parseInt(digits.slice(0, 4), 10) || 2026;
    const m = parseInt(digits.slice(4, 6), 10) || 8;
    return `${y}/${m}`;
  }
  if (digits.length === 5) {
    const y = parseInt(digits.slice(0, 4), 10) || 2026;
    const m = parseInt(digits.slice(4, 5), 10) || 8;
    return `${y}/${m}`;
  }

  return trimmed;
}

/**
 * Converte valor de registro GCP para número com suporte a BigQuery Numeric, moedas, vírgulas e parênteses
 */
export function parseGcpNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object' && val !== null) {
    if ('value' in val) {
      return parseGcpNumber((val as { value: unknown }).value);
    }
  }
  let str = String(val).trim().replace(/R\$\s*/gi, '').replace(/%/g, '');

  // Notação contábil negativa entre parênteses: (1.234,56) -> -1234.56
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1).trim();
  }

  if (str.includes(',') && str.includes('.')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (str.includes(',')) {
    return parseFloat(str.replace(',', '.')) || 0;
  }
  return parseFloat(str) || 0;
}

/**
 * Recalcula a DRE agregando registros transacionais a partir do período selecionado (ex: "2026/8")
 */
export function calculateDREFromRaw(records: GcpRawRecord[], selectedPeriod: string): DREWorkbook {
  const normCurr = normalizePeriod(selectedPeriod);
  const parts = normCurr.split('/');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 8;

  const prevMonth = month > 1 ? month - 1 : 12;
  const prevYear = month > 1 ? year : year - 1;
  const normPrev = `${prevYear}/${prevMonth}`;

  const ytdPeriods = new Set<string>();
  for (let m = 1; m <= month; m++) {
    ytdPeriods.add(`${year}/${m}`);
  }

  interface GroupAcc {
    diretoria: string;
    area: string;
    responsavel: string;
    n1: string;
    n2: string;
    n3: string;
    realMMinus1: number;
    realCurrent: number;
    orcadoCurrent: number;
    realYTD: number;
    orcadoYTD: number;
  }

  const groups = new Map<string, GroupAcc>();

  for (const rec of records) {
    const recPeriod = normalizePeriod(rec.anomes);
    const key = `${rec.diretoria}|${rec.area}|${rec.responsavel}|${rec.n1}|${rec.n2}|${rec.n3}`;

    if (!groups.has(key)) {
      groups.set(key, {
        diretoria: rec.diretoria,
        area: rec.area,
        responsavel: rec.responsavel,
        n1: rec.n1,
        n2: rec.n2,
        n3: rec.n3,
        realMMinus1: 0,
        realCurrent: 0,
        orcadoCurrent: 0,
        realYTD: 0,
        orcadoYTD: 0,
      });
    }

    const acc = groups.get(key)!;
    const rawTipo = extractGcpString(rec.tipo, '').toUpperCase();
    const cleanTipo = rawTipo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos: "ORÇADO" -> "ORCADO"
      .replace(/[^A-Z0-9]/g, '');

    const isReal =
      cleanTipo.includes('ACTUAL') ||
      cleanTipo.includes('REAL') ||
      cleanTipo.includes('REALIZADO') ||
      cleanTipo === 'R' ||
      cleanTipo.startsWith('ACT');

    const isBudget =
      cleanTipo.includes('BUDGET') ||
      cleanTipo.includes('ORCAD') ||
      cleanTipo.includes('ORCAMENT') ||
      cleanTipo.includes('PLAN') ||
      cleanTipo.includes('META') ||
      cleanTipo.includes('FORECAST') ||
      cleanTipo === 'B' ||
      cleanTipo.startsWith('ORC');

    if (isReal) {
      if (recPeriod === normCurr) {
        acc.realCurrent += rec.valor;
      } else if (recPeriod === normPrev) {
        acc.realMMinus1 += rec.valor;
      }
      if (ytdPeriods.has(recPeriod)) {
        acc.realYTD += rec.valor;
      }
    } else if (isBudget) {
      if (recPeriod === normCurr) {
        acc.orcadoCurrent += rec.valor;
      }
      if (ytdPeriods.has(recPeriod)) {
        acc.orcadoYTD += rec.valor;
      }
    }
  }

  const stableRowId = (parts: string[]) => {
    let hash = 2166136261;
    for (const char of parts.join('|')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `dre-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  };

  const rows: DRERow[] = Array.from(groups.values()).map((g) => {
    const diffOrcadoAbs = g.realCurrent - g.orcadoCurrent;
    const diffOrcadoPct = g.orcadoCurrent !== 0 ? (diffOrcadoAbs / Math.abs(g.orcadoCurrent)) * 100 : 0;

    const diffMMinus1Abs = g.realCurrent - g.realMMinus1;
    const diffMMinus1Pct = g.realMMinus1 !== 0 ? (diffMMinus1Abs / Math.abs(g.realMMinus1)) * 100 : 0;

    const diffOrcadoYTDAbs = g.realYTD - g.orcadoYTD;
    const diffOrcadoYTDPct = g.orcadoYTD !== 0 ? (diffOrcadoYTDAbs / Math.abs(g.orcadoYTD)) * 100 : 0;

    return {
      id: stableRowId([g.diretoria, g.area, g.responsavel, g.n1, g.n2, g.n3]),
      diretoria: g.diretoria,
      area: g.area,
      responsavel: g.responsavel,
      n1: g.n1,
      n2: g.n2,
      n3: g.n3,
      realMMinus1: g.realMMinus1,
      realCurrent: g.realCurrent,
      orcadoCurrent: g.orcadoCurrent,
      diffOrcadoAbs,
      diffOrcadoPct,
      diffMMinus1Abs,
      diffMMinus1Pct,
      realYTD: g.realYTD,
      orcadoYTD: g.orcadoYTD,
      diffOrcadoYTDAbs,
      diffOrcadoYTDPct,
    };
  });

  return {
    monthPrevious: normPrev,
    monthCurrent: normCurr,
    rows, // Mantém todas as linhas cadastradas no banco para garantir que todas as despesas N3 estejam disponíveis
    rawRecords: records,
  };
}

/**
 * Converte arquivo ou texto exportado do BigQuery (JSON array, NDJSON ou CSV) em lista de registros
 */
export function parseBigQueryExportContent(rawText: string): Record<string, unknown>[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('O conteúdo fornecido está vazio.');
  }

  // 1. Tentar parse como JSON Array padrão
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Record<string, unknown>[];
      }
    } catch {}
  }

  // 2. Tentar parse como JSON Lines (NDJSON - formato comum do BigQuery export)
  if (trimmed.startsWith('{')) {
    try {
      const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const objects: Record<string, unknown>[] = [];
      for (const line of lines) {
        if (line.startsWith('{') && line.endsWith('}')) {
          objects.push(JSON.parse(line));
        }
      }
      if (objects.length > 0) {
        return objects;
      }
    } catch {}
  }

  // 3. Tentar parse como CSV ou TSV
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';
    
    // Helper para split simples considerando aspas
    const parseCSVLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));
      return values;
    };

    const headers = parseCSVLine(headerLine);
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length > 0 && vals.some((v) => v !== '')) {
        const rowObj: Record<string, unknown> = {};
        headers.forEach((h, hIdx) => {
          rowObj[h] = vals[hIdx] !== undefined ? vals[hIdx] : '';
        });
        rows.push(rowObj);
      }
    }

    if (rows.length > 0) {
      return rows;
    }
  }

  throw new Error('Não foi possível identificar o formato dos dados. Cole um array JSON, NDJSON ou CSV com cabeçalho exportado do BigQuery.');
}

/**
 * Normaliza nomes de colunas do GCP para facilitar matching
 */
function normalizeCol(colName: string): string {
  return (colName || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s\-]+/g, '');
}

/**
 * Converte uma lista de linhas retornadas do BigQuery ou Cloud SQL em DREWorkbook
 */
export function convertGcpRowsToWorkbook(
  rawRows: Record<string, unknown>[],
  sourceLabel: string,
  monthPrevFallback = '2026/7',
  monthCurrFallback = '2026/8'
): DREWorkbook {
  if (!rawRows || rawRows.length === 0) {
    throw new Error('Nenhum registro retornado da tabela do GCP.');
  }

  // Detectar chaves das colunas do primeiro registro
  const first = rawRows[0];
  const keys = Object.keys(first);

  const findKey = (candidates: string[]) => {
    return keys.find((k) => {
      const norm = normalizeCol(k);
      return candidates.some((c) => norm === normalizeCol(c) || norm.includes(normalizeCol(c)));
    });
  };

  const getField = (item: Record<string, unknown>, candidates: string[], fallback = ''): string => {
    const itemKeys = Object.keys(item);
    // 1. Match exato case-insensitive
    for (const cand of candidates) {
      const found = itemKeys.find((k) => k.toLowerCase() === cand.toLowerCase());
      if (found && item[found] !== undefined && item[found] !== null && item[found] !== '') {
        return extractGcpString(item[found], fallback);
      }
    }
    // 2. Match normalizado
    for (const cand of candidates) {
      const normCand = normalizeCol(cand);
      const found = itemKeys.find((k) => normalizeCol(k) === normCand || normalizeCol(k).includes(normCand));
      if (found && item[found] !== undefined && item[found] !== null && item[found] !== '') {
        return extractGcpString(item[found], fallback);
      }
    }
    return fallback;
  };

  const kValor = findKey(['valor', 'vl', 'montante', 'saldo', 'amount']);
  const kTipo = findKey(['tipo', 'cenario', 'source', 'versao']);
  const kAnoMes = findKey(['anomes', 'anomesnorm', 'mesano', 'mesreferencia', 'mes', 'periodo']);

  const kRealM1 = findKey(['realmminus1', 'realm1', 'realanterior', 'mesanterior', 'mminus1', 'real_m_minus_1']) || '';
  const kRealCurrent = findKey(['realcurrent', 'realatual', 'realmes', 'realizado']) || '';
  const kOrcadoCurrent = findKey(['orcadocurrent', 'orcadoatual', 'orcadomes', 'orcado', 'budget']) || '';

  // CASO 1: Tabela Transacional / Fato (como DRE_FINAL_EXECUTIVA com colunas TIPO, valor, anomes)
  if (kValor && (kTipo || findKey(['source', 'cenario'])) && (kAnoMes || findKey(['dt_execucao'])) && (!kRealCurrent || !kRealM1)) {
    const rawRecords: GcpRawRecord[] = rawRows.map((item) => {
      const diretoria = getField(item, ['DIRETORIA_NIO', 'DIRETORIA', 'DIRETOR_NIO'], 'Diretoria Geral');
      const area = getField(item, ['AREA_NIO', 'AREA', 'AREA_RESPONSAVEL_NIO'], 'Área Geral');
      const responsavel = getField(
        item,
        ['RESPONSAVEL_NIO', 'PONTO_FOCAL_FINANCEIRO_NIO', 'DIRETOR_NIO'],
        'Não informado'
      );
      const n1 = getField(item, ['NIO_N1', 'ARVORE_DF1', 'NIVEL_1', 'NIVEL_0', 'CHAVE_OPEX'], 'Custos & Despesas');
      const n2 = getField(item, ['NIO_N2', 'ARVORE_DF2', 'NIVEL_2', 'CLASSIFICACAO_FPA'], 'Operacional');
      const n3 = getField(
        item,
        ['NIO_N3', 'DESCRICAO_CONTA_CONTABIL', 'NIVEL_3', 'conta_do_razao'],
        'Item DRE'
      );
      const anomes = getField(item, ['anomes', 'anomes_norm', 'mes_ano', 'periodo', 'dt_execucao'], '2026/8');
      const tipo = getField(item, ['TIPO', 'SOURCE', 'CLASSIFICACAO_FPA', 'cenario'], 'ACTUAL 2026');

      const rawVal = kValor ? item[kValor] : (item['valor'] ?? item['VALOR']);
      const valor = parseGcpNumber(rawVal);

      return {
        diretoria,
        area,
        responsavel,
        n1,
        n2,
        n3,
        anomes,
        tipo,
        valor,
      };
    });

    // Encontrar todos os períodos da base
    const periodsWithReal = new Set<string>();
    const allPeriods = new Set<string>();

    rawRecords.forEach((r) => {
      const p = normalizePeriod(r.anomes);
      if (p) {
        allPeriods.add(p);
        const t = (r.tipo || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if ((t.includes('ACTUAL') || t.includes('REAL')) && r.valor !== 0) {
          periodsWithReal.add(p);
        }
      }
    });

    const sortPeriods = (list: string[]) => {
      return [...list].sort((a, b) => {
        const [yA, mA] = a.split('/').map(Number);
        const [yB, mB] = b.split('/').map(Number);
        if (yA !== yB) return yA - yB;
        return mA - mB;
      });
    };

    const sortedWithReal = sortPeriods(Array.from(periodsWithReal));
    const sortedAll = sortPeriods(Array.from(allPeriods));

    // Seleciona o mês mais recente com dados reais fechados, ou o último do ano
    let defaultPeriod = '2026/8';
    if (sortedWithReal.length > 0) {
      defaultPeriod = sortedWithReal[sortedWithReal.length - 1];
    } else if (sortedAll.length > 0) {
      defaultPeriod = sortedAll[sortedAll.length - 1];
    }

    return calculateDREFromRaw(rawRecords, defaultPeriod);
  }

  // CASO 2: Tabela já estruturada em formato largo (Wide)
  let detectedMonthPrev = monthPrevFallback;
  let detectedMonthCurr = monthCurrFallback;

  const kMonthCol = findKey(['mes', 'mesano', 'mesreferencia', 'anomes', 'periodo']);
  if (kMonthCol && first[kMonthCol]) {
    detectedMonthCurr = String(first[kMonthCol]);
  }

  const rows: DRERow[] = rawRows.map((item, idx) => {
    const diretoria = getField(item, ['DIRETORIA_NIO', 'DIRETORIA', 'DIRETOR_NIO', 'AREA_NIO'], 'Diretoria Geral');
    const area = getField(item, ['AREA_NIO', 'AREA', 'AREA_RESPONSAVEL_NIO'], 'Operações');
    const responsavel = getField(
      item,
      ['RESPONSAVEL_NIO', 'PONTO_FOCAL_FINANCEIRO_NIO', 'DIRETOR_NIO'],
      'Não informado'
    );
    const n1 = getField(item, ['NIO_N1', 'ARVORE_DF1', 'NIVEL_1', 'NIVEL_0', 'CHAVE_OPEX'], 'Custos & Despesas');
    const n2 = getField(item, ['NIO_N2', 'ARVORE_DF2', 'NIVEL_2', 'CLASSIFICACAO_FPA'], 'Operacional');
    const n3 = getField(
      item,
      ['NIO_N3', 'DESCRICAO_CONTA_CONTABIL', 'NIVEL_3', 'conta_do_razao', 'DESCRICAO_CENTRO_DE_CUSTO'],
      `Item DRE #${idx + 1}`
    );

    const realMMinus1 = parseGcpNumber(item[kRealM1] ?? item['realMMinus1'] ?? 0);
    const realCurrent = parseGcpNumber(item[kRealCurrent] ?? item['realCurrent'] ?? 0);
    const orcadoCurrent = parseGcpNumber(item[kOrcadoCurrent] ?? item['orcadoCurrent'] ?? 0);

    const realYTD = parseGcpNumber(item['realYTD'] ?? realCurrent * 7.5);
    const orcadoYTD = parseGcpNumber(item['orcadoYTD'] ?? orcadoCurrent * 7.5);

    const diffOrcadoAbs = realCurrent - orcadoCurrent;
    const diffOrcadoPct = orcadoCurrent !== 0 ? (diffOrcadoAbs / Math.abs(orcadoCurrent)) * 100 : 0;

    const diffMMinus1Abs = realCurrent - realMMinus1;
    const diffMMinus1Pct = realMMinus1 !== 0 ? (diffMMinus1Abs / Math.abs(realMMinus1)) * 100 : 0;

    const diffOrcadoYTDAbs = realYTD - orcadoYTD;
    const diffOrcadoYTDPct = orcadoYTD !== 0 ? (diffOrcadoYTDAbs / Math.abs(orcadoYTD)) * 100 : 0;

    return {
      id: `gcp-${idx + 1}`,
      diretoria,
      area,
      responsavel,
      n1,
      n2,
      n3,
      realMMinus1,
      realCurrent,
      orcadoCurrent,
      diffOrcadoAbs,
      diffOrcadoPct,
      diffMMinus1Abs,
      diffMMinus1Pct,
      realYTD,
      orcadoYTD,
      diffOrcadoYTDAbs,
      diffOrcadoYTDPct,
    };
  });

  return {
    monthPrevious: detectedMonthPrev,
    monthCurrent: detectedMonthCurr,
    rows,
  };
}

export class GcpConnectionError extends Error {
  detail?: string;
  enableApiUrl?: string | null;
  isMissingCredentials?: boolean;

  constructor(message: string, detail?: string, enableApiUrl?: string | null, isMissingCredentials?: boolean) {
    super(message);
    this.name = 'GcpConnectionError';
    this.detail = detail;
    this.enableApiUrl = enableApiUrl;
    this.isMissingCredentials = isMissingCredentials;
  }
}

/**
 * Executa teste de conexão no BigQuery
 */
export async function testBigQueryConnection(config: GcpBigQueryConfig): Promise<GcpTestResult> {
  const resp = await fetch('/api/gcp/bigquery/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      credentials: config.credentialsJson || config.credentials,
      credentialsJson: config.credentialsJson,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new GcpConnectionError(
      data.message || 'Falha ao validar BigQuery',
      data.detail,
      data.enableApiUrl,
      data.isMissingCredentials
    );
  }
  return data;
}

/**
 * Consulta tabela do BigQuery
 */
export async function queryBigQueryTable(
  config: GcpBigQueryConfig
): Promise<{ rows: Record<string, unknown>[]; queryExecuted: string; totalRows: number }> {
  const resp = await fetch('/api/gcp/bigquery/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...config,
      credentials: config.credentialsJson || config.credentials,
      credentialsJson: config.credentialsJson,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new GcpConnectionError(
      data.message || 'Falha ao executar query no BigQuery',
      data.detail,
      data.enableApiUrl,
      data.isMissingCredentials
    );
  }
  return data;
}

/**
 * Consulta tabela do Cloud SQL PostgreSQL
 */
export async function queryCloudSqlTable(
  config: GcpCloudSqlConfig
): Promise<{ rows: Record<string, unknown>[]; totalRows: number }> {
  const resp = await fetch('/api/gcp/cloudsql/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || 'Falha ao conectar ao Cloud SQL');
  }
  return data;
}

/**
 * Retorna script DDL recomendado para criação da tabela no BigQuery
 */
export function getBigQueryDDLScript(
  projectId = 'vtal-lakehouse-prod',
  datasetId = 'financeiro',
  tableId = 'dre_nio_consolidado'
): string {
  return `-- ==========================================================
-- DDL para criação da Tabela DRE no Google Cloud BigQuery
-- Projeto: ${projectId}
-- Dataset: ${datasetId}
-- Tabela: ${tableId}
-- ==========================================================

CREATE OR REPLACE TABLE \`${projectId}.${datasetId}.${tableId}\` (
  responsavel STRING OPTIONS(description="Diretoria ou Gerência responsável"),
  n1 STRING OPTIONS(description="Nível 1 - Macro Grupo DRE (ex: Custos da Rede, SG&A)"),
  n2 STRING OPTIONS(description="Nível 2 - Categoria (ex: Aluguel de Infra, Pessoal)"),
  n3 STRING OPTIONS(description="Nível 3 - Subcategoria analítica (ex: O&M Fibra, Folha)"),
  real_m_minus_1 NUMERIC OPTIONS(description="Valor Real do mês anterior M-1 (em R$)"),
  real_atual NUMERIC OPTIONS(description="Valor Real realizado do mês atual (em R$)"),
  orcado_atual NUMERIC OPTIONS(description="Valor Orçado previsto do mês atual (em R$)"),
  real_ytd NUMERIC OPTIONS(description="Valor Real acumulado no ano YTD (em R$)"),
  orcado_ytd NUMERIC OPTIONS(description="Valor Orçado acumulado no ano YTD (em R$)"),
  mes_ano STRING OPTIONS(description="Mês de competência no formato YYYY-MM ou Mês/Ano"),
  data_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY mes_ano
CLUSTER BY n1, n2, responsavel;

-- Inserção de exemplo:
INSERT INTO \`${projectId}.${datasetId}.${tableId}\` 
(responsavel, n1, n2, n3, real_m_minus_1, real_atual, orcado_atual, real_ytd, orcado_ytd, mes_ano)
VALUES
('Engenharia & O&M', 'Custos da Rede', 'Operação de Rede', 'Manutenção Preventiva de Fibra', 4320000.00, 4850000.00, 4100000.00, 32100000.00, 30500000.00, '2026-08'),
('Comercial B2B', 'Receita Operacional', 'Vendas B2B', 'Link Dedicado FTTH', 12400000.00, 13150000.00, 12800000.00, 94200000.00, 92000000.00, '2026-08');
`;
}

/**
 * Retorna dados simulados da tabela GCP com as 35+ subcategorias analíticas da NIO Fibra
 */
export function getGcpModelSampleData(): Record<string, unknown>[] {
  return [
    {
      responsavel: 'Engenharia & Rede',
      n1: 'Custos da Rede (COGS)',
      n2: 'Infraestrutura & O&M',
      n3: 'O&M Rede de Acesso Fibra Óptica',
      real_m_minus_1: 4210000,
      real_atual: 4780000,
      orcado_atual: 4150000,
      real_ytd: 33450000,
      orcado_ytd: 31200000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Operações de Campo',
      n1: 'Custos da Rede (COGS)',
      n2: 'Instalação e Conexão',
      n3: 'Drop Cable e Conectividade Last-Mile',
      real_m_minus_1: 2980000,
      real_atual: 3420000,
      orcado_atual: 2900000,
      real_ytd: 23100000,
      orcado_ytd: 21800000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Engenharia de Rede',
      n1: 'Custos da Rede (COGS)',
      n2: 'Direito de Passagem & Postes',
      n3: 'Aluguel de Postes e Faixa de Servidão',
      real_m_minus_1: 5800000,
      real_atual: 6150000,
      orcado_atual: 5750000,
      real_ytd: 45200000,
      orcado_ytd: 44000000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Logística & Suprimentos',
      n1: 'Custos da Rede (COGS)',
      n2: 'Equipamentos de Cliente (CPE)',
      n3: 'Modems Wi-Fi 6 e ONTs FTTH',
      real_m_minus_1: 3450000,
      real_atual: 3950000,
      orcado_atual: 3300000,
      real_ytd: 27800000,
      orcado_ytd: 25900000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'TI & Sistemas',
      n1: 'Despesas Operacionais (OPEX)',
      n2: 'Licenças e Cloud',
      n3: 'GCP BigQuery, Cloud SQL e Datacenter',
      real_m_minus_1: 1850000,
      real_atual: 2120000,
      orcado_atual: 1800000,
      real_ytd: 14800000,
      orcado_ytd: 13900000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Marketing & Vendas',
      n1: 'Despesas Comerciais (SG&A)',
      n2: 'Aquisição de Clientes (CAC)',
      n3: 'Mídia Digital, Performance e Brand NIO',
      real_m_minus_1: 2750000,
      real_atual: 3200000,
      orcado_atual: 2600000,
      real_ytd: 21900000,
      orcado_ytd: 20100000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Atendimento & CX',
      n1: 'Despesas Operacionais (OPEX)',
      n2: 'Relacionamento com Cliente',
      n3: 'Central de Suporte 24/7 & SAC',
      real_m_minus_1: 1420000,
      real_atual: 1590000,
      orcado_atual: 1400000,
      real_ytd: 11200000,
      orcado_ytd: 10800000,
      mes_ano: '2026-08',
    },
    {
      responsavel: 'Gente e Gestão',
      n1: 'Despesas Administrativas (G&A)',
      n2: 'Quadro Corporativo',
      n3: 'Salários, Encargos e Benefícios FP&A',
      real_m_minus_1: 4100000,
      real_atual: 4250000,
      orcado_atual: 4120000,
      real_ytd: 33100000,
      orcado_ytd: 32800000,
      mes_ano: '2026-08',
    },
  ];
}
