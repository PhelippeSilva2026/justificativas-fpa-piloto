import { createHash } from 'crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';

const projectId = process.env.GCP_PROJECT_ID || 'vtal-fpea-prd';
const bucketName = process.env.GCP_BUCKET_NAME || 'vtal-bucket-financeiro-prd';
const datasetId = process.env.JUSTIFICATIONS_BQ_DATASET || '419556';
const tableId = process.env.JUSTIFICATIONS_BQ_HISTORY_TABLE || 'JUSTIFICATIVAS_FPA_BUCKET_HIST';

const storage = new Storage({ projectId });
const bigquery = new BigQuery({ projectId });

type JsonObject = Record<string, unknown>;
type Impact = { id?: unknown; name?: unknown; value?: unknown; justification?: unknown };

const companyName = (id: string) => {
  if (id.toLowerCase() === 'nio') return 'NIO';
  if (id.toLowerCase() === 'vtal') return 'V.tal';
  if (id.toLowerCase() === 'tecto') return 'Tecto';
  return id;
};

const periodDate = (period: string) => {
  const match = period.match(/^(\d{4})[\/-](\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${String(month).padStart(2, '0')}-01`;
};

function flattenFile(objectPath: string, payload: JsonObject) {
  const companyId = String(payload.companyId || objectPath.split('/')[1] || '').toLowerCase();
  const row = payload.row && typeof payload.row === 'object' ? payload.row as JsonObject : {};
  const periods = payload.periods && typeof payload.periods === 'object'
    ? payload.periods as Record<string, JsonObject>
    : {};
  const metadataMap = payload.periodMetadata && typeof payload.periodMetadata === 'object'
    ? payload.periodMetadata as Record<string, JsonObject>
    : {};
  const result: Array<{ insertId: string; json: JsonObject }> = [];

  for (const [period, periodPayload] of Object.entries(periods)) {
    const anomes = periodDate(period);
    if (!anomes || !periodPayload || typeof periodPayload !== 'object') continue;
    const metadata = metadataMap[period] || {};
    const updatedAt = String(metadata.updatedAt || payload.updatedAt || new Date(0).toISOString());
    const updatedBy = String(metadata.updatedBy || payload.updatedBy || 'Carga histórica');
    const snapshotId = createHash('sha256')
      .update(`${companyId}|${payload.rowId}|${period}|${updatedAt}`)
      .digest('hex');
    const groups = [
      ['momImpacts', 'MOM_VS_MES_ANTERIOR'],
      ['vsOrcadoImpacts', 'MES_VS_ORCADO'],
      ['ytdImpacts', 'YTD_VS_ORCADO'],
    ] as const;
    let impactCount = 0;

    for (const [key, comparison] of groups) {
      const impacts = Array.isArray(periodPayload[key]) ? periodPayload[key] as Impact[] : [];
      for (const impact of impacts) {
        impactCount += 1;
        const number = Number(impact.value);
        const json: JsonObject = {
          SNAPSHOT_ID: snapshotId,
          COMPANY_ID: companyId,
          EMPRESA: companyName(companyId),
          ROW_ID: String(payload.rowId || ''),
          CLASSIFICACAO_FPA: String(payload.classification || row.n3 || ''),
          DIRETORIA: String(row.diretoria || '-'),
          AREA: String(row.area || '-'),
          NIVEL_2: String(row.nivel2 || '-'),
          NIVEL_3: String(row.nivel3 || '-'),
          NIVEL_4: String(row.nivel4 || '-'),
          ANOMES: anomes,
          PERIODO: period,
          TIPO_COMPARACAO: comparison,
          IMPACT_ID: String(impact.id || ''),
          IMPACTO: String(impact.name || ''),
          VALOR: Number.isFinite(number) ? number : 0,
          JUSTIFICATIVA: String(impact.justification || ''),
          UPDATED_AT: updatedAt,
          UPDATED_BY: updatedBy,
          OBJECT_PATH: objectPath,
          IS_EMPTY_SNAPSHOT: false,
        };
        result.push({ insertId: `${snapshotId}-${comparison}-${impact.id || impactCount}`, json });
      }
    }

    if (impactCount === 0) {
      result.push({
        insertId: `${snapshotId}-empty`,
        json: {
          SNAPSHOT_ID: snapshotId,
          COMPANY_ID: companyId,
          EMPRESA: companyName(companyId),
          ROW_ID: String(payload.rowId || ''),
          CLASSIFICACAO_FPA: String(payload.classification || row.n3 || ''),
          DIRETORIA: String(row.diretoria || '-'),
          AREA: String(row.area || '-'),
          NIVEL_2: String(row.nivel2 || '-'),
          NIVEL_3: String(row.nivel3 || '-'),
          NIVEL_4: String(row.nivel4 || '-'),
          ANOMES: anomes,
          PERIODO: period,
          TIPO_COMPARACAO: 'SEM_IMPACTOS',
          IMPACT_ID: '',
          IMPACTO: '',
          VALOR: 0,
          JUSTIFICATIVA: '',
          UPDATED_AT: updatedAt,
          UPDATED_BY: updatedBy,
          OBJECT_PATH: objectPath,
          IS_EMPTY_SNAPSHOT: true,
        },
      });
    }
  }

  return result;
}

async function main() {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'justificativas/' });
  const rows: Array<{ insertId: string; json: JsonObject }> = [];
  let invalidFiles = 0;

  for (let index = 0; index < files.length; index += 10) {
    const batch = await Promise.all(files.slice(index, index + 10).map(async (file) => {
      try {
        const [content] = await file.download();
        return flattenFile(file.name, JSON.parse(content.toString('utf-8')) as JsonObject);
      } catch (error) {
        invalidFiles += 1;
        console.warn(`[Backfill] Arquivo ignorado: ${file.name}`, error);
        return [];
      }
    }));
    rows.push(...batch.flat());
  }

  const table = bigquery.dataset(datasetId).table(tableId);
  for (let index = 0; index < rows.length; index += 400) {
    await table.insert(rows.slice(index, index + 400), { raw: true });
    console.log(`[Backfill] ${Math.min(index + 400, rows.length)} de ${rows.length} registros enviados.`);
  }

  console.log(JSON.stringify({
    bucket: bucketName,
    files: files.length,
    rows: rows.length,
    invalidFiles,
    destination: `${projectId}.${datasetId}.${tableId}`,
  }, null, 2));
}

main().catch((error) => {
  console.error('[Backfill] Falha:', error);
  process.exitCode = 1;
});
