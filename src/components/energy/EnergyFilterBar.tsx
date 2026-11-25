import React from 'react';
import { Filter, RotateCcw, Search, X } from 'lucide-react';
import { EnergyFilterOptions, EnergyFilterState } from '../../types/energy';
import { formatAnomesLabel, formatBrlCompact } from './energyFormatters';

interface EnergyFilterBarProps {
  filters: EnergyFilterState;
  options: EnergyFilterOptions | null;
  onChangeFilter: <K extends keyof EnergyFilterState>(key: K, value: EnergyFilterState[K]) => void;
  onResetFilters: () => void;
  isLoading: boolean;
}

export const EnergyFilterBar: React.FC<EnergyFilterBarProps> = ({
  filters,
  options,
  onChangeFilter,
  onResetFilters,
  isLoading,
}) => {
  const activeChips: Array<{ key: keyof EnergyFilterState; label: string }> = [];
  if (filters.contrato !== 'ALL') {
    activeChips.push({
      key: 'contrato',
      label: `Contrato: ${filters.contrato === '__EMPTY__' ? 'Sem Contrato' : filters.contrato}`,
    });
  }
  if (filters.anomes !== 'ALL') {
    activeChips.push({ key: 'anomes', label: `Mês: ${formatAnomesLabel(filters.anomes)}` });
  }
  if (filters.uf !== 'ALL') {
    activeChips.push({ key: 'uf', label: `UF: ${filters.uf}` });
  }
  if (filters.centroCusto !== 'ALL') {
    activeChips.push({
      key: 'centroCusto',
      label: `CC: ${filters.centroCusto === '__EMPTY__' ? 'Sem CC' : filters.centroCusto}`,
    });
  }
  if (filters.estacao !== 'ALL') {
    activeChips.push({
      key: 'estacao',
      label: `Estação: ${filters.estacao === '__EMPTY__' ? 'Sem Estação' : filters.estacao}`,
    });
  }
  if (filters.fornecedor !== 'ALL') {
    activeChips.push({
      key: 'fornecedor',
      label: `Fornecedor: ${filters.fornecedor === '__EMPTY__' ? 'Sem Fornecedor' : filters.fornecedor}`,
    });
  }
  if (filters.empresa !== 'ALL') {
    activeChips.push({ key: 'empresa', label: `Empresa: ${filters.empresa}` });
  }
  if (filters.tipoContrato !== 'ALL') {
    activeChips.push({
      key: 'tipoContrato',
      label: `Tipo Ctto: ${filters.tipoContrato === '__EMPTY__' ? 'Não Classificado' : filters.tipoContrato}`,
    });
  }
  if (filters.search.trim()) {
    activeChips.push({ key: 'search', label: `Busca: "${filters.search.trim()}"` });
  }

  return (
    <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A32]">
          <Filter className="w-4 h-4 text-[#315F52]" />
          <span>Filtros de Análise</span>
          <span className="text-[#94A39D]">·</span>
          <span className="font-medium text-[#52605A]">
            Recorte fixo: ÁREA = Energia / TIPO = ACTUAL 2026
          </span>
        </div>

        {activeChips.length > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52605A] hover:text-[#1E3A32] px-2.5 py-1 rounded-lg border border-[#D5DCD2] hover:bg-[#F3F6F3] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar filtros ({activeChips.length})</span>
          </button>
        )}
      </div>

      {/* Linha principal de filtros: Contrato em destaque no início */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        <div>
          <label htmlFor="energy-filter-contrato" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Contrato (CONTRATO_RE)
          </label>
          <select
            id="energy-filter-contrato"
            value={filters.contrato}
            onChange={(e) => onChangeFilter('contrato', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todos os Contratos ({options?.contracts.length ?? 0})</option>
            {(options?.contracts || []).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({formatBrlCompact(c.netTotal ?? 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-mes" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Mês / Competência (2026)
          </label>
          <select
            id="energy-filter-mes"
            value={filters.anomes}
            onChange={(e) => onChangeFilter('anomes', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todos os Meses (YTD 2026)</option>
            {(options?.months || []).map((m) => (
              <option key={m} value={m}>
                {formatAnomesLabel(m)} ({m})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-uf" className="block text-[11px] font-bold text-[#52605A] mb-1">
            UF da Estação
          </label>
          <select
            id="energy-filter-uf"
            value={filters.uf}
            onChange={(e) => onChangeFilter('uf', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todas as UFs</option>
            {(options?.ufs || []).map((u) => (
              <option key={u.value} value={u.value}>
                {u.value} ({formatBrlCompact(u.netTotal)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-cc" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Centro de Custo
          </label>
          <select
            id="energy-filter-cc"
            value={filters.centroCusto}
            onChange={(e) => onChangeFilter('centroCusto', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todos os Centros de Custo</option>
            {(options?.costCenters || []).map((cc) => (
              <option key={cc.value} value={cc.value}>
                {cc.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-estacao" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Estação (SIGLA_ESTACAO)
          </label>
          <select
            id="energy-filter-estacao"
            value={filters.estacao}
            onChange={(e) => onChangeFilter('estacao', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todas as Estações</option>
            {(options?.stations || []).map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
                {st.uf ? ` · ${st.uf}` : ''} ({formatBrlCompact(st.netTotal ?? 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-fornecedor" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Fornecedor / Concessionária
          </label>
          <select
            id="energy-filter-fornecedor"
            value={filters.fornecedor}
            onChange={(e) => onChangeFilter('fornecedor', e.target.value)}
            className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
          >
            <option value="ALL">Todos os Fornecedores</option>
            {(options?.suppliers || []).map((sup) => (
              <option key={sup.value} value={sup.value}>
                {sup.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="energy-filter-empresa" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Empresa / Tipo de Contrato
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              id="energy-filter-empresa"
              aria-label="Empresa"
              value={filters.empresa}
              onChange={(e) => onChangeFilter('empresa', e.target.value)}
              className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-2.5 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
            >
              <option value="ALL">Empresas</option>
              {(options?.companies || []).map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
            <select
              aria-label="Tipo de Contrato"
              value={filters.tipoContrato}
              onChange={(e) => onChangeFilter('tipoContrato', e.target.value)}
              className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-2.5 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors"
            >
              <option value="ALL">Tipo Ctto</option>
              {(options?.contractTypes || []).map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="energy-filter-search" className="block text-[11px] font-bold text-[#52605A] mb-1">
            Busca rápida (Contrato, Estação, Doc., Texto)
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#68756E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="energy-filter-search"
              type="text"
              value={filters.search}
              onChange={(e) => onChangeFilter('search', e.target.value)}
              placeholder="Ex: 10003674, RJ-RJO, LIGHTCOM..."
              className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] focus:bg-white pl-8 pr-8 text-xs font-medium text-[#1E3A32] placeholder:text-[#8E9B95] outline-none focus:border-[#315F52] transition-colors"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChangeFilter('search', '')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68756E] hover:text-[#1E3A32] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chips de filtros ativos clicáveis para remoção individual */}
      {activeChips.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#E6EBE4] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#52605A]">Filtros ativos:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChangeFilter(chip.key, (chip.key === 'search' ? '' : 'ALL') as never)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#315F52] text-white text-[11px] font-semibold hover:bg-[#274D42] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3 text-white/80" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
