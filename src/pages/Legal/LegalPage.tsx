import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Scale,
} from 'lucide-react';
import {
  LegalDashboardData,
  LegalFilterOptions,
  LegalFilterState,
} from '../../types/legal';
import { LegalFilterBar } from '../../components/legal/LegalFilterBar';
import { LegalKpiStrip } from '../../components/legal/LegalKpiStrip';
import { LegalGovernanceMatrix } from '../../components/legal/LegalGovernanceMatrix';
import { LegalVendorsPoSection } from '../../components/legal/LegalVendorsPoSection';

interface LegalPageProps {
  onBackToHub: () => void;
}

const INITIAL_FILTERS: LegalFilterState = {
  classificacao: 'ALL',
  diretoria: 'ALL',
  gerencia: 'ALL',
  descricao: 'ALL',
  pais: 'ALL',
  centroCusto: 'ALL',
  fornecedor: 'ALL',
  contaRazao: 'ALL',
  pedidoCompra: 'ALL',
  atribuicao: 'ALL',
  anomes: 'ALL',
  search: '',
  ledgerTipo: 'ACTUAL 2026',
};

function buildLegalQueryParams(
  filters: LegalFilterState,
  debouncedSearch: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.classificacao !== 'ALL') params.set('classificacao', filters.classificacao);
  if (filters.diretoria !== 'ALL') params.set('diretoria', filters.diretoria);
  if (filters.gerencia !== 'ALL') params.set('gerencia', filters.gerencia);
  if (filters.descricao !== 'ALL') params.set('descricao', filters.descricao);
  if (filters.pais !== 'ALL') params.set('pais', filters.pais);
  if (filters.centroCusto !== 'ALL') params.set('centroCusto', filters.centroCusto);
  if (filters.fornecedor !== 'ALL') params.set('fornecedor', filters.fornecedor);
  if (filters.contaRazao !== 'ALL') params.set('contaRazao', filters.contaRazao);
  if (filters.pedidoCompra !== 'ALL') params.set('pedidoCompra', filters.pedidoCompra);
  if (filters.atribuicao !== 'ALL') params.set('atribuicao', filters.atribuicao);
  if (filters.anomes !== 'ALL') params.set('anomes', filters.anomes);
  if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
  return params;
}

export const LegalPage: React.FC<LegalPageProps> = ({ onBackToHub }) => {
  const [filters, setFilters] = useState<LegalFilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [compareScope, setCompareScope] = useState<'ytd' | 'fy'>('ytd');
  const [filterOptions, setFilterOptions] = useState<LegalFilterOptions | null>(null);

  const [dashboard, setDashboard] = useState<LegalDashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/legal/filters', { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          setFilterOptions(json.data);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Legal] Falha ao carregar opções de filtro:', err);
        }
      });
    return () => controller.abort();
  }, [reloadNonce]);

  const dashboardQueryString = useMemo(
    () => buildLegalQueryParams(filters, debouncedSearch).toString(),
    [filters, debouncedSearch]
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsDashboardLoading(true);
    setDashboardError(null);

    fetch(`/api/legal/dashboard?${dashboardQueryString}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar painel de Legal no BigQuery.');
        }
        return json.data as LegalDashboardData;
      })
      .then((data) => {
        setDashboard(data);
        setIsDashboardLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setDashboardError(err?.message || 'Falha ao consultar BigQuery.');
        setIsDashboardLoading(false);
      });

    return () => controller.abort();
  }, [dashboardQueryString, reloadNonce]);

  const handlePatchFilters = useCallback((patch: Partial<LegalFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = {
        classificacao: filters.classificacao !== 'ALL' ? filters.classificacao : undefined,
        diretoria: filters.diretoria !== 'ALL' ? filters.diretoria : undefined,
        gerencia: filters.gerencia !== 'ALL' ? filters.gerencia : undefined,
        descricao: filters.descricao !== 'ALL' ? filters.descricao : undefined,
        pais: filters.pais !== 'ALL' ? filters.pais : undefined,
        centroCusto: filters.centroCusto !== 'ALL' ? filters.centroCusto : undefined,
        fornecedor: filters.fornecedor !== 'ALL' ? filters.fornecedor : undefined,
        contaRazao: filters.contaRazao !== 'ALL' ? filters.contaRazao : undefined,
        pedidoCompra: filters.pedidoCompra !== 'ALL' ? filters.pedidoCompra : undefined,
        atribuicao: filters.atribuicao !== 'ALL' ? filters.atribuicao : undefined,
        anomes: filters.anomes !== 'ALL' ? filters.anomes : undefined,
        search: debouncedSearch.trim() || undefined,
        ledgerTipo: filters.ledgerTipo,
      };
      const res = await fetch('/api/legal/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || 'Erro ao gerar planilha Excel de Legal.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Legal_Governanca_Razao_2026.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Erro ao exportar Excel.');
    } finally {
      setIsExporting(false);
    }
  }, [filters, debouncedSearch]);

  return (
    <div className="min-h-full bg-[#F4F6F4] text-[#1E3A32]">
      <div className="w-full px-5 sm:px-7 lg:px-8 py-6 flex flex-col space-y-6 pb-12">
        {/* Cabeçalho executivo da página */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#52605A] hover:text-[#1E3A32] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar à Plataforma Financeira</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#315F52] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Scale className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E3A32] tracking-tight truncate">
                  Legal
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Alternância YTD vs FY para cálculo de Disponível */}
            <div className="inline-flex items-center p-1 bg-white border border-[#D5DCD2] rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setCompareScope('ytd')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  compareScope === 'ytd'
                    ? 'bg-[#315F52] text-white'
                    : 'text-[#52605A] hover:text-[#1E3A32]'
                }`}
              >
                Base YTD
              </button>
              <button
                type="button"
                onClick={() => setCompareScope('fy')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  compareScope === 'fy'
                    ? 'bg-[#315F52] text-white'
                    : 'text-[#52605A] hover:text-[#1E3A32]'
                }`}
              >
                Base FY 2026
              </button>
            </div>

            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={isDashboardLoading}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold text-[#1E3A32] bg-white hover:bg-[#FAFBF9] border border-[#D5DCD2] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#315F52] ${isDashboardLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-bold text-white bg-[#315F52] hover:bg-[#274D42] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Gerando .xlsx...' : 'Exportar Excel (.xlsx)'}</span>
            </button>
          </div>
        </header>

        {exportError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-xs text-rose-800 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* Barra de Filtros */}
        <LegalFilterBar
          filters={filters}
          options={filterOptions}
          onChange={handlePatchFilters}
          onReset={handleResetFilters}
        />

        {/* Estado de erro ou carregamento */}
        {dashboardError ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-800">
                Erro ao consultar base de Legal no BigQuery
              </h3>
              <p className="text-xs text-rose-700 mt-1">{dashboardError}</p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="mt-3 px-3 py-1.5 text-xs font-bold bg-[#315F52] hover:bg-[#274D42] text-white rounded-lg cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : isDashboardLoading && !dashboard ? (
          <div className="bg-white border border-[#D5DCD2] rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#315F52]" />
            <p className="text-xs font-semibold text-[#52605A]">
              Consolidando dados de Legal (BGT, ACTUAL, FCST 8+4/4+8)...
            </p>
          </div>
        ) : dashboard ? (
          <>
            {/* KPIs Executivos */}
            <LegalKpiStrip
              summary={dashboard.summary}
              maxActMonth={dashboard.maxActMonth}
              compareScope={compareScope}
            />

            {/* Tabela Hierárquica Executiva: Diretoria (drill-down Gerência), Gerência, Descrição e Classificação FP&A */}
            <LegalGovernanceMatrix
              byDiretoria={dashboard.byDiretoria}
              byGerencia={dashboard.byGerencia}
              byDescricao={dashboard.byDescricao}
              byClassification={dashboard.byClassification}
              refMonth={dashboard.refMonth}
              filters={filters}
              onSelectFilter={handlePatchFilters}
            />

            {/* Fornecedores, Pedidos/Contratos e Análise de Atribuição & Texto */}
            <LegalVendorsPoSection
              bySupplier={dashboard.bySupplier}
              byPurchaseOrder={dashboard.byPurchaseOrder}
              byTextAtribuicao={dashboard.byTextAtribuicao}
              filters={filters}
              onSelectFilter={handlePatchFilters}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default LegalPage;
