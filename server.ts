import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';
import {
  generateExecutiveWordReport,
  type FinancialReportRow,
  type PhysicalReportRow,
  type ReportCompanyId,
} from './server/wordReport';

dotenv.config();

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
        const hasPontoFocal = colNames.includes('ponto_focal_financeiro_nio');

        // Priorizar a coluna RESPONSAVEL_NIO conforme solicitado
        const respCol = hasResponsavel && hasPontoFocal
          ? 'TRIM(COALESCE(RESPONSAVEL_NIO, PONTO_FOCAL_FINANCEIRO_NIO, "Não informado")) AS RESPONSAVEL_NIO'
          : hasResponsavel
          ? 'TRIM(COALESCE(RESPONSAVEL_NIO, "Não informado")) AS RESPONSAVEL_NIO'
          : hasPontoFocal
          ? 'TRIM(COALESCE(PONTO_FOCAL_FINANCEIRO_NIO, "Não informado")) AS RESPONSAVEL_NIO'
          : '"Não informado" AS RESPONSAVEL_NIO';

        const n1Col = hasN1 ? 'COALESCE(NIO_N1, "Custos & Despesas")' : '"Custos & Despesas"';
        const n2Col = hasN2 ? 'COALESCE(NIO_N2, "Operacional")' : '"Operacional"';

        query = `
          SELECT
            TRIM(COALESCE(DIRETORIA_NIO, 'Diretoria Geral')) AS DIRETORIA_NIO,
            TRIM(COALESCE(AREA_NIO, 'Área Geral')) AS AREA_NIO,
            ${respCol},
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
          GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
          ORDER BY DIRETORIA_NIO, AREA_NIO, NIO_N3
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
// Rota 2.2: Carregamento Automático Direto da Tabela no Início
// -------------------------------------------------------------
app.get('/api/gcp/auto-load', async (req: Request, res: Response) => {
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

    const hasResponsavel = colNames.includes('responsavel_nio');
    const hasPontoFocal = colNames.includes('ponto_focal_financeiro_nio');

    const respCol = hasResponsavel && hasPontoFocal
      ? 'TRIM(COALESCE(RESPONSAVEL_NIO, PONTO_FOCAL_FINANCEIRO_NIO, "Não informado")) AS RESPONSAVEL_NIO'
      : hasResponsavel
      ? 'TRIM(COALESCE(RESPONSAVEL_NIO, "Não informado")) AS RESPONSAVEL_NIO'
      : hasPontoFocal
      ? 'TRIM(COALESCE(PONTO_FOCAL_FINANCEIRO_NIO, "Não informado")) AS RESPONSAVEL_NIO'
      : '"Não informado" AS RESPONSAVEL_NIO';

    const hasN1 = colNames.includes('nio_n1');
    const hasN2 = colNames.includes('nio_n2');
    const n1Col = hasN1 ? 'COALESCE(NIO_N1, "Custos & Despesas")' : '"Custos & Despesas"';
    const n2Col = hasN2 ? 'COALESCE(NIO_N2, "Operacional")' : '"Operacional"';

    const nioQuery = `
      SELECT
        TRIM(COALESCE(DIRETORIA_NIO, 'Diretoria Geral')) AS DIRETORIA_NIO,
        TRIM(COALESCE(AREA_NIO, 'Área Geral')) AS AREA_NIO,
        ${respCol},
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
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
      ORDER BY DIRETORIA_NIO, AREA_NIO, NIO_N3
    `;

    const corporateQuery = `
      SELECT
        '-' AS DIRETORIA_NIO,
        TRIM(COALESCE(AREA, '-')) AS AREA_NIO,
        TRIM(COALESCE(NIVEL_4, '-')) AS RESPONSAVEL_NIO,
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
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 10
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

    return res.json({
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
    });
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

// Salva uma linha em um único JSON acumulado. Cada mês ocupa uma chave em `periods`.
// A condição de geração impede que duas gravações concorrentes apaguem alterações.
app.post('/api/gcp/justifications/save-row', async (req: Request, res: Response) => {
  try {
    const { companyId = 'nio', period = '', row, justifications, user = 'Usuário da aplicação' } = req.body;
    if (!row || !row.id || !justifications || !period) {
      return res.status(400).json({ success: false, message: 'Linha, mês e justificativas são obrigatórios.' });
    }

    const bucketName = sharedJustificationsBucket();
    const objectPath = buildRowStoragePath(companyId, row);
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
          companyId,
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
            metadata: { companyId, rowId: String(row.id), updatedAt },
          },
        });
        return res.json({ success: true, bucket: bucketName, objectPath, period, updatedAt });
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

// Carrega todas as linhas persistidas de uma empresa e devolve o mesmo mapa usado pela tela.
app.get('/api/gcp/justifications/load-company', async (req: Request, res: Response) => {
  try {
    const companyId = safeObjectSegment(req.query.companyId || 'nio', 'nio');
    const period = String(req.query.period || '');
    const bucketName = sharedJustificationsBucket();
    const storage = getStorageClient({ projectId: process.env.GCP_PROJECT_ID || 'vtal-fpea-prd' });
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `justificativas/${companyId}/` });
    const entries = await Promise.all(files.map(async (file) => {
      try {
        const [contents] = await file.download();
        return JSON.parse(contents.toString('utf-8')) as Record<string, unknown>;
      } catch {
        return null;
      }
    }));

    const justifications: Record<string, unknown> = {};
    for (const entry of entries) {
      if (!entry?.rowId) continue;
      const periods = entry.periods && typeof entry.periods === 'object'
        ? entry.periods as Record<string, unknown>
        : {};
      const selected = period ? periods[period] : undefined;
      if (selected) {
        justifications[String(entry.rowId)] = selected;
      } else if (entry.justifications && (!period || entry.period === period)) {
        justifications[String(entry.rowId)] = entry.justifications;
      }
    }

    return res.json({
      success: true,
      source: 'gcp_bucket',
      bucket: bucketName,
      totalRows: Object.keys(justifications).length,
      justifications,
    });
  } catch (error: unknown) {
    console.error('[Justificativas] Falha ao carregar empresa do Bucket:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao carregar justificativas.',
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
  if (clean.includes('ACTUAL') || clean.includes('REAL') || clean === 'R' || clean.startsWith('ACT')) return 'real';
  if (clean.includes('BUDGET') || clean.includes('ORCAD') || clean.includes('ORCAMENT') || clean.includes('PLAN') || clean.includes('META') || clean.includes('FORECAST') || clean === 'B' || clean.startsWith('ORC')) return 'budget';
  return 'other';
};

async function loadReportJustifications(companyId: ReportCompanyId, period: string) {
  const storage = getStorageClient({ projectId: process.env.GCP_PROJECT_ID || 'vtal-fpea-prd' });
  const [files] = await storage.bucket(sharedJustificationsBucket()).getFiles({ prefix: `justificativas/${companyId}/` });
  const result: Record<string, Record<string, unknown>> = {};
  await Promise.all(files.map(async (file) => {
    try {
      const [contents] = await file.download();
      const entry = JSON.parse(contents.toString('utf-8')) as Record<string, unknown>;
      if (!entry.rowId) return;
      const periods = entry.periods && typeof entry.periods === 'object'
        ? entry.periods as Record<string, Record<string, unknown>> : {};
      const selected = periods[period] || ((!entry.period || entry.period === period) ? entry.justifications : undefined);
      if (selected && typeof selected === 'object') result[String(entry.rowId)] = selected as Record<string, unknown>;
    } catch (error) {
      console.warn(`[Word] Justificativa ignorada em ${file.name}:`, error);
    }
  }));
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
      ? 'DIRETORIA_NIO IS NOT NULL AND AREA_NIO IS NOT NULL AND NIO_N3 IS NOT NULL'
      : companyId === 'tecto'
        ? "TRIM(NIVEL_2) = 'Tecto' AND AREA IS NOT NULL AND CLASSIFICACAO_FPA IS NOT NULL"
        : "TRIM(NIVEL_2) IN ('V.tal', 'V.tal (LTLA)', 'B2B', 'Mobile Solutions', 'UmTelecom') AND AREA IS NOT NULL AND CLASSIFICACAO_FPA IS NOT NULL";
    const dimensions = companyId === 'nio'
      ? `TRIM(COALESCE(DIRETORIA_NIO, 'Diretoria Geral')) AS diretoria,
         TRIM(COALESCE(AREA_NIO, 'Área Geral')) AS area,
         TRIM(${nioResponsibleColumn}) AS responsavel,
         TRIM(COALESCE(NIO_N1, 'Custos & Despesas')) AS n1,
         TRIM(COALESCE(NIO_N2, 'Operacional')) AS n2,
         TRIM(COALESCE(NIO_N3, 'Item DRE')) AS n3`
      : `'-' AS diretoria,
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
      GROUP BY 1,2,3,4,5,6,7,8`;
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
      diretoria: string; area: string; responsavel: string; n1: string; n2: string; n3: string;
    };
    const financialMap = new Map<string, Acc>();
    for (const row of rawFinancial) {
      const dims = ['diretoria', 'area', 'responsavel', 'n1', 'n2', 'n3'].map((key) => String(row[key] ?? '-'));
      const key = dims.join('|');
      const acc = financialMap.get(key) || {
        diretoria: dims[0], area: dims[1], responsavel: dims[2], n1: dims[3], n2: dims[4], n3: dims[5],
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
      .filter((row) => Math.abs(row.realCurrent) >= 0.01 || Math.abs(row.budgetCurrent) >= 0.01)
      .map((row) => ({
        id: stableReportRowId([row.diretoria, row.area, row.responsavel, row.n1, row.n2, row.n3]),
        classification: row.n3, area: row.area, level3: row.n1, level4: row.responsavel,
        realCurrent: row.realCurrent, budgetCurrent: row.budgetCurrent,
        realYtd: row.realYtd, budgetYtd: row.budgetYtd,
      }));

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
  });
}

startServer();
