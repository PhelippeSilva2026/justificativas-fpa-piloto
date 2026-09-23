import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';

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
          WHERE DIRETORIA_NIO IS NOT NULL AND AREA_NIO IS NOT NULL AND NIO_N3 IS NOT NULL
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

    const query = `
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
      WHERE DIRETORIA_NIO IS NOT NULL AND AREA_NIO IS NOT NULL AND NIO_N3 IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
      ORDER BY DIRETORIA_NIO, AREA_NIO, NIO_N3
    `;

    const [job] = await bigquery.createQueryJob({ query, location: 'southamerica-east1' }).catch(() =>
      bigquery.createQueryJob({ query })
    );
    const [rows] = await job.getQueryResults();

    const cleanRows = (rows || []).map((row: Record<string, unknown>) => {
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

    console.log(`[Auto-Load] Sincronização automática com sucesso! ${cleanRows.length} linhas agregadas.`);

    return res.json({
      success: true,
      totalRows: cleanRows.length,
      rows: cleanRows,
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
