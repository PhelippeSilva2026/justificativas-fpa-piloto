import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  PlanFinDashboardData,
  PlanFinFilterOptions,
  PlanFinFilterState,
} from '../../types/planFin';
import { PlanFinFilterBar } from '../../components/planfin/PlanFinFilterBar';
import { PlanFinKpiStrip } from '../../components/planfin/PlanFinKpiStrip';
import { PlanFinMatrix } from '../../components/planfin/PlanFinMatrix';

interface CentralPlanoFimPageProps {
  onBackToHub: () => void;
}

const DEFAULT_FILTERS: PlanFinFilterState = {
  anomes: '2026/10',
  pacote: 'ALL',
  subPacote: 'ALL',
};

export const CentralPlanoFimPage: React.FC<CentralPlanoFimPageProps> = ({ onBackToHub }) => {
  const [filters, setFilters] = useState<PlanFinFilterState>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<PlanFinFilterOptions | null>(null);
  const [scenarioMode, setScenarioMode] = useState<'actual' | 'fct102' | 'fct84'>('actual');

  const [dashboard, setDashboard] = useState<PlanFinDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/plan-fin/filters', { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          const opts = json.data as PlanFinFilterOptions;
          setFilterOptions(opts);
          if (opts.defaultAnomes) {
            setFilters((prev) =>
              prev.anomes === DEFAULT_FILTERS.anomes && opts.defaultAnomes !== prev.anomes
                ? { ...prev, anomes: opts.defaultAnomes }
                : prev
            );
          }
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Plan Fin Executivo] Falha ao carregar filtros:', err);
        }
      });
    return () => controller.abort();
  }, [reloadNonce]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.anomes && filters.anomes !== 'ALL') params.set('anomes', filters.anomes);
    if (filters.pacote !== 'ALL') params.set('pacote', filters.pacote);
    if (filters.subPacote !== 'ALL') params.set('subPacote', filters.subPacote);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/plan-fin/dashboard?${queryString}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || 'Erro ao consultar dados OPEX no BigQuery.');
        }
        return json.data as PlanFinDashboardData;
      })
      .then((data) => {
        setDashboard(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Falha ao consultar BigQuery.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [queryString, reloadNonce]);

  const handlePatchFilters = useCallback(
    (patch: Partial<PlanFinFilterState>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        if (patch.anomes && filterOptions) {
          const monthInfo = filterOptions.months.find((m) => m.value === patch.anomes);
          if (monthInfo && !monthInfo.hasFullActual) {
            setScenarioMode((curr) => (curr === 'actual' ? 'fct102' : curr));
          } else if (monthInfo && monthInfo.hasFullActual) {
            setScenarioMode((curr) => (curr === 'fct102' ? 'actual' : curr));
          }
        }
        return next;
      });
    },
    [filterOptions]
  );

  const handleResetFilters = useCallback(() => {
    setFilters({
      anomes: filterOptions?.defaultAnomes || DEFAULT_FILTERS.anomes,
      pacote: 'ALL',
      subPacote: 'ALL',
    });
    setScenarioMode('actual');
  }, [filterOptions]);

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = {
        anomes: filters.anomes !== 'ALL' ? filters.anomes : undefined,
        pacote: filters.pacote !== 'ALL' ? filters.pacote : undefined,
        subPacote: filters.subPacote !== 'ALL' ? filters.subPacote : undefined,
      };
      const res = await fetch('/api/plan-fin/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || 'Erro ao gerar planilha Excel.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plan_Fin_Executivo_Vtal_OPEX_2026.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Erro ao exportar Excel.');
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  return (
    <div className="min-h-full bg-[#F4F6F4] text-[#1E3A32]">
      <div className="w-full px-5 sm:px-7 lg:px-8 py-6 flex flex-col space-y-5 pb-12">
        {/* Cabeçalho executivo */}
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
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E3A32] tracking-tight truncate">
                  Plan Fin Executivo
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold text-[#1E3A32] bg-white hover:bg-[#FAFBF9] border border-[#D5DCD2] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#315F52] ${isLoading ? 'animate-spin' : ''}`}
              />
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

        {/* Filtros: Mês, Pacote (N3), Sub Pacote (N4) */}
        <PlanFinFilterBar
          filters={filters}
          options={filterOptions}
          onChange={handlePatchFilters}
          onReset={handleResetFilters}
        />

        {error ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-800">
                Erro ao consultar base executiva no BigQuery
              </h3>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="mt-3 px-3 py-1.5 text-xs font-bold bg-[#315F52] hover:bg-[#274D42] text-white rounded-lg cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : isLoading && !dashboard ? (
          <div className="bg-white border border-[#D5DCD2] rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#315F52]" />
            <p className="text-xs font-semibold text-[#52605A]">
              Consolidando visão executiva OPEX da V.tal no BigQuery...
            </p>
          </div>
        ) : dashboard ? (
          <>
            <PlanFinKpiStrip
              summary={dashboard.summary}
              refMonth={dashboard.refMonth}
              scenarioMode={scenarioMode}
            />

            <PlanFinMatrix
              packages={dashboard.packages}
              refMonth={dashboard.refMonth}
              filters={filters}
              scenarioMode={scenarioMode}
              onChangeScenarioMode={setScenarioMode}
              onSelectFilter={handlePatchFilters}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CentralPlanoFimPage;
