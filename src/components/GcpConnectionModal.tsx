import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Upload,
  Layers,
  Sparkles,
  ExternalLink,
  X,
  Code2,
  TableProperties,
  FileText,
  KeyRound,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import {
  GcpBigQueryConfig,
  GcpCloudSqlConfig,
  GcpTestResult,
  GcpConnectionError,
  testBigQueryConnection,
  queryBigQueryTable,
  queryCloudSqlTable,
  convertGcpRowsToWorkbook,
  parseBigQueryExportContent,
  getBigQueryDDLScript,
  getGcpModelSampleData,
  DEFAULT_VTAL_SERVICE_ACCOUNT_JSON,
} from '../utils/gcpConnector';
import { DREWorkbook } from '../types';

interface GcpConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkbookLoaded: (wb: DREWorkbook, sourceName: string) => void;
  currentWorkbook: DREWorkbook | null;
}

type TabType = 'bigquery' | 'bucket' | 'bqupload' | 'cloudsql' | 'demo' | 'ddl';

interface DetailedErrorState {
  message: string;
  detail?: string;
  enableApiUrl?: string | null;
  isMissingCredentials?: boolean;
}

export const GcpConnectionModal: React.FC<GcpConnectionModalProps> = ({
  isOpen,
  onClose,
  onWorkbookLoaded,
  currentWorkbook,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('bigquery');

  // Config Bucket GCP
  const [bucketName, setBucketName] = useState<string>(() => {
    return localStorage.getItem('nio_gcp_bucket_name') || 'fpa-dre-justificativas';
  });
  const [bucketSyncStatus, setBucketSyncStatus] = useState<string | null>(null);
  const [isSavingBucket, setIsSavingBucket] = useState<boolean>(false);
  const [isLoadingBucket, setIsLoadingBucket] = useState<boolean>(false);

  // Config BigQuery
  const [bqConfig, setBqConfig] = useState<GcpBigQueryConfig>(() => {
    const saved = localStorage.getItem('nio_gcp_bq_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          projectId: parsed.projectId && parsed.projectId !== 'vtal-lakehouse-prod' ? parsed.projectId : 'vtal-fpea-prd',
          datasetId: parsed.datasetId || 'agente_fpa',
          tableId: parsed.tableId || 'DRE_FINAL_EXECUTIVA',
          credentialsJson: parsed.credentialsJson && parsed.credentialsJson.trim() ? parsed.credentialsJson : DEFAULT_VTAL_SERVICE_ACCOUNT_JSON,
        };
      } catch {}
    }
    return {
      projectId: 'vtal-fpea-prd',
      datasetId: 'agente_fpa',
      tableId: 'DRE_FINAL_EXECUTIVA',
      filterMonth: '',
      credentialsJson: DEFAULT_VTAL_SERVICE_ACCOUNT_JSON,
      customQuery: '',
    };
  });

  // Config Cloud SQL
  const [sqlConfig, setSqlConfig] = useState<GcpCloudSqlConfig>(() => {
    const saved = localStorage.getItem('nio_gcp_sql_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      host: '34.95.120.45',
      port: '5432',
      database: 'nio_financeiro',
      user: 'postgres',
      password: '',
      tableName: 'dre_nio_consolidado',
      ssl: true,
      customQuery: '',
    };
  });

  // Estado para aba de colagem / export BigQuery
  const [rawExportText, setRawExportText] = useState<string>('');
  const [exportSourceName, setExportSourceName] = useState<string>('Export BigQuery Console');

  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<GcpTestResult | null>(null);
  const [errorDetails, setErrorDetails] = useState<DetailedErrorState | null>(null);
  const [copiedDDL, setCopiedDDL] = useState(false);

  // Salva no LocalStorage sempre que alterar
  useEffect(() => {
    const toSaveBq = { ...bqConfig, credentialsJson: '' };
    localStorage.setItem('nio_gcp_bq_config', JSON.stringify(toSaveBq));
  }, [bqConfig]);

  useEffect(() => {
    const toSaveSql = { ...sqlConfig, password: '' };
    localStorage.setItem('nio_gcp_sql_config', JSON.stringify(toSaveSql));
  }, [sqlConfig]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        setBqConfig((prev) => ({
          ...prev,
          credentialsJson: text,
          projectId: parsed.project_id || prev.projectId,
        }));
        setErrorDetails(null);
      } catch {
        setErrorDetails({
          message: 'O arquivo selecionado não é um JSON de credenciais válido.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExportSourceName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawExportText(text);
      setErrorDetails(null);
    };
    reader.readAsText(file);
  };

  const handleTestBigQuery = async () => {
    setTesting(true);
    setErrorDetails(null);
    setTestResult(null);

    try {
      const res = await testBigQueryConnection(bqConfig);
      setTestResult(res);
    } catch (err: unknown) {
      if (err instanceof GcpConnectionError) {
        setErrorDetails({
          message: err.message,
          detail: err.detail,
          enableApiUrl: err.enableApiUrl,
          isMissingCredentials: err.isMissingCredentials,
        });
      } else {
        setErrorDetails({
          message: err instanceof Error ? err.message : 'Falha ao testar conexão com BigQuery.',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSyncBigQuery = async () => {
    setSyncing(true);
    setErrorDetails(null);

    try {
      const data = await queryBigQueryTable(bqConfig);
      if (!data.rows || data.rows.length === 0) {
        throw new Error('A consulta não retornou nenhuma linha no BigQuery para os filtros informados.');
      }

      console.log(`[BigQuery Sync] Recebidos ${data.rows.length} registros brutos.`);
      const workbook = convertGcpRowsToWorkbook(
        data.rows,
        `GCP BigQuery (${bqConfig.datasetId}.${bqConfig.tableId})`,
        '2026/7',
        '2026/8'
      );

      console.log(`[BigQuery Sync] Mapeadas ${workbook.rows.length} linhas N3 para o período ${workbook.monthCurrent}.`);

      if (workbook.rows.length === 0) {
        throw new Error(
          `Foram retornados ${data.rows.length} registros do BigQuery, mas nenhum pôde ser processado. Verifique se as colunas 'TIPO' e 'anomes' correspondem aos filtros.`
        );
      }

      onWorkbookLoaded(workbook, `GCP BigQuery: ${bqConfig.datasetId}.${bqConfig.tableId}`);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GcpConnectionError) {
        setErrorDetails({
          message: err.message,
          detail: err.detail,
          enableApiUrl: err.enableApiUrl,
          isMissingCredentials: err.isMissingCredentials,
        });
      } else {
        setErrorDetails({
          message: err instanceof Error ? err.message : 'Erro ao sincronizar dados da tabela GCP BigQuery.',
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleProcessExportText = () => {
    setErrorDetails(null);
    try {
      if (!rawExportText.trim()) {
        throw new Error('Cole o conteúdo JSON, NDJSON ou CSV ou selecione um arquivo exportado do BigQuery.');
      }

      const rows = parseBigQueryExportContent(rawExportText);
      const workbook = convertGcpRowsToWorkbook(
        rows,
        exportSourceName || 'BigQuery Export',
        'Jul/2026',
        'Ago/2026'
      );

      onWorkbookLoaded(workbook, `BigQuery Export: ${exportSourceName}`);
      onClose();
    } catch (err: unknown) {
      setErrorDetails({
        message: err instanceof Error ? err.message : 'Erro ao processar dados exportados.',
        detail: 'Certifique-se de que o cabeçalho inclui colunas como n1, n2, n3, real_m_minus_1, real_atual, orcado_atual.',
      });
    }
  };

  const handleSyncCloudSql = async () => {
    setSyncing(true);
    setErrorDetails(null);

    try {
      const data = await queryCloudSqlTable(sqlConfig);
      if (!data.rows || data.rows.length === 0) {
        throw new Error('A tabela do Cloud SQL está vazia ou a consulta não retornou linhas.');
      }

      const workbook = convertGcpRowsToWorkbook(
        data.rows,
        `GCP Cloud SQL (${sqlConfig.database}.${sqlConfig.tableName})`,
        'Jul/2026',
        'Ago/2026'
      );

      onWorkbookLoaded(workbook, `GCP Cloud SQL: ${sqlConfig.database}.${sqlConfig.tableName}`);
      onClose();
    } catch (err: unknown) {
      setErrorDetails({
        message: err instanceof Error ? err.message : 'Erro ao conectar à instância GCP Cloud SQL.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveToBucket = async () => {
    setIsSavingBucket(true);
    setBucketSyncStatus(null);
    setErrorDetails(null);

    try {
      localStorage.setItem('nio_gcp_bucket_name', bucketName);
      const companies = ['nio', 'vtal', 'tecto'] as const;
      let totalSynced = 0;

      for (const cid of companies) {
        const raw = localStorage.getItem(`corp_justifications_${cid}_v1`) || localStorage.getItem('nio_justifications_v1');
        let justObj = {};
        if (raw) {
          try {
            justObj = JSON.parse(raw);
          } catch {}
        }

        const resp = await fetch('/api/gcp/bucket/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucketName,
            companyId: cid,
            justifications: justObj,
            credentialsJson: bqConfig.credentialsJson,
            projectId: bqConfig.projectId,
          }),
        });

        const data = await resp.json();
        if (data.success) {
          totalSynced++;
        }
      }

      setBucketSyncStatus(`Sincronização concluída com sucesso! Justificativas das 3 empresas salvas no Bucket '${bucketName}' com versionamento de auditoria.`);
    } catch (err: unknown) {
      setBucketSyncStatus(`Erro ao salvar no Bucket: ${err instanceof Error ? err.message : 'Falha'}`);
    } finally {
      setIsSavingBucket(false);
    }
  };

  const handleLoadFromBucket = async () => {
    setIsLoadingBucket(true);
    setBucketSyncStatus(null);
    setErrorDetails(null);

    try {
      localStorage.setItem('nio_gcp_bucket_name', bucketName);
      const companies = ['nio', 'vtal', 'tecto'] as const;
      let loadedCount = 0;

      for (const cid of companies) {
        const resp = await fetch(`/api/gcp/bucket/load?companyId=${cid}&bucketName=${encodeURIComponent(bucketName)}&projectId=${encodeURIComponent(bqConfig.projectId)}`);
        const data = await resp.json();
        if (data.success && data.justifications && Object.keys(data.justifications).length > 0) {
          localStorage.setItem(`corp_justifications_${cid}_v1`, JSON.stringify(data.justifications));
          if (cid === 'nio') {
            localStorage.setItem('nio_justifications_v1', JSON.stringify(data.justifications));
          }
          loadedCount += Object.keys(data.justifications).length;
        }
      }

      setBucketSyncStatus(`Leitura realizada com sucesso! Carregadas ${loadedCount} contas justificadas a partir do Bucket '${bucketName}'.`);
    } catch (err: unknown) {
      setBucketSyncStatus(`Erro ao carregar do Bucket: ${err instanceof Error ? err.message : 'Falha'}`);
    } finally {
      setIsLoadingBucket(false);
    }
  };

  const handleLoadDemoModel = () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const sampleGcpRows = getGcpModelSampleData();
      const workbook = convertGcpRowsToWorkbook(
        sampleGcpRows,
        'GCP Lakehouse (Tabela Modelo DRE)',
        'Jul/2026',
        'Ago/2026'
      );
      onWorkbookLoaded(workbook, 'GCP Lakehouse: vtal-lakehouse.financeiro.dre_nio_mensal');
      onClose();
    } catch (err: unknown) {
      setErrorDetails({
        message: err instanceof Error ? err.message : 'Erro ao carregar dados modelo.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const copyDDLToClipboard = () => {
    const ddl = getBigQueryDDLScript(bqConfig.projectId, bqConfig.datasetId, bqConfig.tableId);
    navigator.clipboard.writeText(ddl);
    setCopiedDDL(true);
    setTimeout(() => setCopiedDDL(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#192B1C]/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-[#A7AC98]/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="bg-[#14412A] text-white p-6 flex items-center justify-between border-b border-[#192B1C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#39FF00]/20 flex items-center justify-center border border-[#39FF00]/30 text-[#39FF00]">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#39FF00] uppercase tracking-wider">
                  Google Cloud Platform (GCP)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white">
                  Integração Direta
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Conectar Base à Tabela do GCP
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Conexão */}
        <div className="flex border-b border-[#E5E0D8] bg-[#F6F2EE] px-6 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('bigquery');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bigquery'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <Database className="w-4 h-4 text-[#14412A]" />
            BigQuery API (Ao Vivo)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('bucket');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bucket'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <Cloud className="w-4 h-4 text-[#14412A]" />
            GCP Bucket (Justificativas)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('bqupload');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bqupload'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#14412A]" />
            Colar / Carregar do BigQuery (Sem Chave)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('demo');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'demo'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#22C55E]" />
            Tabela DRE Modelo GCP (1-Clique)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cloudsql');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cloudsql'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <TableProperties className="w-4 h-4 text-[#14412A]" />
            GCP Cloud SQL (Postgres)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ddl');
              setErrorDetails(null);
            }}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ddl'
                ? 'bg-white text-[#14412A] border-t-2 border-[#39FF00] shadow-xs'
                : 'text-[#6E7769] hover:text-[#192B1C]'
            }`}
          >
            <Code2 className="w-4 h-4 text-[#14412A]" />
            Script DDL / Schema
          </button>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Card de Erro Detalhado e Instrutivo */}
          {errorDetails && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-amber-900">
                    {errorDetails.message}
                  </div>
                  {errorDetails.detail && (
                    <div className="text-amber-800 leading-relaxed">
                      {errorDetails.detail}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação para Resolução Rápida */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
                {errorDetails.enableApiUrl && (
                  <a
                    href={errorDetails.enableApiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] transition-colors"
                  >
                    <span>Ativar BigQuery API no Console GCP</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('bqupload');
                    setErrorDetails(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14412A] hover:bg-[#192B1C] text-white font-bold text-[11px] transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-[#39FF00]" />
                  <span>Usar Aba: Colar Resultados do BigQuery (Sem Chave)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadDemoModel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Carregar Tabela Modelo Agora</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: GOOGLE BIGQUERY (API AO VIVO) */}
          {activeTab === 'bigquery' && (
            <div className="space-y-4">
              {/* Box Informativo sobre Autenticação no GCP */}
              <div className="bg-[#14412A]/5 p-4 rounded-2xl border border-[#14412A]/15 text-xs text-[#192B1C] space-y-2">
                <div className="font-bold flex items-center gap-2 text-[#14412A]">
                  <KeyRound className="w-4 h-4 text-[#14412A]" />
                  Como autenticar a tabela do seu projeto corporativo:
                </div>
                <p className="leading-relaxed text-[#6E7769]">
                  O Google Cloud BigQuery exige uma <strong>Chave de Conta de Serviço (JSON)</strong> pertencente ao seu projeto GCP (ex: V.tal / NIO Fibra). Sem essa chave, o conector tenta usar o projeto padrão do contêiner (651648292546), que não possui acesso aos seus dados nem a API ativada.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={`https://console.cloud.google.com/iam-admin/serviceaccounts?project=${bqConfig.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#14412A] font-bold hover:underline"
                  >
                    <span>1. Acessar IAM & Service Accounts no Console GCP</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[#A7AC98]">•</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bqupload')}
                    className="text-[11px] text-[#14412A] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Prefere não gerar chave? Use a aba Colar Resultados</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    GCP Project ID
                  </label>
                  <input
                    type="text"
                    value={bqConfig.projectId}
                    onChange={(e) => setBqConfig({ ...bqConfig, projectId: e.target.value })}
                    placeholder="vtal-lakehouse-prod"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] focus:outline-hidden font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Dataset ID
                  </label>
                  <input
                    type="text"
                    value={bqConfig.datasetId}
                    onChange={(e) => setBqConfig({ ...bqConfig, datasetId: e.target.value })}
                    placeholder="financeiro"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] focus:outline-hidden font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Table ID
                  </label>
                  <input
                    type="text"
                    value={bqConfig.tableId}
                    onChange={(e) => setBqConfig({ ...bqConfig, tableId: e.target.value })}
                    placeholder="dre_nio_consolidado"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] focus:outline-hidden font-mono bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Competência / anomes (Opcional)
                  </label>
                  <input
                    type="text"
                    value={bqConfig.filterMonth || ''}
                    onChange={(e) => setBqConfig({ ...bqConfig, filterMonth: e.target.value })}
                    placeholder="ex: 202608 ou 2026-08 (ou deixe vazio para ler a tabela completa)"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] focus:outline-hidden font-mono bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#14412A] flex items-center gap-1">
                      <span>Chave Service Account (JSON)</span>
                      <span className="text-[10px] text-green-700 font-bold">*Pronta para GCP</span>
                    </label>
                    <label className="text-[11px] text-[#14412A] font-semibold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Carregar .json
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {(() => {
                    let parsedSA: { client_email?: string; project_id?: string } | null = null;
                    if (bqConfig.credentialsJson) {
                      try {
                        const parsed = JSON.parse(bqConfig.credentialsJson);
                        parsedSA = {
                          client_email: parsed.client_email,
                          project_id: parsed.project_id,
                        };
                      } catch {}
                    }

                    if (parsedSA && parsedSA.client_email) {
                      return (
                        <div className="p-3 bg-green-50 border border-green-300 rounded-xl text-green-900 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-green-800">
                              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                              <span>Service Account Identificada:</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBqConfig({ ...bqConfig, credentialsJson: '' })}
                              className="text-[10px] text-red-600 hover:underline font-semibold cursor-pointer"
                            >
                              Trocar chave
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-green-900 truncate" title={parsedSA.client_email}>
                            {parsedSA.client_email}
                          </div>
                          <div className="text-[10px] text-green-700">
                            Projeto: <strong className="font-mono">{parsedSA.project_id || bqConfig.projectId}</strong>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div>
                        <textarea
                          rows={2}
                          value={bqConfig.credentialsJson || ''}
                          placeholder="Cole o conteúdo do arquivo .json da chave ou clique em 'Carregar .json' acima..."
                          onChange={(e) => {
                            const val = e.target.value;
                            let autoProjectId = bqConfig.projectId;
                            try {
                              const p = JSON.parse(val);
                              if (p.project_id) autoProjectId = p.project_id;
                            } catch {}
                            setBqConfig({ ...bqConfig, credentialsJson: val, projectId: autoProjectId });
                          }}
                          className="w-full text-[11px] px-3.5 py-2 rounded-xl border border-[#A7AC98] focus:border-[#14412A] focus:outline-hidden font-mono bg-white"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Modo Query Personalizada */}
              <div className="pt-2 border-t border-[#E5E0D8]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#192B1C]">
                    Consulta SQL Customizada
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomQuery(!useCustomQuery)}
                    className="text-xs text-[#14412A] font-semibold hover:underline cursor-pointer"
                  >
                    {useCustomQuery ? 'Ocultar Editor SQL' : 'Editar Query SQL no BigQuery'}
                  </button>
                </div>

                {useCustomQuery && (
                  <textarea
                    rows={4}
                    value={
                      bqConfig.customQuery ||
                      `SELECT \n  responsavel, n1, n2, n3, \n  real_m_minus_1, real_atual, orcado_atual, real_ytd, orcado_ytd \nFROM \`${bqConfig.projectId}.${bqConfig.datasetId}.${bqConfig.tableId}\` \nWHERE mes_ano = '${bqConfig.filterMonth || '2026-08'}'`
                    }
                    onChange={(e) => setBqConfig({ ...bqConfig, customQuery: e.target.value })}
                    className="w-full text-xs font-mono p-3 rounded-xl border border-[#A7AC98] focus:border-[#14412A] bg-[#192B1C] text-[#39FF00]"
                  />
                )}
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-[#39FF00]/10 border border-[#39FF00]/30 text-xs text-[#14412A]">
                  <div className="flex items-center gap-2 font-bold text-[#14412A] mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                    {testResult.message}
                  </div>
                  {testResult.fields && (
                    <div className="mt-2 text-[11px] text-[#6E7769]">
                      <strong>Colunas detectadas:</strong>{' '}
                      {testResult.fields.map((f) => f.name).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleTestBigQuery}
                  disabled={testing}
                  className="px-4 py-2.5 rounded-full border border-[#14412A] text-[#14412A] hover:bg-[#14412A]/5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
                >
                  {testing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncBigQuery}
                  disabled={syncing}
                  className="px-5 py-2.5 rounded-full bg-[#14412A] text-white hover:bg-[#192B1C] text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {syncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#39FF00]" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-[#39FF00]" />
                  )}
                  <span>{syncing ? 'Sincronizando...' : 'Sincronizar Base do BigQuery'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB BUCKET: GOOGLE CLOUD STORAGE (PERSISTÊNCIA & AUDITORIA DE JUSTIFICATIVAS) */}
          {activeTab === 'bucket' && (
            <div className="space-y-4">
              {/* Header Informativo */}
              <div className="bg-[#14412A]/5 p-4 rounded-2xl border border-[#14412A]/15 text-xs text-[#192B1C] space-y-2">
                <div className="font-bold flex items-center gap-2 text-[#14412A]">
                  <Cloud className="w-4 h-4 text-[#14412A]" />
                  Google Cloud Storage — Armazenamento Corporativo de Justificativas
                </div>
                <p className="leading-relaxed text-[#6E7769]">
                  As justificativas de MoM, Mês vs Orçado e YTD são gravadas diretamente no seu <strong>Bucket do Google Cloud</strong> através da Conta de Serviço (Service Account), sem que os analistas precisem possuir ou vincular contas pessoais do Google.
                </p>
              </div>

              {/* Destaques Arquiteturais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#E5E0D8]">
                  <span className="font-bold text-[#14412A] block mb-1">👥 Zero Login Google</span>
                  <span className="text-[#6E7769] text-[11px]">Autenticação 100% transparente via chave da Conta de Serviço configurada.</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E5E0D8]">
                  <span className="font-bold text-[#14412A] block mb-1">⚡ Acesso Simultâneo</span>
                  <span className="text-[#6E7769] text-[11px]">Arquivos isolados por empresa com versionamento de auditoria em <code>/audit/</code>.</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E5E0D8]">
                  <span className="font-bold text-[#14412A] block mb-1">🏢 Multi-Empresa</span>
                  <span className="text-[#6E7769] text-[11px]">NIO Fibra, V.tal e Tecto Data Centers particionadas individualmente.</span>
                </div>
              </div>

              {/* Formulário do Bucket */}
              <div className="bg-white p-4 rounded-2xl border border-[#D5DCD2] space-y-3">
                <label className="block text-xs font-bold text-[#192B1C]">
                  Nome do Bucket no GCP (Cloud Storage)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value.trim())}
                    placeholder="ex: fpa-dre-justificativas ou vtal-lakehouse-bucket"
                    className="flex-1 text-xs p-2.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] font-mono bg-[#FAFBF9]"
                  />
                </div>
                <p className="text-[11px] text-[#8C9283]">
                  Arquivos particionados: <code>justificativas_nio.json</code>, <code>justificativas_vtal.json</code>, <code>justificativas_tecto.json</code>
                </p>
              </div>

              {/* Status de Sincronização */}
              {bucketSyncStatus && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-300 text-xs text-green-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{bucketSyncStatus}</span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadFromBucket}
                  disabled={isLoadingBucket || isSavingBucket}
                  className="px-4 py-2.5 rounded-full border border-[#14412A] text-[#14412A] hover:bg-[#14412A]/5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
                >
                  {isLoadingBucket ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 rotate-180" />}
                  <span>{isLoadingBucket ? 'Lendo do Bucket...' : 'Carregar Justificativas do Bucket'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToBucket}
                  disabled={isLoadingBucket || isSavingBucket}
                  className="px-5 py-2.5 rounded-full bg-[#14412A] text-white hover:bg-[#192B1C] text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isSavingBucket ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#39FF00]" /> : <Cloud className="w-3.5 h-3.5 text-[#39FF00]" />}
                  <span>{isSavingBucket ? 'Salvando no Bucket...' : 'Salvar Justificativas no Bucket GCP Agora'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COLAR / CARREGAR DO BIGQUERY (SEM NECESSIDADE DE CHAVE PRIVADA) */}
          {activeTab === 'bqupload' && (
            <div className="space-y-4">
              <div className="bg-[#39FF00]/10 p-4 rounded-2xl border border-[#39FF00]/30 text-xs text-[#192B1C] space-y-2">
                <div className="font-bold flex items-center gap-2 text-[#14412A]">
                  <Sparkles className="w-4 h-4 text-[#22C55E]" />
                  Método Mais Rápido & Seguro (Zero Permissões de IAM Necessárias)
                </div>
                <p className="leading-relaxed text-[#192B1C]">
                  Se você não tem permissão para gerar chaves de Service Account na sua conta GCP, basta rodar a consulta no <strong>Console do BigQuery</strong>, clicar em <strong>"Salvar resultados" &gt; "Arquivo JSON" ou "CSV"</strong> (ou copiar os resultados) e colar ou arrastar aqui.
                </p>
              </div>

              <div className="border border-dashed border-[#A7AC98] rounded-2xl p-5 bg-[#F6F2EE]/50 hover:bg-[#F6F2EE] transition-colors">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold text-[#14412A]">
                      Carregar Arquivo Exportado do BigQuery (.json ou .csv)
                    </span>
                    <p className="text-[11px] text-[#6E7769]">
                      Suporta JSON Array, JSON Lines (NDJSON) e CSV exportados diretamente do GCP.
                    </p>
                  </div>

                  <label className="px-4 py-2 rounded-full bg-[#14412A] hover:bg-[#192B1C] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-[#39FF00]" />
                    <span>Selecionar Arquivo</span>
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      className="hidden"
                      onChange={handleExportFileUpload}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#14412A]">
                      Ou cole o texto exportado do BigQuery abaixo:
                    </label>
                    {rawExportText && (
                      <span className="text-[11px] text-green-700 font-semibold">
                        {rawExportText.length.toLocaleString()} caracteres carregados
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={rawExportText}
                    onChange={(e) => setRawExportText(e.target.value)}
                    placeholder={`Exemplo de dados do BigQuery (JSON ou CSV):\n[{"responsavel": "Rede FTTH", "n1": "Custos da Rede", "n2": "O&M", "n3": "Manutenção Óptica", "real_m_minus_1": 4200000, "real_atual": 4800000, "orcado_atual": 4100000, "real_ytd": 33000000, "orcado_ytd": 31000000}]\n\nOu cole o CSV:\nresponsavel,n1,n2,n3,real_m_minus_1,real_atual,orcado_atual,real_ytd,orcado_ytd\nEngenharia,Custos,O&M,Fibra Óptica,4200000,4800000,4100000,33000000,31000000`}
                    className="w-full text-xs font-mono p-3.5 rounded-xl border border-[#A7AC98] focus:border-[#14412A] bg-white text-[#192B1C]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-[#6E7769]">
                  As colunas serão automaticamente mapeadas e normalizadas para a DRE e Waterfall.
                </div>

                <button
                  type="button"
                  onClick={handleProcessExportText}
                  disabled={!rawExportText.trim()}
                  className={`px-6 py-2.5 rounded-full text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                    rawExportText.trim()
                      ? 'bg-[#14412A] text-white hover:bg-[#192B1C]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-[#39FF00]" />
                  <span>Processar e Atualizar DRE Agora</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TABELA MODELO GCP */}
          {activeTab === 'demo' && (
            <div className="space-y-4">
              <div className="bg-[#39FF00]/10 p-5 rounded-2xl border border-[#39FF00]/30">
                <div className="flex items-center gap-2 text-sm font-bold text-[#14412A] mb-1">
                  <Sparkles className="w-5 h-5 text-[#22C55E]" />
                  Carga Imediata: Tabela GCP Lakehouse NIO Fibra
                </div>
                <p className="text-xs text-[#192B1C] leading-relaxed">
                  Carregue instantaneamente a base corporativa estruturada exatamente no padrão do GCP BigQuery
                  com as 8 grandes frentes de custos e receitas da <strong>NIO Fibra</strong> (O&M Rede, Last-Mile,
                  Aluguel de Postes, CPE Wi-Fi 6, GCP Cloud & TI, Mídia/CAC, CX e Pessoal FP&A).
                </p>
              </div>

              <div className="border border-[#E5E0D8] rounded-2xl p-4 bg-white space-y-3">
                <div className="text-xs font-bold text-[#14412A]">
                  Prévia da Estrutura de Colunas do GCP:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-[#6E7769]">
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">responsavel</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">n1 (Macro Grupo)</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">n2 (Categoria)</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">n3 (Subcategoria)</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">real_m_minus_1</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">real_atual</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">orcado_atual</div>
                  <div className="bg-[#F6F2EE] p-2 rounded-lg">real_ytd / orcado_ytd</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-[#6E7769]">
                  Ideal para validação e apresentação sem necessidade de credenciais de produção imediatas.
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoModel}
                  disabled={syncing}
                  className="px-6 py-3 rounded-full bg-[#39FF00] text-[#192B1C] font-extrabold text-xs hover:bg-[#32e000] active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#192B1C]" />
                  <span>Carregar Base GCP Agora</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CLOUD SQL */}
          {activeTab === 'cloudsql' && (
            <div className="space-y-4">
              <div className="bg-[#14412A]/5 p-4 rounded-2xl border border-[#14412A]/10 text-xs text-[#192B1C]">
                Conecte-se diretamente à instância do <strong>GCP Cloud SQL (PostgreSQL ou MySQL)</strong> onde reside a tabela consolidada da DRE.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Host / IP do Cloud SQL
                  </label>
                  <input
                    type="text"
                    value={sqlConfig.host}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, host: e.target.value })}
                    placeholder="34.95.120.45"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Porta
                  </label>
                  <input
                    type="text"
                    value={sqlConfig.port}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, port: e.target.value })}
                    placeholder="5432"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Database
                  </label>
                  <input
                    type="text"
                    value={sqlConfig.database}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, database: e.target.value })}
                    placeholder="nio_financeiro"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={sqlConfig.user}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, user: e.target.value })}
                    placeholder="postgres"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={sqlConfig.password || ''}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#14412A] mb-1">
                    Nome da Tabela
                  </label>
                  <input
                    type="text"
                    value={sqlConfig.tableName}
                    onChange={(e) => setSqlConfig({ ...sqlConfig, tableName: e.target.value })}
                    placeholder="dre_nio_consolidado"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#A7AC98] font-mono bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#14412A]">
                    <input
                      type="checkbox"
                      checked={sqlConfig.ssl}
                      onChange={(e) => setSqlConfig({ ...sqlConfig, ssl: e.target.checked })}
                      className="w-4 h-4 accent-[#14412A] rounded-sm"
                    />
                    <span>Conexão Segura SSL (Recomendado para GCP)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleSyncCloudSql}
                  disabled={syncing}
                  className="px-5 py-2.5 rounded-full bg-[#14412A] text-white hover:bg-[#192B1C] text-xs font-extrabold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {syncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#39FF00]" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-[#39FF00]" />
                  )}
                  <span>{syncing ? 'Conectando...' : 'Consultar e Sincronizar Cloud SQL'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DDL / SCHEMA */}
          {activeTab === 'ddl' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#14412A]">
                    Script SQL (DDL) para criar a tabela no BigQuery
                  </h3>
                  <p className="text-[11px] text-[#6E7769]">
                    Copie e execute no console do Google Cloud Platform (GCP Console &gt; BigQuery &gt; Query Editor).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copyDDLToClipboard}
                  className="px-3.5 py-2 rounded-full bg-[#14412A] text-white hover:bg-[#192B1C] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedDDL ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#39FF00]" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#39FF00]" />
                      <span>Copiar Script SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-[#192B1C] text-[#39FF00] font-mono text-[11px] rounded-2xl overflow-x-auto max-h-[320px] leading-relaxed border border-[#14412A]">
                {getBigQueryDDLScript(bqConfig.projectId, bqConfig.datasetId, bqConfig.tableId)}
              </pre>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-[#F6F2EE] border-t border-[#E5E0D8] px-6 flex items-center justify-between text-xs text-[#6E7769]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>NIO Fibra Telecommunications • Conector Google Cloud Platform</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full hover:bg-white text-[#192B1C] font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
