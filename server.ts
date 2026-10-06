import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';
import {
  generateExecutiveWordReport,
  type FinancialReportRow,
  type PhysicalReportRow,
  type ReportCompanyId,
} from './server/wordReport';
import { buildFastXlsxBuffer, queryBigQueryFast } from './server/excelExport';

dotenv.config();
EventEmitter.defaultMaxListeners = 100;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// Carregar credenciais padrão da Service Account salvas no servidor
let defaultCredentials: Record<string, unknown> | null = null;
const keyFilePath = path.join(process.cwd(), 'server', 'service-account.json');
try {
  if (fs.existsSync(keyFilePath)) {
    defaultCredentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));
    console.log('[Server] Service Account padrão carregada com sucesso de /server/service-account.json:', (defaultCredentials as { client_email?: string })?.client_email);
  }
} catch (e) {
  console.warn('Erro ao ler /server/service-account.json:', e);
}

// Em produção a chave é fornecida pelo cofre de variáveis do Render, sem ser
// gravada no repositório ou na imagem Docker.
if (!defaultCredentials && process.env.GCP_SERVICE_ACCOUNT_KEY) {
  try {
    defaultCredentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
    console.log('[Server] Service Account padrão carregada da variável segura GCP_SERVICE_ACCOUNT_KEY:', (defaultCredentials as { client_email?: string })?.client_email);
  } catch (e) {
    console.warn('Erro ao interpretar GCP_SERVICE_ACCOUNT_KEY:', e);
  }
}

// Helper para instanciar cliente BigQuery com credenciais dinâmicas ou de ambiente
function getBigQueryClient(options: { projectId?: string; credentials?: unknown; credentialsJson?: unknown }) {
  let credentialsObj = options.credentials || options.credentialsJson;
  if (typeof credentialsObj === 'string' && credentialsObj.trim()) {
    try {
      credentialsObj = JSON.parse(credentialsObj);
    } catch (e) {
      console.warn('Aviso: credenciais não são JSON válido', e);
    }
  }

  // Se não foi enviado no corpo da requisição, usa a Service Account padrão do servidor
  if (!credentialsObj && defaultCredentials) {
    credentialsObj = defaultCredentials;
  }

  const clientConfig: Record<string, unknown> = {};

  if (credentialsObj && typeof credentialsObj === 'object') {
    clientConfig.credentials = credentialsObj;
    const credProject = (credentialsObj as Record<string, unknown>).project_id;
    if (credProject) {
      clientConfig.projectId = options.projectId && options.projectId.trim() ? options.projectId.trim() : String(credProject);
    }
  }

  if (!clientConfig.projectId && options.projectId && options.projectId.trim()) {
    clientConfig.projectId = options.projectId.trim();
  }

  if (!clientConfig.credentials && process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const parsedEnvCred = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      clientConfig.credentials = parsedEnvCred;
      if (!clientConfig.projectId && parsedEnvCred.project_id) {
        clientConfig.projectId = parsedEnvCred.project_id;
      }
    } catch {
      console.warn('Não foi possível fazer parse de GCP_SERVICE_ACCOUNT_KEY');
    }
  }

  if (!clientConfig.projectId && process.env.GCP_PROJECT_ID) {
    clientConfig.projectId = process.env.GCP_PROJECT_ID;
  }

  return new BigQuery(clientConfig);
}

// Helper para formatar erros do BigQuery de forma amigável
function formatBigQueryError(error: unknown, projectId?: string) {
  const err = error as Error;
  const rawMsg = err.message || '';

  if (rawMsg.includes('651648292546') || rawMsg.includes('has not been used in project') || rawMsg.includes('is disabled')) {
    const isHostProject = rawMsg.includes('651648292546');
    return {
      message: isHostProject
        ? 'A conexão tentou autenticar usando a conta padrão do contêiner (651648292546) porque nenhuma Chave de Service Account (JSON) foi informada.'
        : `A BigQuery API está desativada no projeto '${projectId || 'informado'}'.`,
      detail: isHostProject
        ? 'Para acessar seus dados corporativos no GCP (ex: projeto V.tal / NIO Fibra), carregue o arquivo .json da Chave da Conta de Serviço (Service Account) com permissões "BigQuery Data Viewer" e "BigQuery Job User", ou use a aba "Colar Dados do BigQuery (JSON/CSV)".'
        : 'É necessário ativar a BigQuery API no console do Google Cloud.',
      enableApiUrl: `https://console.developers.google.com/apis/api/bigquery.googleapis.com/overview?project=${projectId || '651648292546'}`,
      isMissingCredentials: isHostProject,
    };
  }

  if (rawMsg.includes('Access Denied') || rawMsg.includes('Permission') || rawMsg.includes('403')) {
    return {
      message: 'Permissão negada no BigQuery.',
      detail: 'Verifique se a Service Account possui os papéis: "BigQuery Data Viewer" (roles/bigquery.dataViewer) e "BigQuery Job User" (roles/bigquery.jobUser).',
      enableApiUrl: null,
      isMissingCredentials: false,
    };
  }

  if (rawMsg.includes('Not found: Dataset') || rawMsg.includes('Not found: Table')) {
    return {
      message: 'Tabela ou Dataset não encontrado no BigQuery.',
      detail: 'Confirme se o Project ID, Dataset ID e Table ID digitados existem e se estão na mesma região (US, southamerica-east1, etc).',
      enableApiUrl: null,
      isMissingCredentials: false,
    };
  }

  return {
    message: rawMsg || 'Falha ao comunicar com o Google Cloud BigQuery.',
    detail: 'Verifique os parâmetros informados e se a conta possui acesso.',
    enableApiUrl: null,
    isMissingCredentials: false,
  };
}

// -------------------------------------------------------------
// Rota 1: Testar Conexão BigQuery
// -------------------------------------------------------------
app.post('/api/gcp/bigquery/test', async (req: Request, res: Response) => {
  const { projectId, credentials, credentialsJson, datasetId, tableId, location } = req.body;
  const creds = credentials || credentialsJson;

  try {
    const bigquery = getBigQueryClient({ projectId, credentials: creds });

    // Se informou dataset e tabela, busca metadados
    if (datasetId && tableId) {
      const dataset = bigquery.dataset(datasetId.trim());
      const table = dataset.table(tableId.trim());
      const [metadata] = await table.getMetadata();
      const schemaFields = metadata.schema?.fields || [];

      return res.json({
        success: true,
        message: `Tabela '${tableId}' encontrada com sucesso no GCP BigQuery!`,
        numRows: metadata.numRows,
        numBytes: metadata.numBytes,
        fields: schemaFields.map((f: { name: string; type: string }) => ({
          name: f.name,
          type: f.type,
        })),
      });
    }

    // Caso contrário lista datasets para validar credenciais
    const [datasets] = await bigquery.getDatasets({ maxResults: 10 });
    return res.json({
      success: true,
      message: 'Conexão com Google Cloud Platform BigQuery estabelecida com sucesso!',
      datasets: datasets.map((d) => d.id),
    });
  } catch (error: unknown) {
    const formatted = formatBigQueryError(error, projectId);
    console.error('Erro ao conectar BigQuery:', error);
    return res.status(400).json({
      success: false,
      message: formatted.message,
      detail: formatted.detail,
      enableApiUrl: formatted.enableApiUrl,
      isMissingCredentials: formatted.isMissingCredentials,
    });
  }
});

// -------------------------------------------------------------
// Rota 2: Executar Consulta BigQuery e Retornar Linhas
// -------------------------------------------------------------
app.post('/api/gcp/bigquery/query', async (req: Request, res: Response) => {
  const { projectId, credentials, credentialsJson, datasetId, tableId, customQuery, filterMonth, location } = req.body;
  const creds = credentials || credentialsJson;

  try {
    const bigquery = getBigQueryClient({ projectId, credentials: creds });

    let query = (customQuery || '').trim();

    if (!query) {
      if (!datasetId || !tableId) {
        return res.status(400).json({
          success: false,
          message: 'Informe o dataset e a tabela ou uma query SQL personalizada do BigQuery.',
        });
      }

      const pId = projectId || bigquery.projectId;
      const fullTable = pId ? `\`${pId}.${datasetId}.${tableId}\`` : `\`${datasetId}.${tableId}\``;

      let colNames: string[] = [];
      try {
        const dataset = bigquery.dataset(datasetId.trim());
        const table = dataset.table(tableId.trim());
        const [metadata] = await table.getMetadata();
        colNames = (metadata.schema?.fields || []).map((f: { name: string }) => f.name.toLowerCase());
      } catch (e) {
        console.warn('Não foi possível inspecionar colunas da tabela:', e);
      }

      const hasDiretoria = colNames.includes('diretoria_nio');
      const hasArea = colNames.includes('area_nio');
      const hasN3 = colNames.includes('nio_n3');
      const hasAnoMes = colNames.includes('anomes');
      const hasTipo = colNames.includes('tipo');
      const hasValor = colNames.includes('valor');

      // Se a tabela possui as colunas estruturadas do NIO (ex: DRE_FINAL_EXECUTIVA),
      // fazemos GROUP BY para garantir 100% de todas as Diretorias, Áreas e N3 de todos os meses,
      // sem truncamento por limites arbitrários de linhas detalhadas.
      if (hasDiretoria && hasArea && hasN3 && hasAnoMes && hasTipo && hasValor) {
        const hasN1 = colNames.includes('nio_n1');
        const hasN2 = colNames.includes('nio_n2');
        const hasResponsavel = colNames.includes('responsavel_nio');
        const hasBpFinanceiro = colNames.includes('ponto_focal_financeiro_nio');
        // A NIO usa exclusivamente RESPONSAVEL_NIO; não misturar ponto focal ou colunas corporativas.
        const respCol = hasResponsavel
          ? 'TRIM(COALESCE(NULLIF(RESPONSAVEL_NIO, ""), "-")) AS RESPONSAVEL_NIO'
          : '"-" AS RESPONSAVEL_NIO';
        const bpCol = hasBpFinanceiro
          ? 'TRIM(COALESCE(NULLIF(PONTO_FOCAL_FINANCEIRO_NIO, ""), "-")) AS PONTO_FOCAL_FINANCEIRO_NIO'
          : '"-" AS PONTO_FOCAL_FINANCEIRO_NIO';

        const n1Col = hasN1 ? 'COALESCE(NIO_N1, "Custos & Despesas")' : '"Custos & Despesas"';
        const n2Col = hasN2 ? 'COALESCE(NIO_N2, "Operacional")' : '"Operacional"';

        query = `
          SELECT
            TRIM(COALESCE(DIRETORIA_NIO, 'Diretoria Geral')) AS DIRETORIA_NIO,
            TRIM(COALESCE(AREA_NIO, 'Área Geral')) AS AREA_NIO,
            ${respCol},
            ${bpCol},
            TRIM(${n1Col}) AS NIO_N1,
            TRIM(${n2Col}) AS NIO_N2,
            TRIM(COALESCE(NIO_N3, 'Item DRE')) AS NIO_N3,
            TRIM(CAST(anomes AS STRING)) AS anomes,
            TRIM(CAST(TIPO AS STRING)) AS TIPO,
            ROUND(SUM(SAFE_CAST(valor AS FLOAT64)), 2) AS valor
          FROM ${fullTable}
          WHERE DIRETORIA_NIO IS NOT NULL
            AND AREA_NIO IS NOT NULL
            AND NIO_N3 IS NOT NULL
            AND TRIM(UPPER(NIVEL_0)) IN ('BAU', 'NEW BUSINESS', 'SPECIAL PROJECTS')
          GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
          ORDER BY NIO_N1, DIRETORIA_NIO, AREA_NIO, NIO_N3
        `;
      } else {
        let whereClause = '';
        if (filterMonth && filterMonth.trim()) {
          const cleanDigits = filterMonth.trim().replace(/[^0-9]/g, '');
          const monthStr = filterMonth.trim();
          const matchedCol = ['anomes_norm', 'anomes', 'mes_ano', 'mes_referencia', 'mes', 'periodo', 'dt_execucao'].find((c) =>
            colNames.includes(c)
          );
          if (matchedCol) {
            whereClause = ` WHERE CAST(${matchedCol} AS STRING) = '${monthStr}' OR CAST(${matchedCol} AS STRING) = '${cleanDigits}' OR CAST(${matchedCol} AS STRING) LIKE '%${cleanDigits}%'`;
          }
        }
        query = `SELECT * FROM ${fullTable}${whereClause} LIMIT 100000`;
      }
    }

    // Só passa location se o usuário tiver explicitamente definido (ex: southamerica-east1 ou US)
    // Deixar sem location permite ao BigQuery inferir a região correta da tabela
    const jobOptions: { query: string; location?: string } = { query };
    if (location && location.trim()) {
      jobOptions.location = location.trim();
    }

    const [job] = await bigquery.createQueryJob(jobOptions);
    const [rows] = await job.getQueryResults();

    // Desempacotar tipos especiais do BigQuery (BigQueryDate, BigQueryNumeric, BigQueryDatetime etc.)
    const cleanRows = rows.map((row: Record<string, unknown>) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v !== null && typeof v === 'object' && 'value' in v) {
          clean[k] = (v as { value: unknown }).value;
        } else if (v instanceof Date) {
          clean[k] = v.toISOString();
        } else {
          clean[k] = v;
        }
      }
      return clean;
    });

    console.log(`[BigQuery] Consulta executada com sucesso. Total de linhas: ${cleanRows.length}`);
    if (cleanRows.length > 0) {
      console.log('[BigQuery] Amostra da primeira linha:', JSON.stringify(cleanRows[0]));
    }

    return res.json({
      success: true,
      queryExecuted: query,
      totalRows: cleanRows.length,
      rows: cleanRows,
    });
  } catch (error: unknown) {
    const formatted = formatBigQueryError(error, projectId);
    console.error('Erro na query BigQuery:', error);
    return res.status(400).json({
      success: false,
      message: formatted.message,
      detail: formatted.detail,
      enableApiUrl: formatted.enableApiUrl,
      isMissingCredentials: formatted.isMissingCredentials,
    });
  }
});

// -------------------------------------------------------------
// Rota 2.1: Obter Configuração Padrão Salva no Servidor
// -------------------------------------------------------------
app.get('/api/gcp/default-config', (req: Request, res: Response) => {
  return res.json({
    hasDefaultCredentials: !!defaultCredentials,
    serviceAccountEmail: (defaultCredentials as { client_email?: string })?.client_email || null,
    projectId: 'vtal-fpea-prd',
    datasetId: 'agente_fpa',
    tableId: 'DRE_FINAL_EXECUTIVA',
  });
});

// -------------------------------------------------------------
// Rota 2.2: Carregamento Automático Direto da Tabela no Início (com cache rápido)
// -------------------------------------------------------------
let autoLoadMemoryCache: { timestamp: number; payload: Record<string, unknown> } | null = null;
let autoLoadInFlight: Promise<Record<string, unknown>> | null = null;
const AUTO_LOAD_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function fetchBigQueryAutoLoadData(): Promise<Record<string, unknown>> {
  if (autoLoadInFlight) return autoLoadInFlight;

  autoLoadInFlight = (async () => {
    try {
      const projectId = 'vtal-fpea-prd';
      const datasetId = 'agente_fpa';
      const tableId = 'DRE_FINAL_EXECUTIVA';
      const fullTable = '`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA`';

      const bigquery = getBigQueryClient({
        projectId,
        credentials: defaultCredentials,
      });

      let colNames: string[] = [];
      try {
        const dataset = bigquery.dataset(datasetId);
        const table = dataset.table(tableId);
        const [metadata] = await table.getMetadata();
        colNames = (metadata.schema?.fields || []).map((f: { name: string }) => f.name.toLowerCase());
      } catch (e) {
        console.warn('[Auto-Load] Não foi possível inspecionar schema:', e);
      }

      const nioQuery = `
        SELECT
          TRIM(COALESCE(NULLIF(DIRETORIA_NIO, ''), '-')) AS DIRETORIA_NIO,
          TRIM(COALESCE(NULLIF(AREA_NIO, ''), '-')) AS AREA_NIO,
          TRIM(COALESCE(NULLIF(RESPONSAVEL_NIO, ''), '-')) AS RESPONSAVEL_NIO,
          TRIM(COALESCE(NULLIF(PONTO_FOCAL_FINANCEIRO_NIO, ''), '-')) AS PONTO_FOCAL_FINANCEIRO_NIO,
          TRIM(COALESCE(NULLIF(NIO_N1, ''), '-')) AS NIO_N1,
          TRIM(COALESCE(NULLIF(NIO_N2, ''), '-')) AS NIO_N2,
          TRIM(COALESCE(NIO_N3, 'Item DRE')) AS NIO_N3,
          TRIM(CAST(anomes AS STRING)) AS anomes,
          TRIM(CAST(TIPO AS STRING)) AS TIPO,
          ROUND(SUM(SAFE_CAST(valor AS FLOAT64)), 2) AS valor
        FROM ${fullTable}
        WHERE NIO_N3 IS NOT NULL
          AND TRIM(NIO_N3) NOT IN ('', '0', 'SEM_REGRA')
          AND TRIM(UPPER(NIVEL_0)) IN ('BAU', 'NEW BUSINESS', 'SPECIAL PROJECTS')
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
        ORDER BY NIO_N1, DIRETORIA_NIO, AREA_NIO, NIO_N3
      `;

      const corporateQuery = `
        SELECT
          '-' AS DIRETORIA_NIO,
          TRIM(COALESCE(AREA, '-')) AS AREA_NIO,
          TRIM(COALESCE(NIVEL_4, '-')) AS RESPONSAVEL_NIO,
          '-' AS PONTO_FOCAL_FINANCEIRO_NIO,
          TRIM(COALESCE(NIVEL_3, '-')) AS NIO_N1,
          TRIM(COALESCE(NIVEL_2, '-')) AS NIO_N2,
          TRIM(COALESCE(CLASSIFICACAO_FPA, 'Item DRE')) AS NIO_N3,
          TRIM(CAST(anomes AS STRING)) AS anomes,
          TRIM(CAST(TIPO AS STRING)) AS TIPO,
          ROUND(SUM(SAFE_CAST(valor AS FLOAT64)), 2) AS valor,
          CASE
            WHEN TRIM(NIVEL_2) = 'Tecto' THEN 'tecto'
            ELSE 'vtal'
          END AS COMPANY_ID
        FROM ${fullTable}
        WHERE TRIM(NIVEL_2) IN ('V.tal', 'V.tal (LTLA)', 'B2B', 'Mobile Solutions', 'UmTelecom', 'Tecto')
          AND AREA IS NOT NULL
          AND CLASSIFICACAO_FPA IS NOT NULL
          AND TRIM(UPPER(NIVEL_0)) IN ('BAU', 'NEW BUSINESS', 'SPECIAL PROJECTS')
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 11
        ORDER BY COMPANY_ID, AREA_NIO, NIO_N3
      `;

      const runQuery = async (query: string) => {
        const [job] = await bigquery.createQueryJob({ query, location: 'southamerica-east1' }).catch(() =>
          bigquery.createQueryJob({ query })
        );
        const [rows] = await job.getQueryResults();
        return rows || [];
      };

      const [nioRows, corporateRows] = await Promise.all([
        runQuery(nioQuery),
        runQuery(corporateQuery),
      ]);

      const cleanResult = (rows: Record<string, unknown>[]) => rows.map((row: Record<string, unknown>) => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v !== null && typeof v === 'object' && 'value' in v) {
            clean[k] = (v as { value: unknown }).value;
          } else if (v instanceof Date) {
            clean[k] = v.toISOString();
          } else {
            clean[k] = v;
          }
        }
        return clean;
      });

      const cleanNioRows = cleanResult(nioRows as Record<string, unknown>[]);
      const cleanCorporateRows = cleanResult(corporateRows as Record<string, unknown>[]);
      const vtalRows = cleanCorporateRows.filter((row) => row.COMPANY_ID === 'vtal');
      const tectoRows = cleanCorporateRows.filter((row) => row.COMPANY_ID === 'tecto');

      console.log(`[Auto-Load] Sincronização concluída: NIO ${cleanNioRows.length}, V.tal ${vtalRows.length}, Tecto ${tectoRows.length}.`);

      const payload = {
        success: true,
        totalRows: cleanNioRows.length + vtalRows.length + tectoRows.length,
        rows: cleanNioRows,
        companyRows: {
          nio: cleanNioRows,
          vtal: vtalRows,
          tecto: tectoRows,
        },
        projectId,
        datasetId,
        tableId,
        connected: true,
        serviceAccountEmail: (defaultCredentials as { client_email?: string })?.client_email || null,
      };

      autoLoadMemoryCache = { timestamp: Date.now(), payload };
      try {
        const diskFile = path.join(process.cwd(), 'server', 'bucket_cache', 'bigquery_autoload_cache.json');
        fs.mkdirSync(path.dirname(diskFile), { recursive: true });
        fs.writeFileSync(diskFile, JSON.stringify(payload), 'utf-8');
      } catch {}

      return payload;
    } finally {
      autoLoadInFlight = null;
    }
  })();

  return autoLoadInFlight;
}

app.get('/api/gcp/auto-load', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  if (!forceRefresh && autoLoadMemoryCache) {
    const age = Date.now() - autoLoadMemoryCache.timestamp;
    if (age > AUTO_LOAD_TTL_MS) {
      fetchBigQueryAutoLoadData().catch(() => {});
    }
    return res.json(autoLoadMemoryCache.payload);
  }

  if (!forceRefresh && !autoLoadMemoryCache) {
    try {
      const diskFile = path.join(process.cwd(), 'server', 'bucket_cache', 'bigquery_autoload_cache.json');
      if (fs.existsSync(diskFile)) {
        const cachedPayload = JSON.parse(fs.readFileSync(diskFile, 'utf-8'));
        if (cachedPayload && cachedPayload.success && cachedPayload.companyRows) {
          autoLoadMemoryCache = { timestamp: Date.now() - (AUTO_LOAD_TTL_MS / 2), payload: cachedPayload };
          fetchBigQueryAutoLoadData().catch(() => {});
          return res.json(cachedPayload);
        }
      }
    } catch {}
  }

  try {
    const payload = await fetchBigQueryAutoLoadData();
    return res.json(payload);
  } catch (error: unknown) {
    const formatted = formatBigQueryError(error, 'vtal-fpea-prd');
    console.error('[Auto-Load] Erro ao carregar base inicial:', error);
    return res.status(500).json({
      success: false,
      message: formatted.message,
      detail: formatted.detail,
    });
  }
});

// -------------------------------------------------------------
// Rota 3: Testar e Executar Consulta no GCP Cloud SQL (PostgreSQL)
// -------------------------------------------------------------
app.post('/api/gcp/cloudsql/query', async (req: Request, res: Response) => {
  const { host, port, database, user, password, ssl, query, tableName } = req.body;

  if (!host || !database || !user) {
    return res.status(400).json({
      success: false,
      message: 'Host, banco de dados e usuário são obrigatórios para conexão Cloud SQL.',
    });
  }

  const pool = new Pool({
    host: host.trim(),
    port: port ? parseInt(port, 10) : 5432,
    database: database.trim(),
    user: user.trim(),
    password: password || '',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    const sqlToRun = query && query.trim()
      ? query.trim()
      : `SELECT * FROM "${tableName || 'dre_consolidado'}" LIMIT 1000`;

    const result = await pool.query(sqlToRun);
    await pool.end();

    return res.json({
      success: true,
      totalRows: result.rows.length,
      rows: result.rows,
      fields: result.fields.map((f: { name: string }) => f.name),
    });
  } catch (error: unknown) {
    const err = error as Error;
    await pool.end().catch(() => {});
    return res.status(400).json({
      success: false,
      message: err.message || 'Erro ao consultar Cloud SQL no GCP.',
    });
  }
});

// Helper para instanciar cliente Google Cloud Storage com credenciais da Service Account
function getStorageClient(options: { projectId?: string; credentials?: unknown; credentialsJson?: unknown }) {
  let credentialsObj = options.credentials || options.credentialsJson;
  if (typeof credentialsObj === 'string' && credentialsObj.trim()) {
    try {
      credentialsObj = JSON.parse(credentialsObj);
    } catch (e) {
      console.warn('Aviso: credenciais GCS não são JSON válido', e);
    }
  }

  if (!credentialsObj && defaultCredentials) {
    credentialsObj = defaultCredentials;
  }

  const clientConfig: Record<string, unknown> = {};

  if (credentialsObj && typeof credentialsObj === 'object') {
    clientConfig.credentials = credentialsObj;
    const credProject = (credentialsObj as Record<string, unknown>).project_id;
    if (credProject) {
      clientConfig.projectId = options.projectId && options.projectId.trim() ? options.projectId.trim() : String(credProject);
    }
  }

  if (!clientConfig.projectId && options.projectId && options.projectId.trim()) {
    clientConfig.projectId = options.projectId.trim();
  }

  if (!clientConfig.credentials && process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const parsedEnvCred = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      clientConfig.credentials = parsedEnvCred;
      if (!clientConfig.projectId && parsedEnvCred.project_id) {
        clientConfig.projectId = parsedEnvCred.project_id;
      }
    } catch {}
  }

  if (!clientConfig.projectId && process.env.GCP_PROJECT_ID) {
    clientConfig.projectId = process.env.GCP_PROJECT_ID;
  }

  return new Storage(clientConfig);
}

// Diretório de cache local para persistência de justificativas
const bucketCacheDir = path.join(process.cwd(), 'server', 'bucket_cache');
if (!fs.existsSync(bucketCacheDir)) {
  try {
    fs.mkdirSync(bucketCacheDir, { recursive: true });
  } catch {}
}

// 7. Salvar justificativas no Bucket GCP (ou cache seguro com particionamento por empresa)
app.post('/api/gcp/bucket/save', async (req: Request, res: Response) => {
  const {
    bucketName = process.env.GCP_BUCKET_NAME || 'fpa-dre-justificativas',
    companyId = 'nio',
    justifications = {},
    user = 'Analista FP&A',
    credentials,
    credentialsJson,
    projectId,
  } = req.body;

  const fileName = `justificativas_${companyId}.json`;
  const auditFileName = `audit/${companyId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const payload = {
    companyId,
    updatedAt: new Date().toISOString(),
    updatedBy: user,
    totalAccounts: Object.keys(justifications).length,
    justifications,
  };
  const jsonString = JSON.stringify(payload, null, 2);

  // 1. Sempre salva no cache do servidor primeiro para nunca perder dados
  try {
    const localCompanyFile = path.join(bucketCacheDir, fileName);
    fs.writeFileSync(localCompanyFile, jsonString, 'utf-8');
  } catch (cacheErr) {
    console.warn('[Bucket] Erro ao gravar cache local:', cacheErr);
  }

  // 2. Tenta fazer upload para o Google Cloud Storage via Service Account
  try {
    const storage = getStorageClient({ credentials, credentialsJson, projectId });
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(jsonString, {
      contentType: 'application/json',
      metadata: {
        companyId,
        updatedAt: new Date().toISOString(),
      },
    });

    // Grava também versão de auditoria no Bucket para conciliação histórica
    const auditFile = bucket.file(auditFileName);
    await auditFile.save(jsonString, { contentType: 'application/json' }).catch(() => {});

    return res.json({
      success: true,
      savedToGcpBucket: true,
      bucket: bucketName,
      file: fileName,
      totalAccounts: Object.keys(justifications).length,
      updatedAt: payload.updatedAt,
      message: `Justificativas da empresa ${companyId.toUpperCase()} salvas com sucesso no Bucket GCP ('${bucketName}/${fileName}')!`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.warn('[Bucket] Não foi possível enviar diretamente ao GCS (armazenado com sucesso no servidor):', err.message);
    return res.json({
      success: true,
      savedToGcpBucket: false,
      savedToLocalCache: true,
      bucket: bucketName,
      file: fileName,
      totalAccounts: Object.keys(justifications).length,
      updatedAt: payload.updatedAt,
      message: `Justificativas salvas localmente no servidor. (Bucket GCS: ${err.message})`,
    });
  }
});

// 8. Carregar justificativas do Bucket GCP (ou cache local)
app.get('/api/gcp/bucket/load', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'nio';
  const bucketName = (req.query.bucketName as string) || process.env.GCP_BUCKET_NAME || 'fpa-dre-justificativas';
  const fileName = `justificativas_${companyId}.json`;

  // 1. Tenta carregar do Bucket GCP
  try {
    const storage = getStorageClient({
      projectId: req.query.projectId as string,
    });
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (exists) {
      const [contents] = await file.download();
      const parsed = JSON.parse(contents.toString('utf-8'));
      return res.json({
        success: true,
        source: 'gcp_bucket',
        bucket: bucketName,
        fileName,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
        justifications: parsed.justifications || {},
      });
    }
  } catch (e) {
    console.warn('[Bucket] Leitura GCS falhou, buscando cache local:', (e as Error).message);
  }

  // 2. Fallback para cache local
  try {
    const localCompanyFile = path.join(bucketCacheDir, fileName);
    if (fs.existsSync(localCompanyFile)) {
      const raw = fs.readFileSync(localCompanyFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return res.json({
        success: true,
        source: 'server_cache',
        bucket: bucketName,
        fileName,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
        justifications: parsed.justifications || {},
      });
    }
  } catch {}

  return res.json({
    success: true,
    source: 'empty',
    justifications: {},
    message: 'Nenhuma justificativa prévia encontrada no bucket para esta empresa.',
  });
});

const sharedJustificationsBucket = () =>
  process.env.GCP_BUCKET_NAME || 'vtal-bucket-financeiro-prd';

const JUSTIFICATIONS_BQ_PROJECT = process.env.GCP_PROJECT_ID || 'vtal-fpea-prd';
const JUSTIFICATIONS_BQ_DATASET = process.env.JUSTIFICATIONS_BQ_DATASET || '419556';
const JUSTIFICATIONS_BQ_HISTORY_TABLE =
  process.env.JUSTIFICATIONS_BQ_HISTORY_TABLE || 'JUSTIFICATIVAS_FPA_BUCKET_HIST';

type StoredImpact = {
  id?: unknown;
  name?: unknown;
  value?: unknown;
  justification?: unknown;
};

const normalizedCompanyName = (companyId: string) => {
  const company = companyId.toLowerCase();
  if (company === 'nio') return 'NIO';
  if (company === 'vtal') return 'V.tal';
  if (company === 'tecto') return 'Tecto';
  return companyId;
};

const periodToBigQueryDate = (period: string) => {
  const match = period.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${String(month).padStart(2, '0')}-01`;
};

const flattenJustificationSnapshot = (
  companyId: string,
  objectPath: string,
  payload: Record<string, unknown>,
  period: string,
) => {
  const periodDate = periodToBigQueryDate(period);
  if (!periodDate) throw new Error(`Período inválido para sincronização: ${period}`);
  const row = payload.row && typeof payload.row === 'object' ? payload.row as Record<string, unknown> : {};
  const periods = payload.periods && typeof payload.periods === 'object' ? payload.periods as Record<string, unknown> : {};
  const periodData = periods[period] && typeof periods[period] === 'object' ? periods[period] as Record<string, unknown> : {};
  const metadataByPeriod = payload.periodMetadata && typeof payload.periodMetadata === 'object' ? payload.periodMetadata as Record<string, unknown> : {};
  const periodMetadata = metadataByPeriod[period] && typeof metadataByPeriod[period] === 'object' ? metadataByPeriod[period] as Record<string, unknown> : {};
  const updatedAt = String(periodMetadata.updatedAt || payload.updatedAt || new Date().toISOString());
  const updatedBy = String(periodMetadata.updatedBy || payload.updatedBy || 'Usuário da aplicação');
  const snapshotId = createHash('sha256').update(`${companyId}|${payload.rowId}|${period}|${updatedAt}`).digest('hex');
  const groups = [
    { key: 'momImpacts', comparison: 'MOM_VS_MES_ANTERIOR' },
    { key: 'vsOrcadoImpacts', comparison: 'MES_VS_ORCADO' },
    { key: 'ytdImpacts', comparison: 'YTD_VS_ORCADO' },
  ];
  const rows: Array<Record<string, unknown>> = [];

  for (const group of groups) {
    const impacts = Array.isArray(periodData[group.key]) ? periodData[group.key] as StoredImpact[] : [];
    for (const impact of impacts) {
      const numericValue = Number(impact.value);
      rows.push({
        SNAPSHOT_ID: snapshotId,
        COMPANY_ID: companyId.toLowerCase(),
        EMPRESA: normalizedCompanyName(companyId),
        ROW_ID: String(payload.rowId || ''),
        CLASSIFICACAO_FPA: String(payload.classification || row.n3 || ''),
        DIRETORIA: String(row.diretoria || '-'), AREA: String(row.area || '-'),
        NIVEL_2: String(row.nivel2 || '-'), NIVEL_3: String(row.nivel3 || '-'), NIVEL_4: String(row.nivel4 || '-'),
        ANOMES: periodDate, PERIODO: period, TIPO_COMPARACAO: group.comparison,
        IMPACT_ID: String(impact.id || ''), IMPACTO: String(impact.name || ''),
        VALOR: Number.isFinite(numericValue) ? numericValue : 0,
        JUSTIFICATIVA: String(impact.justification || ''), UPDATED_AT: updatedAt, UPDATED_BY: updatedBy,
        OBJECT_PATH: objectPath, IS_EMPTY_SNAPSHOT: false,
      });
    }
  }

  if (rows.length === 0) {
    rows.push({
      SNAPSHOT_ID: snapshotId, COMPANY_ID: companyId.toLowerCase(), EMPRESA: normalizedCompanyName(companyId),
      ROW_ID: String(payload.rowId || ''), CLASSIFICACAO_FPA: String(payload.classification || row.n3 || ''),
      DIRETORIA: String(row.diretoria || '-'), AREA: String(row.area || '-'),
      NIVEL_2: String(row.nivel2 || '-'), NIVEL_3: String(row.nivel3 || '-'), NIVEL_4: String(row.nivel4 || '-'),
      ANOMES: periodDate, PERIODO: period, TIPO_COMPARACAO: 'SEM_IMPACTOS', IMPACT_ID: '', IMPACTO: '',
      VALOR: 0, JUSTIFICATIVA: '', UPDATED_AT: updatedAt, UPDATED_BY: updatedBy,
      OBJECT_PATH: objectPath, IS_EMPTY_SNAPSHOT: true,
    });
  }
  return rows;
};

async function syncJustificationSnapshotToBigQuery(
  companyId: string, objectPath: string, payload: Record<string, unknown>, period: string,
) {
  const bigquery = getBigQueryClient({ projectId: JUSTIFICATIONS_BQ_PROJECT, credentials: defaultCredentials });
  const rows = flattenJustificationSnapshot(companyId, objectPath, payload, period);
  const rawRows = rows.map((row, index) => ({ insertId: `${row.SNAPSHOT_ID}-${index}`, json: row }));
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await bigquery.dataset(JUSTIFICATIONS_BQ_DATASET).table(JUSTIFICATIONS_BQ_HISTORY_TABLE).insert(rawRows, { raw: true });
      return rows.length;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

const safeObjectSegment = (value: unknown, fallback: string) => {
  const normalized = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return normalized || fallback;
};

const buildRowStoragePath = (companyId: string, row: Record<string, unknown>) => {
  const company = safeObjectSegment(companyId, 'nio');
  const classification = safeObjectSegment(row.n3, 'sem-classificacao');
  const identity = [row.diretoria, row.area, row.n1, row.n2, row.n3, row.responsavel]
    .map((value) => String(value || ''))
    .join('|');
  const rowHash = createHash('sha256').update(identity).digest('hex').slice(0, 16);
  return `justificativas/${company}/${classification}/${rowHash}.json`;
};

// Cache em memória + disco para justificativas de cada empresa (evita baixar 180+ arquivos a cada troca de mês/empresa)
interface CompanyJustificationsCacheItem {
  loadedAt: number;
  entriesByPath: Record<string, Record<string, unknown>>;
}

const companyJustificationsMemoryCache = new Map<string, CompanyJustificationsCacheItem>();
const companyJustificationsInFlight = new Map<string, Promise<CompanyJustificationsCacheItem>>();
const JUSTIFICATIONS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

const getCompanyEntriesDiskCachePath = (companyId: string) =>
  path.join(bucketCacheDir, `company_entries_v2_${safeObjectSegment(companyId, 'nio')}.json`);

const saveCompanyEntriesToDisk = (companyId: string, item: CompanyJustificationsCacheItem) => {
  try {
    fs.writeFileSync(getCompanyEntriesDiskCachePath(companyId), JSON.stringify(item), 'utf-8');
  } catch (err) {
    console.warn('[Justificativas Cache] Falha ao gravar cache em disco:', err);
  }
};

const loadCompanyEntriesFromDisk = (companyId: string): CompanyJustificationsCacheItem | null => {
  try {
    const diskPath = getCompanyEntriesDiskCachePath(companyId);
    if (fs.existsSync(diskPath)) {
      const parsed = JSON.parse(fs.readFileSync(diskPath, 'utf-8')) as CompanyJustificationsCacheItem;
      if (parsed && parsed.entriesByPath && typeof parsed.entriesByPath === 'object') {
        return parsed;
      }
    }
  } catch {}
  return null;
};

async function syncCompanyEntriesFromGcs(companyId: string): Promise<CompanyJustificationsCacheItem> {
  const cleanCompany = safeObjectSegment(companyId, 'nio');
  const existingPromise = companyJustificationsInFlight.get(cleanCompany);
  if (existingPromise) return existingPromise;

  const syncPromise = (async () => {
    try {
      const bucketName = sharedJustificationsBucket();
      const storage = getStorageClient({ projectId: process.env.GCP_PROJECT_ID || 'vtal-fpea-prd' });
      const [files] = await storage.bucket(bucketName).getFiles({ prefix: `justificativas/${cleanCompany}/` });
      const entriesByPath: Record<string, Record<string, unknown>> = {};

      // Concorrência de 25 para baixar todos os JSONs ~5x mais rápido sem estourar conexões
      const BATCH_SIZE = 25;
      for (let index = 0; index < files.length; index += BATCH_SIZE) {
        await Promise.all(
          files.slice(index, index + BATCH_SIZE).map(async (file) => {
            try {
              const [contents] = await file.download();
              const parsed = JSON.parse(contents.toString('utf-8')) as Record<string, unknown>;
              if (parsed && typeof parsed === 'object') {
                entriesByPath[file.name] = parsed;
              }
            } catch {
              // Ignora arquivos inválidos
            }
          })
        );
      }

      const cacheItem: CompanyJustificationsCacheItem = {
        loadedAt: Date.now(),
        entriesByPath,
      };
      companyJustificationsMemoryCache.set(cleanCompany, cacheItem);
      saveCompanyEntriesToDisk(cleanCompany, cacheItem);
      console.log(`[Justificativas Cache] ${cleanCompany.toUpperCase()}: ${Object.keys(entriesByPath).length} arquivos sincronizados.`);
      return cacheItem;
    } finally {
      companyJustificationsInFlight.delete(cleanCompany);
    }
  })();

  companyJustificationsInFlight.set(cleanCompany, syncPromise);
  return syncPromise;
}

async function getCompanyEntriesFast(companyId: string, forceRefresh = false): Promise<CompanyJustificationsCacheItem> {
  const cleanCompany = safeObjectSegment(companyId, 'nio');

  if (!forceRefresh) {
    const mem = companyJustificationsMemoryCache.get(cleanCompany);
    if (mem) {
      if (Date.now() - mem.loadedAt > JUSTIFICATIONS_CACHE_TTL_MS) {
        syncCompanyEntriesFromGcs(cleanCompany).catch(() => {});
      }
      return mem;
    }

    const disk = loadCompanyEntriesFromDisk(cleanCompany);
    if (disk && Object.keys(disk.entriesByPath).length > 0) {
      companyJustificationsMemoryCache.set(cleanCompany, disk);
      // Atualiza em background para manter sempre fresco
      syncCompanyEntriesFromGcs(cleanCompany).catch(() => {});
      return disk;
    }
  }

  return syncCompanyEntriesFromGcs(cleanCompany);
}

// Salva uma linha em um único JSON acumulado. Cada mês ocupa uma chave em `periods`.
// A condição de geração impede que duas gravações concorrentes apaguem alterações.
app.post('/api/gcp/justifications/save-row', async (req: Request, res: Response) => {
  try {
    const { companyId = 'nio', period = '', row, justifications, user = 'Usuário da aplicação' } = req.body;
    if (!row || !row.id || !justifications || !period) {
      return res.status(400).json({ success: false, message: 'Linha, mês e justificativas são obrigatórios.' });
    }
    if (String(period).trim() !== '2026/9') {
      return res.status(403).json({
        success: false,
        message: `O período ${String(period).trim()} está bloqueado para edição. Apenas 2026/9 está liberado.`,
      });
    }

    const cleanCompany = safeObjectSegment(companyId, 'nio');
    const bucketName = sharedJustificationsBucket();
    const objectPath = buildRowStoragePath(cleanCompany, row);
    const updatedAt = new Date().toISOString();
    const storage = getStorageClient({ projectId: process.env.GCP_PROJECT_ID || 'vtal-fpea-prd' });
    const file = storage.bucket(bucketName).file(objectPath);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const [exists] = await file.exists();
        let current: Record<string, unknown> = {};
        let generation = 0;
        if (exists) {
          const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
          current = JSON.parse(contents.toString('utf-8')) as Record<string, unknown>;
          generation = Number(metadata.generation || 0);
        }

        const currentPeriods = (current.periods && typeof current.periods === 'object')
          ? current.periods as Record<string, unknown>
          : {};
        // Compatibilidade com algum arquivo criado no formato anterior.
        if (current.period && current.justifications && !currentPeriods[String(current.period)]) {
          currentPeriods[String(current.period)] = current.justifications;
        }
        const periodMetadata = (current.periodMetadata && typeof current.periodMetadata === 'object')
          ? current.periodMetadata as Record<string, unknown>
          : {};
        currentPeriods[period] = justifications;
        periodMetadata[period] = { updatedAt, updatedBy: user };

        const payload = {
          schemaVersion: 2,
          companyId: cleanCompany,
          rowId: row.id,
          classification: row.n3,
          row: {
            diretoria: row.diretoria || '-',
            area: row.area || '-',
            nivel2: row.n2 || '-',
            nivel3: row.n1 || '-',
            nivel4: row.responsavel || '-',
            n3: row.n3 || '-',
          },
          periods: currentPeriods,
          periodMetadata,
          updatedAt,
          updatedBy: user,
        };

        await file.save(JSON.stringify(payload, null, 2), {
          contentType: 'application/json',
          resumable: false,
          preconditionOpts: { ifGenerationMatch: generation },
          metadata: {
            cacheControl: 'no-store',
            metadata: { companyId: cleanCompany, rowId: String(row.id), updatedAt },
          },
        });

        // Atualiza imediatamente o cache em memória e em disco
        const mem = companyJustificationsMemoryCache.get(cleanCompany) || loadCompanyEntriesFromDisk(cleanCompany) || {
          loadedAt: Date.now(),
          entriesByPath: {},
        };
        mem.entriesByPath[objectPath] = payload;
        mem.loadedAt = Date.now();
        companyJustificationsMemoryCache.set(cleanCompany, mem);
        saveCompanyEntriesToDisk(cleanCompany, mem);

        const syncedRows = await syncJustificationSnapshotToBigQuery(
          cleanCompany,
          objectPath,
          payload,
          period,
        );

        return res.json({
          success: true,
          bucket: bucketName,
          objectPath,
          period,
          updatedAt,
          bigQuerySynced: true,
          bigQueryRows: syncedRows,
        });
      } catch (error: unknown) {
        const code = (error as { code?: number | string }).code;
        if ((code === 412 || code === '412') && attempt < 5) continue;
        throw error;
      }
    }

    throw new Error('Não foi possível concluir a gravação concorrente após 5 tentativas.');
  } catch (error: unknown) {
    console.error('[Justificativas] Falha ao salvar linha no Bucket:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao salvar no Bucket.',
    });
  }
});

const normalizeReportPeriod = (value: unknown) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}/${month}` : null;
};

const parsePeriodSortKey = (value: unknown): number => {
  const norm = normalizeReportPeriod(value);
  if (!norm) return 0;
  const [y, m] = norm.split('/').map(Number);
  return (y || 0) * 100 + (m || 0);
};

interface StoredImpactItem {
  id?: string;
  name?: string;
  value?: number;
  justification?: string;
}

interface StoredPeriodJustifications {
  momImpacts?: StoredImpactItem[];
  vsOrcadoImpacts?: StoredImpactItem[];
  ytdImpacts?: StoredImpactItem[];
  suppressHistorical?: boolean;
}

const hasMeaningfulJustificationText = (impacts: unknown): boolean => {
  if (!Array.isArray(impacts) || impacts.length === 0) return false;
  return impacts.some((item) => {
    const text = String((item as StoredImpactItem)?.justification || '').trim();
    return text.length > 0 && text !== '0';
  });
};

const cleanHistoricalImpactsList = (impacts: StoredImpactItem[]): StoredImpactItem[] => {
  if (!Array.isArray(impacts)) return [];
  const withText = impacts.filter((item) => {
    const text = String(item?.justification || '').trim();
    return text.length > 0 && text !== '0';
  });
  return (withText.length > 0 ? withText : impacts).map((item) => ({ ...item }));
};

/**
 * Resolve as justificativas de uma linha para um determinado período (ex: 2026/9):
 * - Se o período já possuir justificativas próprias preenchidas pelo usuário, usa-as.
 * - Caso contrário (ex: mês 9 ainda não preenchido), traz como referência histórica o último
 *   comentário disponível até o mês selecionado (priorizando 2026/8, depois 2026/7, 2026/6, etc.)
 *   tanto para "Mês vs Orçado" (vsOrcadoImpacts) quanto para "YTD vs Orçado" (ytdImpacts).
 * - "MoM (vs Mês Anterior)" (momImpacts) permanece vazio ([]) quando o mês ainda não foi preenchido.
 */
function resolveEntryForPeriod(
  entry: Record<string, unknown>,
  requestedPeriod: string
): StoredPeriodJustifications | null {
  const targetNorm = normalizeReportPeriod(requestedPeriod) || requestedPeriod || '2026/8';
  const targetOrder = parsePeriodSortKey(targetNorm);

  const rawPeriods = entry.periods && typeof entry.periods === 'object'
    ? (entry.periods as Record<string, unknown>)
    : {};

  const normalizedPeriods: Record<string, StoredPeriodJustifications> = {};
  for (const [k, v] of Object.entries(rawPeriods)) {
    if (v && typeof v === 'object') {
      const normK = normalizeReportPeriod(k) || k;
      normalizedPeriods[normK] = v as StoredPeriodJustifications;
    }
  }
  if (entry.justifications && typeof entry.justifications === 'object' && entry.period) {
    const normK = normalizeReportPeriod(entry.period) || String(entry.period);
    if (!normalizedPeriods[normK]) {
      normalizedPeriods[normK] = entry.justifications as StoredPeriodJustifications;
    }
  }

  const allPeriodKeys = Object.keys(normalizedPeriods);
  if (allPeriodKeys.length === 0) return null;

  // Ordena todos os períodos <= targetNorm do mais recente para o mais antigo (ex: 2026/9, 2026/8, 2026/7, 2026/6, 2026/5)
  const candidatePeriods = allPeriodKeys
    .filter((p) => {
      const order = parsePeriodSortKey(p);
      return targetOrder === 0 || (order > 0 && order <= targetOrder);
    })
    .sort((a, b) => parsePeriodSortKey(b) - parsePeriodSortKey(a));

  if (candidatePeriods.length === 0) return null;

  const exact = normalizedPeriods[targetNorm];

  // Uma limpeza explícita precisa prevalecer sobre a herança histórica. Isso permite
  // zerar uma competência sem apagar os comentários preservados nos meses anteriores.
  if (exact?.suppressHistorical === true) {
    return {
      momImpacts: Array.isArray(exact.momImpacts) ? exact.momImpacts.map((item) => ({ ...item })) : [],
      vsOrcadoImpacts: Array.isArray(exact.vsOrcadoImpacts) ? exact.vsOrcadoImpacts.map((item) => ({ ...item })) : [],
      ytdImpacts: Array.isArray(exact.ytdImpacts) ? exact.ytdImpacts.map((item) => ({ ...item })) : [],
      suppressHistorical: true,
    };
  }

  // 1. MoM (vs Mês Anterior): exclusivo do mês selecionado. Se não houver no próprio mês, fica vazio ([]).
  const momImpacts: StoredImpactItem[] =
    exact && Array.isArray(exact.momImpacts)
      ? exact.momImpacts.map((item) => ({ ...item }))
      : [];

  // 2. Mês vs Orçado (vsOrcadoImpacts):
  // Se o próprio mês já tem texto de justificativa (ou item editado manualmente pelo usuário), usa o próprio mês.
  // Caso contrário, busca no histórico (do mês mais recente <= targetNorm, começando por 2026/8) o último comentário escrito.
  let vsOrcadoImpacts: StoredImpactItem[] = [];
  const exactOrc = exact && Array.isArray(exact.vsOrcadoImpacts) ? exact.vsOrcadoImpacts : [];
  const exactOrcHasUserItem = exactOrc.some((i) => !String(i?.id || '').startsWith('historico-'));

  if (hasMeaningfulJustificationText(exactOrc) || exactOrcHasUserItem) {
    vsOrcadoImpacts = cleanHistoricalImpactsList(exactOrc);
  } else {
    let historicalOrc: StoredImpactItem[] | null = null;
    for (const pKey of candidatePeriods) {
      const pOrc = normalizedPeriods[pKey]?.vsOrcadoImpacts;
      if (hasMeaningfulJustificationText(pOrc)) {
        historicalOrc = cleanHistoricalImpactsList(pOrc!);
        break;
      }
    }
    if (historicalOrc && historicalOrc.length > 0) {
      // Se o mês exato (ex: 2026/8 na Tecto) tinha apenas 1 impacto residual sem texto para fechar o delta do mês 8,
      // preserva o valor conciliado do mês exato e aplica o comentário histórico mais recente.
      if (
        exactOrc.length === 1 &&
        String(exactOrc[0]?.id || '').startsWith('historico-residual-') &&
        historicalOrc.length === 1
      ) {
        vsOrcadoImpacts = [
          {
            ...historicalOrc[0],
            value: exactOrc[0].value,
          },
        ];
      } else {
        vsOrcadoImpacts = historicalOrc;
      }
    } else {
      vsOrcadoImpacts = exactOrc.map((item) => ({ ...item }));
    }
  }

  // 3. YTD vs Orçado (ytdImpacts):
  // Se o próprio mês já tem texto de justificativa YTD (ou item editado pelo usuário), usa o próprio mês.
  // Caso contrário, traz o último YTD preenchido (ex: "Resumo histórico até 2026/8").
  let ytdImpacts: StoredImpactItem[] = [];
  const exactYtd = exact && Array.isArray(exact.ytdImpacts) ? exact.ytdImpacts : [];
  const exactYtdHasUserItem = exactYtd.some((i) => !String(i?.id || '').startsWith('historico-'));

  if (hasMeaningfulJustificationText(exactYtd) || exactYtdHasUserItem) {
    ytdImpacts = cleanHistoricalImpactsList(exactYtd);
  } else {
    let historicalYtd: StoredImpactItem[] | null = null;
    for (const pKey of candidatePeriods) {
      const pYtd = normalizedPeriods[pKey]?.ytdImpacts;
      if (hasMeaningfulJustificationText(pYtd)) {
        historicalYtd = cleanHistoricalImpactsList(pYtd!);
        break;
      }
    }
    if (historicalYtd && historicalYtd.length > 0) {
      ytdImpacts = historicalYtd;
    } else {
      ytdImpacts = exactYtd.map((item) => ({ ...item }));
    }
  }

  if (momImpacts.length === 0 && vsOrcadoImpacts.length === 0 && ytdImpacts.length === 0) {
    return null;
  }

  return {
    momImpacts,
    vsOrcadoImpacts,
    ytdImpacts,
  };
}

// Carrega todas as linhas persistidas de uma empresa e devolve o mesmo mapa usado pela tela + todos os períodos.
app.get('/api/gcp/justifications/load-company', async (req: Request, res: Response) => {
  try {
    const companyId = safeObjectSegment(req.query.companyId || 'nio', 'nio');
    const period = normalizeReportPeriod(req.query.period) || String(req.query.period || '2026/8');
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const bucketName = sharedJustificationsBucket();

    const cacheItem = await getCompanyEntriesFast(companyId, forceRefresh);
    const entries = Object.values(cacheItem.entriesByPath);

    const targetPeriodsSet = new Set<string>([
      '2026/5',
      '2026/6',
      '2026/7',
      '2026/8',
      '2026/9',
      '2026/10',
      '2026/11',
      '2026/12',
    ]);
    if (period) targetPeriodsSet.add(period);

    const allPeriods: Record<string, Record<string, unknown>> = {};
    const allLookupKeys: Record<string, Record<string, unknown>> = {};

    for (const pKey of targetPeriodsSet) {
      allPeriods[pKey] = {};
      allLookupKeys[pKey] = {};
    }

    for (const entry of entries) {
      if (!entry?.rowId) continue;
      const rowIdStr = String(entry.rowId);
      const rMeta = entry.row as Record<string, unknown> | undefined;
      const dir = rMeta ? String(rMeta.diretoria || '').trim().toLowerCase() : '';
      const area = rMeta ? String(rMeta.area || '').trim().toLowerCase() : '';
      const n2 = rMeta ? String(rMeta.nivel2 || '').trim().toLowerCase() : '';
      const n3 = String((rMeta && rMeta.n3) || entry.classification || '').trim().toLowerCase();

      for (const pKey of targetPeriodsSet) {
        const resolved = resolveEntryForPeriod(entry, pKey);
        if (!resolved) continue;
        allPeriods[pKey][rowIdStr] = resolved;
        if (n3) {
          if (n2) {
            allLookupKeys[pKey][`${dir}|${area}|${n2}|${n3}`] = resolved;
            allLookupKeys[pKey][`${area}|${n2}|${n3}`] = resolved;
          }
          allLookupKeys[pKey][`${dir}|${area}|${n3}`] = resolved;
          allLookupKeys[pKey][`${area}|${n3}`] = resolved;
        }
      }
    }

    const justifications = allPeriods[period] || {};
    const byLookupKey = allLookupKeys[period] || {};

    return res.json({
      success: true,
      source: 'gcp_bucket',
      bucket: bucketName,
      totalFiles: entries.length,
      totalRows: Object.keys(justifications).length,
      justifications,
      allPeriods,
      byLookupKey,
      allLookupKeys,
    });
  } catch (error: unknown) {
    console.error('[Justificativas] Falha ao carregar empresa do Bucket:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao carregar justificativas.',
    });
  }
});

const stableReportRowId = (parts: string[]) => {
  let hash = 2166136261;
  for (const char of parts.join('|')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `dre-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const reportValueKind = (value: unknown) => {
  const clean = String(value || '').toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  if (clean.includes('ACTUAL2025') || clean.includes('FCST') || clean.includes('FORECAST')) return 'other';
  if (clean.includes('ACTUAL') || clean.includes('REAL') || clean === 'R' || clean.startsWith('ACT')) return 'real';
  if (clean.includes('BUDGET') || clean.includes('ORCAD') || clean.includes('ORCAMENT') || clean === 'B' || clean.startsWith('ORC')) return 'budget';
  return 'other';
};

const normalizeLookupText = (value: unknown) => String(value || '').trim().toLowerCase();

async function loadReportJustifications(companyId: ReportCompanyId, period: string) {
  const cacheItem = await getCompanyEntriesFast(companyId, false);
  const result: Record<string, Record<string, unknown>> = {};
  for (const entry of Object.values(cacheItem.entriesByPath)) {
    if (!entry?.rowId) continue;
    const resolved = resolveEntryForPeriod(entry, period);
    if (resolved) {
      const val = resolved as unknown as Record<string, unknown>;
      result[String(entry.rowId)] = val;
      const rMeta = entry.row as Record<string, unknown> | undefined;
      const dir = normalizeLookupText(rMeta?.diretoria);
      const area = normalizeLookupText(rMeta?.area);
      const n2 = normalizeLookupText(rMeta?.nivel2);
      const n3 = normalizeLookupText(rMeta?.n3 || entry.classification);
      if (n3) {
        if (dir && area && n2) result[`${dir}|${area}|${n2}|${n3}`] = val;
        if (dir && area) result[`${dir}|${area}|${n3}`] = val;
        if (area && n2) result[`${area}|${n2}|${n3}`] = val;
        if (area) result[`${area}|${n3}`] = val;
        if (!result[n3]) result[n3] = val;
      }
    }
  }
  return result;
}

// Gera a leitura executiva em Word a partir das bases oficiais e das justificativas salvas.
app.post('/api/reports/executive-word', async (req: Request, res: Response) => {
  try {
    const companyId = String(req.body?.companyId || '').toLowerCase() as ReportCompanyId;
    const period = normalizeReportPeriod(req.body?.period);
    if (!['nio', 'vtal', 'tecto'].includes(companyId) || !period) {
      return res.status(400).json({ success: false, message: 'Empresa ou mês de referência inválido.' });
    }

    const [yearText, monthText] = period.split('/');
    const year = Number(yearText);
    const month = Number(monthText);
    const bigquery = getBigQueryClient({ projectId: 'vtal-fpea-prd', credentials: defaultCredentials });
    let financialColumns = new Set<string>();
    if (companyId === 'nio') {
      try {
        const [metadata] = await bigquery.dataset('agente_fpa').table('DRE_FINAL_EXECUTIVA').getMetadata();
        financialColumns = new Set((metadata.schema?.fields || []).map((field: { name: string }) => field.name.toLowerCase()));
      } catch (error) {
        console.warn('[Word] Não foi possível inspecionar o schema financeiro:', error);
      }
    }
    const nioResponsibleColumn = financialColumns.has('responsavel_nio') && financialColumns.has('ponto_focal_financeiro_nio')
      ? "COALESCE(RESPONSAVEL_NIO, PONTO_FOCAL_FINANCEIRO_NIO, 'Não informado')"
      : financialColumns.has('responsavel_nio')
        ? "COALESCE(RESPONSAVEL_NIO, 'Não informado')"
        : financialColumns.has('ponto_focal_financeiro_nio')
          ? "COALESCE(PONTO_FOCAL_FINANCEIRO_NIO, 'Não informado')"
          : "'Não informado'";
    const companyFilter = companyId === 'nio'
      ? "AREA IS NOT NULL AND NIO_N3 IS NOT NULL AND TRIM(NIO_N3) NOT IN ('', '0', 'SEM_REGRA')"
      : companyId === 'tecto'
        ? "TRIM(NIVEL_2) = 'Tecto' AND AREA IS NOT NULL AND CLASSIFICACAO_FPA IS NOT NULL"
        : "TRIM(NIVEL_2) IN ('V.tal', 'V.tal (LTLA)', 'B2B', 'Mobile Solutions', 'UmTelecom') AND AREA IS NOT NULL AND CLASSIFICACAO_FPA IS NOT NULL";
    const dimensions = companyId === 'nio'
      ? `TRIM(COALESCE(NIVEL_0, 'BAU')) AS n0,
         TRIM(COALESCE(NIVEL_1, '-')) AS n1Type,
         'Diretoria Geral' AS diretoria,
         TRIM(COALESCE(AREA, 'Área Geral')) AS area,
         TRIM(${nioResponsibleColumn}) AS responsavel,
         TRIM(COALESCE(NIO_N1, 'Custos & Despesas')) AS n1,
         TRIM(COALESCE(NIO_N2, 'Operacional')) AS n2,
         TRIM(COALESCE(NIO_N3, 'Item DRE')) AS n3`
      : `TRIM(COALESCE(NIVEL_0, 'BAU')) AS n0,
         TRIM(COALESCE(NIVEL_1, '-')) AS n1Type,
         '-' AS diretoria,
         TRIM(COALESCE(AREA, '-')) AS area,
         TRIM(COALESCE(NIVEL_4, '-')) AS responsavel,
         TRIM(COALESCE(NIVEL_3, '-')) AS n1,
         TRIM(COALESCE(NIVEL_2, '-')) AS n2,
         TRIM(COALESCE(CLASSIFICACAO_FPA, 'Item DRE')) AS n3`;
    const financialQuery = `
      SELECT ${dimensions}, TRIM(CAST(anomes AS STRING)) AS anomes,
        TRIM(CAST(TIPO AS STRING)) AS tipo, SUM(SAFE_CAST(valor AS FLOAT64)) AS valor
      FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA\`
      WHERE ${companyFilter}
        AND TRIM(UPPER(NIVEL_0)) IN ('BAU', 'NEW BUSINESS', 'SPECIAL PROJECTS')
        AND SAFE_CAST(REGEXP_EXTRACT(CAST(anomes AS STRING), r'^(\\d{4})') AS INT64) = @year
      GROUP BY 1,2,3,4,5,6,7,8,9,10`;
    const physicalOrigins = companyId === 'nio' ? ['FTTH'] : companyId === 'tecto'
      ? ['Data Centers'] : ['Business Support', 'Mobile Solutions', 'VOIP', 'Wholesale'];
    const physicalQuery = `
      SELECT TRIM(CAST(INDICADOR AS STRING)) AS indicador, TRIM(CAST(TIPO AS STRING)) AS tipo,
        SUM(SAFE_CAST(VALOR AS FLOAT64)) AS valor
      FROM \`vtal-fpea-prd.agente_fpa.fFisicosBaseUnica\`
      WHERE (TRIM(CAST(ANOMES AS STRING)) IN (@period, @paddedPeriod, @compactPeriod)
        OR STARTS_WITH(REGEXP_REPLACE(CAST(ANOMES AS STRING), r'[^0-9]', ''), @compactPeriod))
        AND TRIM(CAST(ORIGEM AS STRING)) IN UNNEST(@origins)
        AND INDICADOR IS NOT NULL
      GROUP BY 1,2 ORDER BY 1,2`;

    const runQuery = async (query: string, params: Record<string, unknown>) => {
      const options = { query, params, location: 'southamerica-east1' };
      try {
        const [rows] = await bigquery.query(options);
        return rows as Record<string, unknown>[];
      } catch {
        const [rows] = await bigquery.query({ query, params });
        return rows as Record<string, unknown>[];
      }
    };
    const paddedPeriod = `${year}/${String(month).padStart(2, '0')}`;
    const compactPeriod = `${year}${String(month).padStart(2, '0')}`;
    const [rawFinancial, rawPhysical, justifications] = await Promise.all([
      runQuery(financialQuery, { year }),
      runQuery(physicalQuery, { period, paddedPeriod, compactPeriod, origins: physicalOrigins }),
      loadReportJustifications(companyId, period),
    ]);

    type Acc = Omit<FinancialReportRow, 'id' | 'classification' | 'level3' | 'level4'> & {
      n0: string; n1Type: string; diretoria: string; area: string; responsavel: string; n1: string; n2: string; n3: string;
    };
    const financialMap = new Map<string, Acc>();
    for (const row of rawFinancial) {
      const dims = ['n0', 'n1Type', 'diretoria', 'area', 'responsavel', 'n1', 'n2', 'n3'].map((key) => String(row[key] ?? '-'));
      const key = dims.join('|');
      const acc = financialMap.get(key) || {
        n0: dims[0], n1Type: dims[1], diretoria: dims[2], area: dims[3], responsavel: dims[4], n1: dims[5], n2: dims[6], n3: dims[7],
        realCurrent: 0, budgetCurrent: 0, realYtd: 0, budgetYtd: 0,
      };
      const periodMatch = normalizeReportPeriod(row.anomes);
      if (!periodMatch) continue;
      const [, rowMonthText] = periodMatch.split('/');
      const rowMonth = Number(rowMonthText);
      const amount = Number(row.valor) || 0;
      const kind = reportValueKind(row.tipo);
      if (kind === 'real') {
        if (rowMonth === month) acc.realCurrent += amount;
        if (rowMonth <= month) acc.realYtd += amount;
      } else if (kind === 'budget') {
        if (rowMonth === month) acc.budgetCurrent += amount;
        if (rowMonth <= month) acc.budgetYtd += amount;
      }
      financialMap.set(key, acc);
    }
    const financialRows: FinancialReportRow[] = Array.from(financialMap.values())
      .filter(
        (row) =>
          Math.abs(row.realCurrent) >= 0.01 ||
          Math.abs(row.budgetCurrent) >= 0.01 ||
          Math.abs(row.realYtd) >= 0.01 ||
          Math.abs(row.budgetYtd) >= 0.01
      )
      .map((row) => {
        const id = stableReportRowId([row.diretoria, row.area, row.responsavel, row.n1, row.n2, row.n3]);
        if (!justifications[id]) {
          const dir = normalizeLookupText(row.diretoria || '');
          const area = normalizeLookupText(row.area || '');
          const n2 = normalizeLookupText(row.n2 || '');
          const n3 = normalizeLookupText(row.n3 || '');
          const fallback =
            justifications[`${dir}|${area}|${n2}|${n3}`] ||
            justifications[`${dir}|${area}|${n3}`] ||
            justifications[`${area}|${n2}|${n3}`] ||
            justifications[`${area}|${n3}`] ||
            justifications[n3];
          if (fallback) {
            justifications[id] = fallback;
          }
        }
        return {
          id,
          classification: row.n3,
          area: row.area,
          level0: row.n0,
          level1: row.n1Type,
          level2: row.n2,
          level3: row.n1,
          level4: row.responsavel,
          realCurrent: row.realCurrent,
          budgetCurrent: row.budgetCurrent,
          realYtd: row.realYtd,
          budgetYtd: row.budgetYtd,
        };
      });

    const physicalMap = new Map<string, PhysicalReportRow>();
    for (const row of rawPhysical) {
      const indicator = String(row.indicador || 'Indicador');
      const current = physicalMap.get(indicator) || { indicator, real: 0, budget: 0 };
      const kind = reportValueKind(row.tipo);
      if (kind === 'real') current.real += Number(row.valor) || 0;
      if (kind === 'budget') current.budget += Number(row.valor) || 0;
      physicalMap.set(indicator, current);
    }
    const physicalRows = Array.from(physicalMap.values())
      .filter((row) => Math.abs(row.real) >= 0.0001 || Math.abs(row.budget) >= 0.0001);
    const logoPath = path.resolve(process.cwd(), 'public', 'Logos', `${companyId}.png`);
    const document = await generateExecutiveWordReport({
      companyId, period, financialRows, physicalRows,
      justifications: justifications as never,
      logo: fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : Buffer.alloc(0),
    });
    const filename = `${companyId.toUpperCase()}_Fechamento_${year}_${String(month).padStart(2, '0')}_Leitura.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(document);
  } catch (error: unknown) {
    console.error('[Word] Falha ao gerar leitura executiva:', error);
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Falha ao gerar o Word.' });
  }
});

// Exporta o Razão Detalhado ou o Resumo Executivo (Razão Executiva) em Excel (.xlsx) conforme empresa e filtros selecionados
app.post('/api/reports/export-razao-excel', async (req: Request, res: Response) => {
  try {
    const companyId = String(req.body?.companyId || 'nio').toLowerCase() as ReportCompanyId;
    const diretoria = String(req.body?.diretoria || 'ALL').trim();
    const area = String(req.body?.area || 'ALL').trim();
    const period = String(req.body?.period || '').trim();
    const periodMatch = period.match(/^(\d{4})[\/-](\d{1,2})$/);

    if (!['nio', 'vtal', 'tecto'].includes(companyId)) {
      return res.status(400).json({ success: false, message: 'Empresa inválida.' });
    }
    if (!periodMatch || Number(periodMatch[2]) < 1 || Number(periodMatch[2]) > 12) {
      return res.status(400).json({ success: false, message: 'Período inválido para a extração.' });
    }

    const bigquery = getBigQueryClient({ projectId: 'vtal-fpea-prd', credentials: defaultCredentials });

    const detailedSelectCols = `
      atribuicao, empresa, n_documento, conta_do_razao, tipo_de_documento,
      data_de_lancamento, data_do_documento, valor, texto, centro_custo,
      anomes, referencia, documento_de_compras, documento_de_compras_item,
      centro_de_lucro, elemento_pep, usuario, ORDEM, ORDEM_DESCRICAO,
      cat_class_contabil, CHAVE_OPEX, CHAVE_RECEITA, material_final,
      CONTA_CONTABIL_DESCRICAO, DENOMINACAO_CENTRO_DE_CUSTO,
      RESPONSAVEL_CENTRO_DE_CUSTO, DEPARTAMENTO_CENTRO_DE_CUSTO,
      DESCRICAO_CENTRO_DE_CUSTO, CLASSIFICACAO_FPA, NIVEL_0, NIVEL_1,
      NIVEL_2, NIVEL_3, NIVEL_4, NIVEL_5, AREA, NIO_N1, NIO_N2, NIO_N3,
      AREA_NIO, PONTO_FOCAL_FINANCEIRO_NIO, RESPONSAVEL_NIO,
      AREA_RESPONSAVEL_NIO, DIRETOR_NIO, DIRETORIA_NIO, SOURCE, TIPO,
      Pais, LTLA, Conta_Contabil_GNET, Montante_em_moeda_interna_GNET,
      Moeda_interna, Moeda_do_grupo, Montante_avaliado_MI3,
      Montante_avaliado_MI2, Empresa_Gnet, Cambio, fornecedor_original,
      nome_fornecedor, grupo_doc, cliente_original, nome_cliente
    `;

    const baseScopeFilter = `
      (ARVORE_DF2 <> 'PÓS-EBITDA' OR ARVORE_DF2 IS NULL)
      AND (NIVEL_0 NOT IN ('Below Ebitda', 'CAPEX', 'FÍSICOS') OR NIVEL_0 IS NULL)
    `;

    let query = '';
    let fallbackQuery = '';
    const compactPeriod = `${periodMatch[1]}${String(Number(periodMatch[2])).padStart(2, '0')}`;
    const periodFilter = `CONCAT(
      REGEXP_EXTRACT(CAST(anomes AS STRING), r'^(\\d{4})'),
      LPAD(REGEXP_EXTRACT(CAST(anomes AS STRING), r'[\\/-](\\d{1,2})'), 2, '0')
    ) = @compactPeriod`;
    const params: Record<string, unknown> = { compactPeriod };
    let sheetName = 'Razao';
    let fileLabel = 'Razao';

    if (companyId === 'nio') {
      if (!diretoria || diretoria === 'ALL') {
        // Todas as diretorias -> Resumo Executivo da Nio (DRE_FINAL_EXECUTIVA onde NIVEL_2 = 'Nio')
        query = `
          SELECT *
          FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA\`
          WHERE TRIM(NIVEL_2) = 'Nio'
            AND ${baseScopeFilter}
            AND ${periodFilter}
        `;
        sheetName = 'Razao Executiva Nio';
        fileLabel = 'Razao_Executiva_Nio';
      } else {
        // Diretoria específica -> Razão Detalhado da Nio filtrado por DIRETORIA_NIO
        params.diretoria = diretoria;
        query = `
          SELECT *
          FROM \`vtal-fpea-prd.relatorios.VW_DRE_RELATORIO\`
          WHERE TRIM(NIVEL_2) = 'Nio'
            AND TRIM(DIRETORIA_NIO) = @diretoria
            AND ${periodFilter}
        `;
        fallbackQuery = `
          SELECT ${detailedSelectCols}
          FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL\`
          WHERE TIPO IN ('ACTUAL 2026', 'Budget 2026')
            AND ${baseScopeFilter}
            AND TRIM(NIVEL_2) = 'Nio'
            AND TRIM(DIRETORIA_NIO) = @diretoria
            AND ${periodFilter}
        `;
        sheetName = `Razao ${diretoria}`.slice(0, 31);
        fileLabel = `Razao_Nio_${diretoria.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
      }
    } else if (companyId === 'vtal') {
      if (!area || area === 'ALL') {
        // Todas as Áreas -> Resumo Executivo da Vtal (DRE_FINAL_EXECUTIVA onde NIVEL_2 != 'Nio' e 'Tecto')
        query = `
          SELECT *
          FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA\`
          WHERE NIVEL_2 IS NOT NULL
            AND TRIM(NIVEL_2) NOT IN ('Nio', 'Tecto')
            AND ${baseScopeFilter}
            AND ${periodFilter}
        `;
        sheetName = 'Razao Executiva Vtal';
        fileLabel = 'Razao_Executiva_Vtal';
      } else {
        // Área específica -> Razão Detalhado da Vtal filtrado por AREA
        params.area = area;
        query = `
          SELECT *
          FROM \`vtal-fpea-prd.relatorios.VW_DRE_RELATORIO\`
          WHERE NIVEL_2 IS NOT NULL
            AND TRIM(NIVEL_2) NOT IN ('Nio', 'Tecto')
            AND TRIM(AREA) = @area
            AND ${periodFilter}
        `;
        fallbackQuery = `
          SELECT ${detailedSelectCols}
          FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL\`
          WHERE TIPO IN ('ACTUAL 2026', 'Budget 2026')
            AND ${baseScopeFilter}
            AND NIVEL_2 IS NOT NULL
            AND TRIM(NIVEL_2) NOT IN ('Nio', 'Tecto')
            AND TRIM(AREA) = @area
            AND ${periodFilter}
        `;
        sheetName = `Razao ${area}`.slice(0, 31);
        fileLabel = `Razao_Vtal_${area.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
      }
    } else {
      // Tecto (NIVEL_2 = 'Tecto') -> Sempre Razão Detalhada Tecto sem filtro de área
      query = `
        SELECT *
        FROM \`vtal-fpea-prd.relatorios.VW_DRE_RELATORIO\`
        WHERE TRIM(NIVEL_2) = 'Tecto'
          AND ${periodFilter}
      `;
      fallbackQuery = `
        SELECT ${detailedSelectCols}
        FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL\`
        WHERE TIPO IN ('ACTUAL 2026', 'Budget 2026')
          AND ${baseScopeFilter}
          AND TRIM(NIVEL_2) = 'Tecto'
          AND ${periodFilter}
      `;
      sheetName = 'Razao Detalhada Tecto';
      fileLabel = 'Razao_Detalhada_Tecto';
    }

    let rows: Record<string, unknown>[];
    try {
      rows = await queryBigQueryFast(bigquery, query, params);
    } catch (primaryErr) {
      if (fallbackQuery) {
        rows = await queryBigQueryFast(bigquery, fallbackQuery, params);
      } else {
        throw primaryErr;
      }
    }

    const xlsxBuffer = await buildFastXlsxBuffer(rows, sheetName);
    const filename = `${fileLabel}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xlsxBuffer);
  } catch (error: unknown) {
    console.error('[Excel Razão] Falha ao exportar razão em Excel:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao exportar planilha Excel.',
    });
  }
});

// Helper para formatar moeda BRL no backend
function formatBRLServer(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// Endpoint de Chat com Agente Vertex AI Search, Gemini Data Analytics e BigQuery Live
app.post('/api/agent/chat', async (req: Request, res: Response) => {
  try {
    const { message, companyId = 'all', history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Mensagem é obrigatória.' });
    }

    const trimmedMsg = message.trim();
    let agentReply: string | null = null;
    let citations: Array<{ title: string; url?: string; snippet?: string }> = [];

    // 1. TENTATIVA 1: Agente Executivo de FP&A no Cloud Run (fpa-a2a-agent / A2A Protocol)
    // Conecta automaticamente ao mesmo serviço chamado por '@ Agente Executivo de FP&A V.tal' no Gemini
    if (defaultCredentials) {
      try {
        const auth = new GoogleAuth({ credentials: defaultCredentials as never });
        const a2aUrl = 'https://fpa-a2a-agent-7kylviopuq-uc.a.run.app';
        const idClient = await auth.getIdTokenClient(a2aUrl);
        const headers = await idClient.getRequestHeaders();
        const authHeaders = typeof (headers as Headers).entries === 'function'
          ? Object.fromEntries((headers as Headers).entries())
          : { ...(headers as unknown as Record<string, string>) };

        const messageId = `portal-${Date.now()}`;

        const a2aRes = await fetch(a2aUrl, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: messageId,
            method: 'message/stream',
            params: {
              configuration: { blocking: true, acceptedOutputModes: [] },
              message: {
                kind: 'message',
                messageId,
                role: 'user',
                parts: [{ kind: 'text', text: trimmedMsg }],
              },
            },
          })
        });

        if (a2aRes.ok) {
          const sseText = await a2aRes.text();
          let fullText = '';
          const lines = sseText.split('\n');

          let finalResponseText = '';
          let dataResultText = '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                const event = json.result || json;
                if (event.artifact?.parts) {
                  for (const part of event.artifact.parts) {
                    if (part.text) {
                      if (event.artifact.name === 'Final response') {
                        finalResponseText += (finalResponseText ? '\n\n' : '') + part.text;
                      } else {
                        dataResultText += (dataResultText ? '\n\n' : '') + part.text;
                      }
                    }
                  }
                }
              } catch (_) {}
            }
          }

          const chosen = finalResponseText.trim() || dataResultText.trim();
          if (chosen) {
            agentReply = chosen;
          }
        } else {
          console.warn('[Cloud Run fpa-a2a-agent] Resposta HTTP não autorizada:', a2aRes.status, await a2aRes.text());
        }
      } catch (a2aErr) {
        console.warn('[Cloud Run fpa-a2a-agent] Falha ao consultar agente A2A:', a2aErr);
      }
    }

    // 2. TENTATIVA 2: Vertex AI Search nos motores corporativos da V.tal
    if (!agentReply && defaultCredentials) {
      try {
        const auth = new GoogleAuth({
          credentials: defaultCredentials as never,
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = (await client.getAccessToken()).token;

        if (token) {
          const projectNum = '626253571564';
          const engines = [
            { id: 'busca-fpa-financeiro_1781900529276', label: 'Repositório Financeiro GCS' },
            { id: 'busca-fpa-bigquery_1781901951414', label: 'DRE Executiva BigQuery' }
          ];

          for (const eng of engines) {
            const searchEndpoint = `https://discoveryengine.googleapis.com/v1/projects/${projectNum}/locations/global/collections/default_collection/engines/${eng.id}/servingConfigs/default_search:search`;
            
            const searchRes = await fetch(searchEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                query: trimmedMsg,
                pageSize: 3,
                queryExpansionSpec: { condition: 'AUTO' },
                spellCorrectionSpec: { mode: 'AUTO' },
                contentSearchSpec: {
                  snippetSpec: { returnSnippet: true },
                  summarySpec: {
                    summaryResultCount: 3,
                    includeCitations: true
                  }
                }
              })
            });

            if (searchRes.ok) {
              const data = await searchRes.json();
              const summaryText = data.summary?.summaryText;
              
              if (summaryText && summaryText.trim().length > 0) {
                agentReply = `**Resposta do Agente Vertex AI (${eng.label}):**\n\n${summaryText}`;
                
                if (data.results && data.results.length > 0) {
                  data.results.forEach((r: any) => {
                    const docData = r.document?.derivedStructData || r.document?.structData;
                    const title = docData?.title || r.document?.name?.split('/').pop() || eng.label;
                    const snippet = docData?.snippets?.[0]?.snippet || '';
                    citations.push({ title, snippet: snippet ? snippet.replace(/<[^>]*>/g, '') : undefined });
                  });
                }
                break; // Encontrou resposta satisfatória com resumo LLM
              } else if (data.results && data.results.length > 0 && !agentReply) {
                // Snippets caso não haja summary gerado
                const snippets: string[] = [];
                data.results.forEach((r: any) => {
                  const docData = r.document?.derivedStructData || r.document?.structData;
                  const title = docData?.title || r.document?.name?.split('/').pop() || eng.label;
                  const snippet = docData?.snippets?.[0]?.snippet || '';
                  if (snippet) {
                    snippets.push(`• **${title}**: ${snippet.replace(/<[^>]*>/g, '')}`);
                  }
                  citations.push({ title, snippet: snippet ? snippet.replace(/<[^>]*>/g, '') : undefined });
                });

                if (snippets.length > 0) {
                  agentReply = `**Resultados encontrados no Vertex AI Search (${eng.label}):**\n\n${snippets.join('\n\n')}`;
                  break;
                }
              }
            }
          }
        }
      } catch (discErr) {
        console.warn('[Discovery Engine] Erro ao consultar Vertex AI Search:', discErr);
      }
    }

    // 3. TENTATIVA 3 (SOLUÇÃO IMEDIATA): Consulta em Tempo Real ao BigQuery Oficial
    // A conta de serviço já é Administradora do BigQuery no projeto vtal-fpea-prd!
    if (!agentReply && defaultCredentials) {
      try {
        const bq = getBigQueryClient({ projectId: 'vtal-fpea-prd', credentials: defaultCredentials });
        const lower = trimmedMsg.toLowerCase();

        // Identifica empresa solicitada
        let empresaFilter = '';
        if (companyId === 'nio' || lower.includes('nio')) {
          empresaFilter = "AND (empresa = 'BR20' OR NIO_N1 IS NOT NULL)";
        } else if (companyId === 'vtal' || lower.includes('vtal')) {
          empresaFilter = "AND (empresa = 'BR10' OR empresa = 'BR20')";
        } else if (companyId === 'tecto' || lower.includes('tecto')) {
          empresaFilter = "AND (empresa = 'BR30' OR empresa = 'BR31')";
        }

        // Executa agregação dinâmica no BigQuery
        const bqQuery = `
          SELECT 
            COALESCE(NIO_N1, CLASSIFICACAO_FPA, ARVORE_DF2, 'Outras Despesas') as categoria,
            COALESCE(NIO_N2, NIVEL_2, 'Geral') as subcategoria,
            ROUND(SUM(valor), 2) as total_valor,
            COUNT(*) as total_linhas
          FROM \`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA_IA\`
          WHERE anomes IN ('2026/8', '2026/9')
            AND valor < 0
            AND COALESCE(NIO_N1, CLASSIFICACAO_FPA, '') NOT IN ('0', '', 'SEM_REGRA')
            ${empresaFilter}
          GROUP BY 1, 2
          HAVING total_valor IS NOT NULL
          ORDER BY total_valor ASC
          LIMIT 6
        `;

        const [rows] = await bq.query({ query: bqQuery });

        if (rows && rows.length > 0) {
          const compName = companyId === 'nio' ? 'NIO Fibra' : companyId === 'vtal' ? 'V.tal' : companyId === 'tecto' ? 'Tecto' : 'Consolidado do Grupo';
          
          let responseText = `**Análise BigQuery em Tempo Real · ${compName}**\n\n`;
          responseText += `Principais ofensores de despesas extraídos diretamente da tabela \`vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA_IA\` (competência 2026/08 - 2026/09):\n\n`;

          rows.forEach((r: any, idx: number) => {
            const formatted = formatBRLServer(Number(r.total_valor) || 0);
            responseText += `${idx + 1}. **${r.categoria}** → *${r.subcategoria}*: \`${formatted}\` (${r.total_linhas} lançamentos)\n`;
          });

          responseText += `\n💡 *Dados consultados diretamente no BigQuery oficial com a credencial de serviço. Assim que o administrador conceder a permissão do agente Gemini/Vertex AI, você também poderá conversar diretamente com o modelo em linguagem livre!*`;

          agentReply = responseText;
          citations.push({
            title: 'BigQuery: vtal-fpea-prd.agente_fpa.DRE_FINAL_EXECUTIVA_IA',
            snippet: `Consulta agregada em tempo real para ${compName}`
          });
        }
      } catch (bqErr) {
        console.warn('[BigQuery Live Query] Falha ao rodar consulta:', bqErr);
      }
    }

    if (agentReply) {
      return res.json({
        success: true,
        reply: agentReply,
        citations,
        source: citations[0]?.title || 'bigquery-live'
      });
    }

    // Resposta contextualizada executiva padrão
    const companyNames: Record<string, string> = {
      nio: 'NIO Fibra (Operação FTTH)',
      vtal: 'V.tal (Rede Neutra & Infraestrutura)',
      tecto: 'Tecto Data Centers',
      all: 'Consolidado do Grupo (NIO, V.tal e Tecto)'
    };

    const targetCompany = companyNames[companyId] || 'Operação Selecionada';
    return res.json({
      success: true,
      reply: `Com base nos dados de FP&A de **${targetCompany}**:\n\nA sua solicitação foi recebida. As conexões com o BigQuery e os Agentes do GCP (\`vtal-fpea-prd\`) estão ativas e aguardando as permissões finais do IAM.`,
      citations: [],
      source: 'fpa-lakehouse-assistant'
    });
  } catch (error: any) {
    console.error('[Chat Agent] Erro no processamento:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar chat.' });
  }
});

// Iniciar servidor em desenvolvimento com Vite middlewares ou produção
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NIO Fibra DRE Server] Rodando na porta ${PORT} (${isProd ? 'produção' : 'desenvolvimento'})`);
    // Pré-aquece o cache do BigQuery e das justificativas históricas do GCS em background
    setTimeout(() => {
      fetchBigQueryAutoLoadData().catch((err) => console.warn('[Pre-warm BigQuery]', err));
      (['nio', 'vtal', 'tecto'] as const).forEach((cid) => {
        getCompanyEntriesFast(cid, false).catch((err) => console.warn(`[Pre-warm GCS ${cid}]`, err));
      });
    }, 150);
  });
}

startServer();
