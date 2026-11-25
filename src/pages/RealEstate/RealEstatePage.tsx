import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  RealEstateBuildingSaleRow,
  RealEstateDashboardData,
  RealEstateExcelModelData,
  RealEstateFilterOptions,
  RealEstateFilterState,
  RealEstateLedgerResponse,
  RealEstateUfDrilldownData,
} from '../../types/realEstate';
import { RealEstateFilterBar } from '../../components/realestate/RealEstateFilterBar';
import { RealEstateKpiStrip } from '../../components/realestate/RealEstateKpiStrip';
import { RealEstateBuildingSalesAndPlSection } from '../../components/realestate/RealEstateBuildingSalesAndPlSection';
import { RealEstateMonthlyChart } from '../../components/realestate/RealEstateMonthlyChart';
import { RealEstateUfDrilldown } from '../../components/realestate/RealEstateUfDrilldown';
import { RealEstateBreakdownGrid } from '../../components/realestate/RealEstateBreakdownGrid';
import { RealEstateContractsStationsSection } from '../../components/realestate/RealEstateContractsStationsSection';
import {
  RealEstateLedgerSort,
  RealEstateLedgerTable,
} from '../../components/realestate/RealEstateLedgerTable';
import { RealEstateExcelView } from '../../components/realestate/RealEstateExcelView';

interface RealEstatePageProps {
  onBackToHub: () => void;
}

type ViewMode = 'executive' | 'excel';

const INITIAL_FILTERS: RealEstateFilterState = {
  tipo: 'ACTUAL 2026',
  anomes: 'ALL',
  contrato: 'ALL',
  uf: 'ALL',
  ufMode: 'consolidated',
  centroCusto: 'ALL',
  estacao: 'ALL',
  fornecedor: 'ALL',
  pais: 'ALL',
  tipoOperacao: 'ALL',
  tipoRe: 'ALL',
  classificacao: 'ALL',
  search: '',
};

function buildFilterSearchParams(
  filters: RealEstateFilterState,
  debouncedSearch: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tipo', filters.tipo || 'ACTUAL 2026');
  if (filters.anomes !== 'ALL') params.set('anomes', filters.anomes);
  if (filters.contrato !== 'ALL') params.set('contrato', filters.contrato);
  if (filters.uf !== 'ALL') params.set('uf', filters.uf);
  params.set('ufMode', filters.ufMode);
  if (filters.centroCusto !== 'ALL') params.set('centroCusto', filters.centroCusto);
  if (filters.estacao !== 'ALL') params.set('estacao', filters.estacao);
  if (filters.fornecedor !== 'ALL') params.set('fornecedor', filters.fornecedor);
  if (filters.pais !== 'ALL') params.set('pais', filters.pais);
  if (filters.tipoOperacao !== 'ALL') params.set('tipoOperacao', filters.tipoOperacao);
  if (filters.tipoRe !== 'ALL') params.set('tipoRe', filters.tipoRe);
  if (filters.classificacao !== 'ALL') params.set('classificacao', filters.classificacao);
  if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
  return params;
}

export const RealEstatePage: React.FC<RealEstatePageProps> = ({ onBackToHub }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('executive');
  const [filters, setFilters] = useState<RealEstateFilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOptions, setFilterOptions] = useState<RealEstateFilterOptions | null>(null);

  // Estado da Visão Executiva
  const [dashboard, setDashboard] = useState<RealEstateDashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [selectedDrillUf, setSelectedDrillUf] = useState<string>('');
  const [ufDrill, setUfDrill] = useState<RealEstateUfDrilldownData | null>(null);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSort, setLedgerSort] = useState<RealEstateLedgerSort>('valor_abs');
  const [ledger, setLedger] = useState<RealEstateLedgerResponse | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(true);

  // Estado da Visão Excel (Tabela: Análise + Base P&L)
  const [actCutoffMonth, setActCutoffMonth] = useState<number>(10);
  const [includeOverheadCc, setIncludeOverheadCc] = useState<boolean>(true);
  const [excelModel, setExcelModel] = useState<RealEstateExcelModelData | null>(null);
  const [isExcelModelLoading, setIsExcelModelLoading] = useState(false);
  const [excelModelError, setExcelModelError] = useState<string | null>(null);

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
    setLedgerPage(1);
  }, [
    filters.tipo,
    filters.anomes,
    filters.contrato,
    filters.uf,
    filters.ufMode,
    filters.centroCusto,
    filters.estacao,
    filters.fornecedor,
    filters.pais,
    filters.tipoOperacao,
    filters.tipoRe,
    filters.classificacao,
    debouncedSearch,
    ledgerSort,
  ]);

  // Opções de filtros conforme cenário (TIPO) selecionado
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/real-estate/filters?tipo=${encodeURIComponent(filters.tipo)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          setFilterOptions(json.data);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Real Estate] Falha ao carregar opções de filtro:', err);
        }
      });
    return () => controller.abort();
  }, [filters.tipo, reloadNonce]);

  const filterQueryString = useMemo(
    () => buildFilterSearchParams(filters, debouncedSearch).toString(),
    [filters, debouncedSearch]
  );

  // Dashboard Visão Executiva
  useEffect(() => {
    if (viewMode !== 'executive') return;

    const controller = new AbortController();
    setIsDashboardLoading(true);
    setDashboardError(null);

    fetch(`/api/real-estate/dashboard?${filterQueryString}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar painel de Real Estate no BigQuery.');
        }
        return json.data as RealEstateDashboardData;
      })
      .then((data) => {
        setDashboard(data);
        setIsDashboardLoading(false);

        setSelectedDrillUf((prev) => {
          if (filters.uf !== 'ALL') return filters.uf;
          if (prev && data.byUf.some((u) => u.uf === prev)) return prev;
          const firstValidUf =
            data.byUf.find((u) => u.uf !== 'Sem UF')?.uf || data.byUf[0]?.uf || '';
          return firstValidUf;
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setDashboardError(err?.message || 'Falha ao consultar BigQuery.');
        setIsDashboardLoading(false);
      });

    return () => controller.abort();
  }, [viewMode, filterQueryString, filters.uf, reloadNonce]);

  // Drill-down por UF
  useEffect(() => {
    if (viewMode !== 'executive') return;
    if (!selectedDrillUf) {
      setUfDrill(null);
      return;
    }

    const controller = new AbortController();
    setIsDrillLoading(true);

    const params = buildFilterSearchParams(filters, debouncedSearch);
    params.set('uf', selectedDrillUf);

    fetch(`/api/real-estate/uf-drill?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar detalhamento da UF.');
        }
        return json.data as RealEstateUfDrilldownData;
      })
      .then((data) => {
        setUfDrill(data);
        setIsDrillLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setIsDrillLoading(false);
      });

    return () => controller.abort();
  }, [viewMode, selectedDrillUf, filters, debouncedSearch, reloadNonce]);

  // Razão contábil paginado
  useEffect(() => {
    if (viewMode !== 'executive') return;

    const controller = new AbortController();
    setIsLedgerLoading(true);

    const params = buildFilterSearchParams(filters, debouncedSearch);
    params.set('page', String(ledgerPage));
    params.set('pageSize', '50');
    params.set('sortBy', ledgerSort);

    fetch(`/api/real-estate/ledger?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar razão contábil.');
        }
        return json.data as RealEstateLedgerResponse;
      })
      .then((data) => {
        setLedger(data);
        setIsLedgerLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setIsLedgerLoading(false);
      });

    return () => controller.abort();
  }, [viewMode, filters, debouncedSearch, ledgerPage, ledgerSort, reloadNonce]);

  // Dados da Visão Excel (Aba Análise + Aba Base P&L)
  useEffect(() => {
    const controller = new AbortController();
    setIsExcelModelLoading(true);
    setExcelModelError(null);

    const params = new URLSearchParams({
      actCutoffMonth: String(actCutoffMonth),
      includeOverheadCc: String(includeOverheadCc),
    });

    fetch(`/api/real-estate/excel-model?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar modelo P&L de Real Estate.');
        }
        return json.data as RealEstateExcelModelData;
      })
      .then((data) => {
        setExcelModel(data);
        setIsExcelModelLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setExcelModelError(err?.message || 'Falha ao carregar modelo Excel no BigQuery.');
        setIsExcelModelLoading(false);
      });

    return () => controller.abort();
  }, [actCutoffMonth, includeOverheadCc, reloadNonce]);

  const handleChangeFilter = useCallback(
    <K extends keyof RealEstateFilterState>(key: K, value: RealEstateFilterState[K]) => {
      setFilters((prev) => {
        if (key === 'tipo') {
          return {
            ...INITIAL_FILTERS,
            tipo: String(value),
          };
        }
        return { ...prev, [key]: value };
      });
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setDebouncedSearch('');
  }, []);

  const handleToggleValue = useCallback(
    (
      key:
        | 'contrato'
        | 'estacao'
        | 'centroCusto'
        | 'fornecedor'
        | 'uf'
        | 'pais'
        | 'classificacao',
      value: string
    ) => {
      setFilters((prev) => ({
        ...prev,
        [key]: prev[key] === value ? 'ALL' : value,
      }));
    },
    []
  );

  const handleSelectBuildingFilter = useCallback((row: RealEstateBuildingSaleRow) => {
    if (row.contrato && row.contrato !== '—') {
      setFilters((prev) => ({
        ...prev,
        contrato: prev.contrato === row.contrato ? 'ALL' : row.contrato,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        search: prev.search.toUpperCase() === row.imovel.toUpperCase() ? '' : row.imovel,
      }));
    }
  }, []);

  const handleSelectPlLeafFilter = useCallback((leafKey: string) => {
    const classifMap: Record<string, string> = {
      rev_venda_predios: 'Real Estate - Venda de Prédios',
      rev_locacoes: 'Real Estate Revenue',
      rentals_ifrs16: 'RE Opex - IFRS16',
      rentals_iptu: 'Tax - Other Tax Real Estate',
      fac_manutencao: 'RE Opex - Maintenance',
      fac_limpeza: 'RE Opex - Cleaning',
      pdd_projetada: 'PDD V.tal',
      ex_brasil: 'International Connectivity - Real Estate',
      ovh_consultoria: 'Finanças - Consultorias',
      ovh_bpo: 'BPO',
    };
    const targetClassif = classifMap[leafKey];
    if (targetClassif) {
      setFilters((prev) => ({
        ...prev,
        classificacao: prev.classificacao === targetClassif ? 'ALL' : targetClassif,
      }));
    }
  }, []);

  const handleExportExecutiveExcel = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const body = {
        tipo: filters.tipo,
        anomes: filters.anomes !== 'ALL' ? filters.anomes : undefined,
        contrato: filters.contrato !== 'ALL' ? filters.contrato : undefined,
        uf: filters.uf !== 'ALL' ? filters.uf : undefined,
        ufMode: filters.ufMode,
        centroCusto: filters.centroCusto !== 'ALL' ? filters.centroCusto : undefined,
        estacao: filters.estacao !== 'ALL' ? filters.estacao : undefined,
        fornecedor: filters.fornecedor !== 'ALL' ? filters.fornecedor : undefined,
        pais: filters.pais !== 'ALL' ? filters.pais : undefined,
        tipoOperacao: filters.tipoOperacao !== 'ALL' ? filters.tipoOperacao : undefined,
        tipoRe: filters.tipoRe !== 'ALL' ? filters.tipoRe : undefined,
        classificacao: filters.classificacao !== 'ALL' ? filters.classificacao : undefined,
        search: debouncedSearch.trim() || undefined,
      };

      const res = await fetch('/api/real-estate/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || 'Não foi possível gerar o Excel de Real Estate.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Real_Estate_${filters.tipo.replace(/\s+/g, '_')}_Razao.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar planilha.';
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  }, [filters, debouncedSearch]);

  const handleExportModelExcel = useCallback(
    async (excelSign: boolean) => {
      setIsExporting(true);
      setExportError(null);
      try {
        const res = await fetch('/api/real-estate/export-model-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actCutoffMonth,
            includeOverheadCc,
            excelSign,
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson?.message || 'Erro ao exportar modelo P&L.');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Real_Estate_Modelo_Base_PL_2026.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao exportar modelo.';
        setExportError(msg);
      } finally {
        setIsExporting(false);
      }
    },
    [actCutoffMonth, includeOverheadCc]
  );

  return (
    <div className="w-full min-h-full bg-[#F4F6F4] px-5 sm:px-7 lg:px-8 py-6 flex flex-col space-y-6 pb-12">
      {/* Cabeçalho executivo + alternância Visão Executiva / Visão Excel (Tabela) */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#52605A] hover:text-[#1E3A32] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar à Plataforma Financeira</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#315F52] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E3A32] tracking-tight">
                Real Estate — Imóveis, Venda de Prédios &amp; P&amp;L 2026
              </h1>
              <p className="text-xs sm:text-sm text-[#52605A]">
                Aberturas P&amp;L de Real Estate, imóveis alienados (Venda de Prédios) e Visão Excel (Análise + Base P&amp;L) direto do BigQuery.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor Visão Executiva vs Visão Excel */}
          <div className="inline-flex rounded-xl bg-white p-1 border border-[#D5DCD2] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('executive')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'executive'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Visão Executiva</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('excel')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'excel'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Visão Excel (Tabela)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={isDashboardLoading || isExcelModelLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#D5DCD2] bg-white hover:bg-[#FAFBF9] text-xs font-bold text-[#1E3A32] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#315F52] ${
                isDashboardLoading || isExcelModelLoading ? 'animate-spin' : ''
              }`}
            />
            <span>Atualizar</span>
          </button>

          {viewMode === 'executive' && (
            <button
              type="button"
              onClick={handleExportExecutiveExcel}
              disabled={isExporting || isDashboardLoading}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#315F52] hover:bg-[#274D42] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Gerando Excel...' : 'Exportar Razão (.xlsx)'}</span>
            </button>
          )}
        </div>
      </header>

      {(dashboardError || exportError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-rose-800">{dashboardError || exportError}</span>
          <button
            type="button"
            onClick={() => {
              setExportError(null);
              setReloadNonce((n) => n + 1);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#315F52] text-white font-bold cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {viewMode === 'excel' ? (
        <RealEstateExcelView
          data={excelModel}
          isLoading={isExcelModelLoading}
          error={excelModelError}
          actCutoffMonth={actCutoffMonth}
          includeOverheadCc={includeOverheadCc}
          onChangeCutoffMonth={setActCutoffMonth}
          onChangeIncludeOverheadCc={setIncludeOverheadCc}
          onRetry={() => setReloadNonce((n) => n + 1)}
          onExportModelExcel={handleExportModelExcel}
          isExporting={isExporting}
        />
      ) : (
        <>
          <RealEstateFilterBar
            filters={filters}
            options={filterOptions}
            onChangeFilter={handleChangeFilter}
            onResetFilters={handleResetFilters}
            isLoading={isDashboardLoading}
          />

          <RealEstateKpiStrip
            summary={dashboard?.summary || null}
            tipoLabel={filters.tipo}
            isLoading={isDashboardLoading}
          />

          <RealEstateBuildingSalesAndPlSection
            plOpenings={dashboard?.plOpenings || []}
            buildingSales={dashboard?.buildingSales || []}
            activeContrato={filters.contrato}
            activeSearch={filters.search}
            onSelectBuildingFilter={handleSelectBuildingFilter}
            onSelectPlLeafFilter={handleSelectPlLeafFilter}
          />

          <RealEstateMonthlyChart
            monthly={dashboard?.monthly || []}
            selectedAnomes={filters.anomes}
            tipoLabel={filters.tipo}
            onSelectMonth={(anomes) => handleChangeFilter('anomes', anomes)}
          />

          <RealEstateUfDrilldown
            byUf={dashboard?.byUf || []}
            byCountry={dashboard?.byCountry || []}
            ufMode={filters.ufMode}
            activeUfFilter={filters.uf}
            activeCountryFilter={filters.pais}
            selectedDrillUf={selectedDrillUf}
            drillData={ufDrill}
            isDrillLoading={isDrillLoading}
            onChangeUfMode={(mode) => handleChangeFilter('ufMode', mode)}
            onSelectDrillUf={setSelectedDrillUf}
            onApplyUfFilter={(uf) => handleChangeFilter('uf', uf)}
            onToggleCountryFilter={(pais) => handleToggleValue('pais', pais)}
            onToggleStationFilter={(st) => handleToggleValue('estacao', st)}
            onToggleContractFilter={(ct) => handleToggleValue('contrato', ct)}
            onToggleCcFilter={(cc) => handleToggleValue('centroCusto', cc)}
            activeStation={filters.estacao}
            activeContract={filters.contrato}
            activeCc={filters.centroCusto}
          />

          <RealEstateBreakdownGrid
            byCostCenter={dashboard?.byCostCenter || []}
            byClassification={dashboard?.byClassification || []}
            bySupplier={dashboard?.bySupplier || []}
            byAccount={dashboard?.byAccount || []}
            activeCc={filters.centroCusto}
            activeClassification={filters.classificacao}
            activeSupplier={filters.fornecedor}
            onToggleCcFilter={(cc) => handleToggleValue('centroCusto', cc)}
            onToggleClassificationFilter={(cl) => handleToggleValue('classificacao', cl)}
            onToggleSupplierFilter={(sup) => handleToggleValue('fornecedor', sup)}
          />

          <RealEstateContractsStationsSection
            byContract={dashboard?.byContract || []}
            byStation={dashboard?.byStation || []}
            activeContract={filters.contrato}
            activeStation={filters.estacao}
            onToggleContractFilter={(ct) => handleToggleValue('contrato', ct)}
            onToggleStationFilter={(st) => handleToggleValue('estacao', st)}
          />

          <RealEstateLedgerTable
            ledger={ledger}
            isLoading={isLedgerLoading}
            sortBy={ledgerSort}
            onChangeSortBy={setLedgerSort}
            onChangePage={setLedgerPage}
          />
        </>
      )}
    </div>
  );
};

export default RealEstatePage;
