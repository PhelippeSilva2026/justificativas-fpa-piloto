import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from 'lucide-react';
import {
  EnergyDashboardData,
  EnergyFilterOptions,
  EnergyFilterState,
  EnergyLedgerResponse,
  EnergyUfDrilldownData,
} from '../../types/energy';
import { EnergyFilterBar } from '../../components/energy/EnergyFilterBar';
import { EnergyKpiStrip } from '../../components/energy/EnergyKpiStrip';
import { EnergyMonthlyChart } from '../../components/energy/EnergyMonthlyChart';
import { EnergyUfDrilldown } from '../../components/energy/EnergyUfDrilldown';
import { EnergyBreakdownGrid } from '../../components/energy/EnergyBreakdownGrid';
import { EnergyContractsStationsSection } from '../../components/energy/EnergyContractsStationsSection';
import { EnergyLedgerSort, EnergyLedgerTable } from '../../components/energy/EnergyLedgerTable';

interface EnergyPageProps {
  onBackToHub: () => void;
}

const INITIAL_FILTERS: EnergyFilterState = {
  anomes: 'ALL',
  contrato: 'ALL',
  uf: 'ALL',
  ufMode: 'consolidated',
  centroCusto: 'ALL',
  estacao: 'ALL',
  fornecedor: 'ALL',
  empresa: 'ALL',
  tipoContrato: 'ALL',
  search: '',
};

function buildFilterSearchParams(filters: EnergyFilterState, debouncedSearch: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.anomes !== 'ALL') params.set('anomes', filters.anomes);
  if (filters.contrato !== 'ALL') params.set('contrato', filters.contrato);
  if (filters.uf !== 'ALL') params.set('uf', filters.uf);
  params.set('ufMode', filters.ufMode);
  if (filters.centroCusto !== 'ALL') params.set('centroCusto', filters.centroCusto);
  if (filters.estacao !== 'ALL') params.set('estacao', filters.estacao);
  if (filters.fornecedor !== 'ALL') params.set('fornecedor', filters.fornecedor);
  if (filters.empresa !== 'ALL') params.set('empresa', filters.empresa);
  if (filters.tipoContrato !== 'ALL') params.set('tipoContrato', filters.tipoContrato);
  if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
  return params;
}

export const EnergyPage: React.FC<EnergyPageProps> = ({ onBackToHub }) => {
  const [filters, setFilters] = useState<EnergyFilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOptions, setFilterOptions] = useState<EnergyFilterOptions | null>(null);

  const [dashboard, setDashboard] = useState<EnergyDashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [selectedDrillUf, setSelectedDrillUf] = useState<string>('');
  const [ufDrill, setUfDrill] = useState<EnergyUfDrilldownData | null>(null);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSort, setLedgerSort] = useState<EnergyLedgerSort>('valor_abs');
  const [ledger, setLedger] = useState<EnergyLedgerResponse | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Debounce da busca textual para evitar chamadas excessivas durante digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset da paginação do razão sempre que os filtros ou ordenação mudarem
  useEffect(() => {
    setLedgerPage(1);
  }, [
    filters.anomes,
    filters.contrato,
    filters.uf,
    filters.ufMode,
    filters.centroCusto,
    filters.estacao,
    filters.fornecedor,
    filters.empresa,
    filters.tipoContrato,
    debouncedSearch,
    ledgerSort,
  ]);

  // Carrega opções de filtros do BigQuery
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/energy/filters', { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          setFilterOptions(json.data);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Energy] Falha ao carregar opções de filtro:', err);
        }
      });
    return () => controller.abort();
  }, [reloadNonce]);

  const filterQueryString = useMemo(
    () => buildFilterSearchParams(filters, debouncedSearch).toString(),
    [filters, debouncedSearch]
  );

  // Carrega dashboard consolidado (KPIs, mensal, UFs, CCs, contas, fornecedores, contratos, estações)
  useEffect(() => {
    const controller = new AbortController();
    setIsDashboardLoading(true);
    setDashboardError(null);

    fetch(`/api/energy/dashboard?${filterQueryString}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar painel de Energia no BigQuery.');
        }
        return json.data as EnergyDashboardData;
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
  }, [filterQueryString, filters.uf, reloadNonce]);

  // Carrega drill-down da UF selecionada
  useEffect(() => {
    if (!selectedDrillUf) {
      setUfDrill(null);
      return;
    }

    const controller = new AbortController();
    setIsDrillLoading(true);

    const params = buildFilterSearchParams(filters, debouncedSearch);
    params.set('uf', selectedDrillUf);

    fetch(`/api/energy/uf-drill?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar detalhamento da UF.');
        }
        return json.data as EnergyUfDrilldownData;
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
  }, [selectedDrillUf, filters, debouncedSearch, reloadNonce]);

  // Carrega razão contábil paginado
  useEffect(() => {
    const controller = new AbortController();
    setIsLedgerLoading(true);

    const params = buildFilterSearchParams(filters, debouncedSearch);
    params.set('page', String(ledgerPage));
    params.set('pageSize', '50');
    params.set('sortBy', ledgerSort);

    fetch(`/api/energy/ledger?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao carregar razão contábil.');
        }
        return json.data as EnergyLedgerResponse;
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
  }, [filters, debouncedSearch, ledgerPage, ledgerSort, reloadNonce]);

  const handleChangeFilter = useCallback(
    <K extends keyof EnergyFilterState>(key: K, value: EnergyFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setDebouncedSearch('');
  }, []);

  const handleToggleValue = useCallback(
    (key: 'contrato' | 'estacao' | 'centroCusto' | 'fornecedor' | 'uf', value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: prev[key] === value ? 'ALL' : value,
      }));
    },
    []
  );

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const body = {
        anomes: filters.anomes !== 'ALL' ? filters.anomes : undefined,
        contrato: filters.contrato !== 'ALL' ? filters.contrato : undefined,
        uf: filters.uf !== 'ALL' ? filters.uf : undefined,
        ufMode: filters.ufMode,
        centroCusto: filters.centroCusto !== 'ALL' ? filters.centroCusto : undefined,
        estacao: filters.estacao !== 'ALL' ? filters.estacao : undefined,
        fornecedor: filters.fornecedor !== 'ALL' ? filters.fornecedor : undefined,
        empresa: filters.empresa !== 'ALL' ? filters.empresa : undefined,
        tipoContrato: filters.tipoContrato !== 'ALL' ? filters.tipoContrato : undefined,
        search: debouncedSearch.trim() || undefined,
      };

      const res = await fetch('/api/energy/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || 'Não foi possível gerar o Excel de Energia.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Energia_ACTUAL_2026_Razao_Detalhado.xlsx';
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

  return (
    <div className="w-full min-h-full bg-[#F4F6F4] px-5 sm:px-7 lg:px-8 py-6 flex flex-col space-y-6 pb-12">
      {/* Cabeçalho executivo da página */}
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
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E3A32] tracking-tight">
                Energia — Realizado 2026 (ACTUAL 2026)
              </h1>
              <p className="text-xs sm:text-sm text-[#52605A]">
                Consulta direta ao BigQuery (AREA = Energia · TIPO = ACTUAL 2026) por Contrato RE, Centro de Custo, UF e Estação.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={isDashboardLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#D5DCD2] bg-white hover:bg-[#FAFBF9] text-xs font-bold text-[#1E3A32] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#315F52] ${isDashboardLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || isDashboardLoading}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#315F52] hover:bg-[#274D42] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? 'Gerando Excel...' : 'Exportar Excel (.xlsx)'}</span>
          </button>
        </div>
      </header>

      {/* Erro de exportação ou consulta BigQuery */}
      {(dashboardError || exportError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-rose-800">
            {dashboardError || exportError}
          </span>
          <button
            type="button"
            onClick={() => {
              setExportError(null);
              setReloadNonce((n) => n + 1);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#315F52] hover:bg-[#274D42] text-white font-bold cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Barra de filtros no topo com Contrato em destaque */}
      <EnergyFilterBar
        filters={filters}
        options={filterOptions}
        onChangeFilter={handleChangeFilter}
        onResetFilters={handleResetFilters}
        isLoading={isDashboardLoading}
      />

      {/* Faixa de KPIs */}
      <EnergyKpiStrip
        summary={dashboard?.summary || null}
        isLoading={isDashboardLoading}
      />

      {/* Evolução Mensal 2026 */}
      <EnergyMonthlyChart
        monthly={dashboard?.monthly || []}
        selectedAnomes={filters.anomes}
        onSelectMonth={(anomes) => handleChangeFilter('anomes', anomes)}
      />

      {/* Análise Geográfica e Drill-down por UF */}
      <EnergyUfDrilldown
        byUf={dashboard?.byUf || []}
        ufMode={filters.ufMode}
        activeUfFilter={filters.uf}
        selectedDrillUf={selectedDrillUf}
        drillData={ufDrill}
        isDrillLoading={isDrillLoading}
        onChangeUfMode={(mode) => handleChangeFilter('ufMode', mode)}
        onSelectDrillUf={setSelectedDrillUf}
        onApplyUfFilter={(uf) => handleChangeFilter('uf', uf)}
        onToggleStationFilter={(st) => handleToggleValue('estacao', st)}
        onToggleContractFilter={(ct) => handleToggleValue('contrato', ct)}
        onToggleCcFilter={(cc) => handleToggleValue('centroCusto', cc)}
        activeStation={filters.estacao}
        activeContract={filters.contrato}
        activeCc={filters.centroCusto}
      />

      {/* Centros de Custo, Fornecedores e Contas Contábeis */}
      <EnergyBreakdownGrid
        byCostCenter={dashboard?.byCostCenter || []}
        bySupplier={dashboard?.bySupplier || []}
        byAccount={dashboard?.byAccount || []}
        activeCc={filters.centroCusto}
        activeSupplier={filters.fornecedor}
        onToggleCcFilter={(cc) => handleToggleValue('centroCusto', cc)}
        onToggleSupplierFilter={(sup) => handleToggleValue('fornecedor', sup)}
      />

      {/* Rankings de Contratos RE e Estações */}
      <EnergyContractsStationsSection
        byContract={dashboard?.byContract || []}
        byStation={dashboard?.byStation || []}
        activeContract={filters.contrato}
        activeStation={filters.estacao}
        onToggleContractFilter={(ct) => handleToggleValue('contrato', ct)}
        onToggleStationFilter={(st) => handleToggleValue('estacao', st)}
      />

      {/* Razão Contábil Detalhado e Paginado */}
      <EnergyLedgerTable
        ledger={ledger}
        isLoading={isLedgerLoading}
        sortBy={ledgerSort}
        onChangeSortBy={setLedgerSort}
        onChangePage={setLedgerPage}
      />
    </div>
  );
};

export default EnergyPage;
